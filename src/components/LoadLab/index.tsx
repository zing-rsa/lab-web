"use client";

import { useMemo, useState } from "react";
import type uPlot from "uplot";
import { TypedHeading } from "@/components/TypedHeading";
import { clsx } from "@/lib/utils";
import type { LoadgenState } from "@/lib/loadgen/useLoadgen";
import { LoadChart } from "./LoadChart";

const SLIDER_MAX = 200;

interface LoadLabProps {
  collapsed: boolean;
  onToggle: () => void;
  loadgen: LoadgenState;
}

export function LoadLab({ collapsed, onToggle, loadgen }: LoadLabProps) {
  const {
    connected,
    metrics,
    history,
    slider,
    setSlider,
    bursting,
    remaining,
    duration,
    startBurst,
    stopBurst,
    limited,
  } = loadgen;

  const chartData = useMemo<uPlot.AlignedData>(
    () => [history.t, history.offered, history.processed, history.backlog, history.workers],
    [history],
  );

  // Nudge the re-open toggle (shake + glow) until the user has opened the panel at least once.
  const [hasOpened, setHasOpened] = useState(false);
  if (!collapsed && !hasOpened) setHasOpened(true);
  const nudge = collapsed && !hasOpened;

  const [infoOpen, setInfoOpen] = useState(true);

  const processed = metrics ? Math.round(metrics.processedTps) : 0;
  const offered = metrics ? metrics.offeredTps : 0;
  const backlog = metrics ? metrics.backlog : 0;
  const replicas = metrics ? metrics.replicas : 0;
  const cap = metrics?.cap ?? 500;

  return (
    <>
      <div
        aria-hidden={collapsed}
        className={clsx(
          "pointer-events-auto relative flex max-h-[calc(100vh-1.5rem)] w-[min(80vw,24rem)] flex-col overflow-y-auto border border-ink-muted/40 bg-paper/70 p-5 shadow-2xl backdrop-blur-md transition-[transform,opacity] duration-300 sm:max-h-[calc(100vh-3rem)] sm:w-[min(88vw,25rem)] sm:p-7",
          collapsed
            ? "pointer-events-none translate-x-[calc(100%+1.5rem)] opacity-0"
            : "translate-x-0 opacity-100",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <TypedHeading
            as="h2"
            text="DDos me?"
            className="text-2xl font-bold leading-tight"
          />
          <button
            type="button"
            onClick={onToggle}
            aria-label="Close load lab"
            className="-mr-1 -mt-1 shrink-0 text-sm leading-none text-ink-muted transition-colors hover:text-ink"
          >
            [x]
          </button>
        </div>

        <button
          type="button"
          onClick={() => setInfoOpen((open) => !open)}
          aria-expanded={infoOpen}
          aria-controls="loadlab-writeup"
          className="mt-4 self-start text-xs text-ink-faint transition-colors hover:text-ink"
        >
          {infoOpen ? "[-]" : "[+]"} how it works
        </button>

        <div
          id="loadlab-writeup"
          aria-hidden={!infoOpen}
          className={clsx(
            "grid transition-[grid-template-rows,opacity] duration-300",
            infoOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <p className="pt-2 text-sm leading-relaxed text-ink-muted">
              The slider below uses a websocket in your browser to send traffic to my cluster.
              Live metrics from the cluster are reported in the graph below.

              Once you increase the load past where the current pods can keep up, a backlog of events starts to grow. 
              The cluster monitors this backlog and scales workers until the backlog is handled.

              The architecture diagram in the background displays the flow of data and will update as new workers go on/offline.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <LoadChart data={chartData} height={150} />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-[2px] w-4" style={{ backgroundColor: "#63b8cf" }} />
              offered TPS
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-[2px] w-4" style={{ backgroundColor: "#b794f6" }} />
              system TPS
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-[2px] w-4" style={{ backgroundColor: "#e0913f" }} />
              backlog
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-[2px] w-4" style={{ backgroundColor: "#e6c34a" }} />
              workers
            </span>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <label htmlFor="loadgen-slider">load</label>
            <span className="text-ink">{slider} TPS</span>
          </div>
          <input
            id="loadgen-slider"
            type="range"
            min={0}
            max={SLIDER_MAX}
            step={5}
            value={slider}
            onChange={(e) => setSlider(Number(e.target.value))}
            className="mt-2 w-full accent-[#8fca9d]"
          />
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={startBurst}
            disabled={!connected || bursting}
            className={clsx(
              "flex-1 border px-3 py-2 text-sm transition-colors",
              !connected || bursting
                ? "cursor-not-allowed border-ink-muted/20 text-ink-faint"
                : "border-ink-muted/50 text-ink-muted hover:border-ink hover:text-ink",
            )}
          >
            generate
          </button>
          <button
            type="button"
            onClick={stopBurst}
            disabled={!bursting}
            className={clsx(
              "flex-1 border px-3 py-2 text-sm transition-colors",
              bursting
                ? "border-ink/60 text-ink hover:border-ink"
                : "cursor-not-allowed border-ink-muted/20 text-ink-faint",
            )}
          >
            stop
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-ink-faint">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={clsx(
                "tabular-nums transition-opacity duration-200",
                bursting ? "opacity-100" : "opacity-0",
                bursting && remaining <= 10 ? "animate-blink text-[#e0913f]" : "",
              )}
            >
              running · auto-stops in {remaining}s
            </span>
            {bursting ? (
              <button
                type="button"
                onClick={startBurst}
                aria-label="Reset the auto-stop timer to a full minute"
                className={clsx(
                  "shrink-0 border px-1.5 leading-relaxed transition-colors",
                  remaining <= 10
                    ? "border-[#e0913f]/60 text-[#e0913f] hover:border-[#e0913f]"
                    : "border-ink-muted/40 text-ink-muted hover:border-ink hover:text-ink",
                )}
              >
                +1m
              </button>
            ) : null}
          </div>
          <span
            className="flex shrink-0 items-center gap-1.5"
            title={connected ? "connected to gateway" : "disconnected"}
          >
            <span
              className={clsx(
                "inline-block h-2 w-2 rounded-full",
                connected ? "bg-[#8fca9d]" : "bg-[#d05f5f]",
              )}
            />
            {connected ? "live" : "offline"}
          </span>
        </div>

        <div className="mt-1.5 h-0.5 w-full overflow-hidden bg-ink-muted/15">
          <div
            className="h-full bg-[#8fca9d] transition-[width] duration-1000 ease-linear"
            style={{ width: bursting ? `${(remaining / duration) * 100}%` : "0%" }}
          />
        </div>

        <div
          className={clsx(
            "mt-2 text-[10px] transition-opacity duration-200",
            limited ? "text-[#d1a05f] opacity-100" : "opacity-0",
          )}
        >
          global cap ({cap} TPS) reached — load shed.
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-ink-muted/20 pt-4 text-center">
          <Readout label="system TPS" value={processed} accent="#b794f6" />
          <Readout label="backlog" value={backlog} accent="#e0913f" />
          <Readout label="worker pods" value={replicas} accent="#e6c34a" />
        </dl>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label="Show load lab"
        className={clsx(
          "absolute right-3 top-3 flex h-9 w-9 items-center justify-center border border-ink-muted/40 bg-paper/80 text-lg text-ink-muted shadow-lg backdrop-blur-md transition-opacity duration-300 hover:text-ink sm:right-6 sm:top-1/2 sm:-translate-y-1/2",
          collapsed ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        «
        {nudge ? (
          <span
            aria-hidden
            className="animate-notify absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#e0913f]"
          />
        ) : null}
      </button>
    </>
  );
}

function Readout({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div>
      <dd className="text-lg font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </dd>
      <dt className="mt-0.5 text-[9px] tracking-wide text-ink-faint">{label}</dt>
    </div>
  );
}
