// Tier 0 mock of load-demo-gateway: speaks the same WebSocket protocol as the Go gateway but
// fakes the backend. It accepts {t:"load",n} up to a global cap, simulates a NATS backlog draining
// through a KEDA-scaled worker pool, and broadcasts {t:"metrics",...} at 1 Hz. No NATS/Prometheus
// needed — point NEXT_PUBLIC_LOADGEN_URL at ws://localhost:8080/loadgen and run `bun mock-gateway`.

interface WS {
  send(data: string): void;
}

declare const Bun: {
  serve(options: {
    port: number;
    fetch(
      req: Request,
      server: { upgrade(req: Request): boolean },
    ): Response | undefined;
    websocket: {
      open(ws: WS): void;
      close(ws: WS): void;
      message(ws: WS, message: string | Uint8Array): void;
    };
  }): { port: number };
};

const PORT = Number(process.env.PORT ?? 8080);
const CAP = 500; // global aggregate TPS cap
const PER_WORKER = 70; // TPS a single worker pod can drain
const LAG = 50; // backlog per replica before KEDA wants another pod
const MIN_REPLICAS = 1;
const MAX_REPLICAS = 5;

const clients = new Set<WS>();

let offeredAccum = 0; // accepted this second
let backlog = 0;
let replicas = MIN_REPLICAS;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

setInterval(() => {
  const offeredTps = offeredAccum;
  offeredAccum = 0;

  backlog += offeredTps;
  const capacity = replicas * PER_WORKER;
  const processed = Math.min(backlog, capacity);
  backlog -= processed;

  const desired = clamp(Math.ceil(backlog / LAG) || MIN_REPLICAS, MIN_REPLICAS, MAX_REPLICAS);
  if (desired > replicas) replicas += 1;
  else if (desired < replicas) replicas -= 1;

  const snapshot = JSON.stringify({
    t: "metrics",
    offeredTps,
    processedTps: Math.round(processed),
    backlog: Math.round(backlog),
    replicas,
    cap: CAP,
  });
  for (const ws of clients) ws.send(snapshot);
}, 1000);

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/loadgen" || url.pathname === "/loadgen/ws") {
      if (server.upgrade(req)) return;
      return new Response("expected websocket", { status: 426 });
    }
    if (url.pathname === "/healthz") return new Response("ok");
    return new Response("not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      clients.add(ws);
    },
    close(ws) {
      clients.delete(ws);
    },
    message(ws, message) {
      let m: { t?: string; n?: number };
      try {
        m = JSON.parse(String(message));
      } catch {
        return;
      }
      if (m.t !== "load" || typeof m.n !== "number" || m.n <= 0) return;
      const room = CAP - offeredAccum;
      const take = clamp(m.n, 0, Math.max(0, room));
      offeredAccum += take;
      if (take < m.n) ws.send(JSON.stringify({ t: "limit" }));
    },
  },
});

console.log(`mock-gateway on ws://localhost:${server.port}/loadgen (cap=${CAP} TPS)`);
