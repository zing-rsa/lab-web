"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface LoadMetrics {
  offeredTps: number;
  processedTps: number;
  backlog: number;
  replicas: number;
  cap: number;
}

export interface LoadHistory {
  t: number[];
  offered: number[];
  processed: number[];
}

export interface LoadgenState {
  connected: boolean;
  metrics: LoadMetrics | null;
  history: LoadHistory;
  slider: number;
  setSlider: (n: number) => void;
  bursting: boolean;
  remaining: number;
  duration: number;
  startBurst: () => void;
  stopBurst: () => void;
  limited: boolean;
}

type ServerMsg =
  | ({ t: "metrics" } & Partial<LoadMetrics>)
  | { t: "limit" };

const EMIT_HZ = 10;
const EMIT_INTERVAL = 1000 / EMIT_HZ;
const BURST_MS = 60_000;
const RECONNECT_MS = 2_000;
const LIMIT_FLASH_MS = 1_500;
const HISTORY_WINDOW = 60;

const EMPTY_HISTORY: LoadHistory = { t: [], offered: [], processed: [] };

// The gateway URL: NEXT_PUBLIC_LOADGEN_URL when set (local dev / Tier 0), else same-origin /loadgen.
function resolveUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_LOADGEN_URL;
  if (configured) return configured;
  if (typeof window === "undefined") return null;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/loadgen`;
}

export function useLoadgen(): LoadgenState {
  const [connected, setConnected] = useState(false);
  const [metrics, setMetrics] = useState<LoadMetrics | null>(null);
  const [history, setHistory] = useState<LoadHistory>(EMPTY_HISTORY);
  const [slider, setSlider] = useState(0);
  const [bursting, setBursting] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [limited, setLimited] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const sliderRef = useRef(slider);
  const burstDeadlineRef = useRef(0);
  const emitCarryRef = useRef(0);
  const limitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    sliderRef.current = slider;
  }, [slider]);

  useEffect(() => {
    const url = resolveUrl();
    if (!url) return;
    let closed = false;
    let reconnect: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        reconnect = setTimeout(connect, RECONNECT_MS);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!closed) reconnect = setTimeout(connect, RECONNECT_MS);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        let msg: ServerMsg;
        try {
          msg = JSON.parse(ev.data as string) as ServerMsg;
        } catch {
          return;
        }
        if (msg.t === "metrics") {
          const offeredTps = msg.offeredTps ?? 0;
          const processedTps = msg.processedTps ?? 0;
          setMetrics({
            offeredTps,
            processedTps,
            backlog: msg.backlog ?? 0,
            replicas: msg.replicas ?? 0,
            cap: msg.cap ?? 0,
          });
          setHistory((prev) => {
            const t = [...prev.t, Date.now() / 1000];
            const offered = [...prev.offered, offeredTps];
            const processed = [...prev.processed, processedTps];
            const start = Math.max(0, t.length - HISTORY_WINDOW);
            return {
              t: t.slice(start),
              offered: offered.slice(start),
              processed: processed.slice(start),
            };
          });
        } else if (msg.t === "limit") {
          setLimited(true);
          if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
          limitTimerRef.current = setTimeout(() => setLimited(false), LIMIT_FLASH_MS);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnect) clearTimeout(reconnect);
      if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  // While a burst runs, pace batches to the slider TPS (~10 Hz). Fractional carry keeps the
  // long-run average exact for slider values that aren't multiples of EMIT_HZ.
  useEffect(() => {
    if (!bursting) return;
    emitCarryRef.current = 0;
    const id = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const tps = sliderRef.current;
      if (tps <= 0) return;
      emitCarryRef.current += (tps * EMIT_INTERVAL) / 1000;
      const n = Math.floor(emitCarryRef.current);
      if (n < 1) return;
      emitCarryRef.current -= n;
      ws.send(JSON.stringify({ t: "load", n }));
    }, EMIT_INTERVAL);
    return () => clearInterval(id);
  }, [bursting]);

  // Countdown + client-side auto-stop at the burst deadline.
  useEffect(() => {
    if (!bursting) return;
    const tick = () => {
      const left = Math.max(0, burstDeadlineRef.current - Date.now());
      setRemaining(Math.ceil(left / 1000));
      if (left <= 0) setBursting(false);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [bursting]);

  const startBurst = useCallback(() => {
    burstDeadlineRef.current = Date.now() + BURST_MS;
    setRemaining(Math.ceil(BURST_MS / 1000));
    setBursting(true);
  }, []);

  const stopBurst = useCallback(() => {
    burstDeadlineRef.current = 0;
    setBursting(false);
    setRemaining(0);
  }, []);

  return {
    connected,
    metrics,
    history,
    slider,
    setSlider,
    bursting,
    remaining,
    duration: BURST_MS / 1000,
    startBurst,
    stopBurst,
    limited,
  };
}
