# Live Load Generation + Realtime TPS — Plan

A new showcase feature for `lab-web`: a user moves a slider and triggers a bounded
burst of **real load** (dummy transactions) against the real lab cluster, watches a
realtime graph of the **system-wide** TPS, and sees the application section of the
diagram scale up extra worker pods.

## Confirmed decisions

- **Producer:** the browser, over a single WebSocket. **Transport:** WebSocket (not HTTP).
- **Burst model:** the "Generate load" button runs a bounded ~**10s** burst; the slider
  sets intensity **0–200 TPS** per tab; the gateway hard-caps the aggregate at **500 TPS**.
- **Events + scaling:** **NATS JetStream + KEDA**. **Scaling is pods-only** — sized so it
  never forces a new (paid) node.
- **Work per transaction:** pure CPU spin (tunable). No DB writes.
- **Services language:** **Go**. **Chart library:** **uPlot**.
- **Code location:** the demo services + their manifests live in **this repo (`lab-web`)** under
  `deploy/load-demo-gateway/` and `deploy/load-demo-worker/` — the demo exists to serve the
  site, so it is scoped to the site's repo. Only the **reusable platform infra** (NATS + KEDA)
  lives in the `lab` repo, plus small Flux registrations pointing at this repo's demo deploy paths.
- **Deploy scope:** **dev** (`dev.infra.zingdev.xyz`) first, promote to prod later.

## Where things live

- **`lab` repo (platform infra, reusable):** `gitops/infrastructure/controllers/nats/` and
  `.../keda/` (Phase 1). Flux registrations in `gitops/apps/registrations/lab-web.yml`
  (`load-demo-gateway-dev`, `load-demo-worker-dev`) reconcile this repo's
  `./deploy/load-demo-gateway/overlays/dev` and `./deploy/load-demo-worker/overlays/dev` into the `infra-dev`
  namespace (reusing the existing `lab-web` GitRepository source).
- **`lab-web` repo:** `deploy/` holds one folder per project, each with the same standard
  `base/` + `overlays/{dev,prod}/` layout — the only difference is that the two demo services
  also carry a small amount of Go code:
  - `deploy/web/` — the site's manifests (`base` + `overlays/{dev,prod}`). Site source is at the
    repo root (`src/`, `package.json`, root `Dockerfile`); Phase 3 UI lives under `src/`.
  - `deploy/load-demo-gateway/` — `load-demo-gateway`: Go source + Dockerfile next to `base` +
    `overlays/{dev,prod}` (a `.dockerignore` keeps the manifest subdirs out of the build context).
  - `deploy/load-demo-worker/` — `load-demo-worker`: same shape.
  - Each overlay pins its own image (no aggregator). One workflow file per app —
    `.github/workflows/{ci-web,ci-load-demo-gateway,ci-load-demo-worker}.yaml` — each the same shape (the lab repo's reusable
    `build.yml` + `deploy.yml`) but with its own `paths` filter, so a change only builds/deploys
    that app. Push → dev, release → prod.

## Current state (why this shape)

- `lab-web` is Next.js 16 `output: "standalone"`, React 19, `@xyflow/react` diagram,
  deployed to k3s via Kustomize + Flux. The diagram is 100% static data in
  `src/lib/diagram/content.ts`. No API routes, no realtime today.
- Live node state is already plumbed: the effect at `LabDiagram.tsx:81-124` maps external
  state → per-node `data`, and `ComponentNode.tsx:46-53` already renders a live `count`
  badge. Driving live values into a node is low-friction.
- `lab` has **no messaging system** and **no pod autoscaling** yet (only a node-level
  cluster-autoscaler, min 1 / max 3 workers). Both the events layer and the pod-scaling
  story are greenfield. Prometheus + kube-state-metrics already exist, so TPS, replica
  counts and node counts are queryable.

## Data flow

```
Browser tab (slider 0–200 TPS; button = 10s burst; auto-stops)
  │  ONE WebSocket (wss), same-origin via /loadgen path
  │    up:   {t:"load", n:<batch>}  ~10 frames/s, browser-paced
  │    down: {t:"metrics", processedTps, offeredTps, backlog, replicas, cap} @1Hz
  ▼
load-demo-gateway (Go, in lab-web repo, public via HTTPRoute path match)
  - Origin check · per-conn rate cap · 500 TPS global cap
  - Expands batches → publishes to NATS JetStream (subject: transactions)
  - Reads metrics 1/s (Prometheus, or NATS-derived fallback), fans them down every socket
  - Exposes loadgen_received_total + active-conn gauge
  ▼
NATS JetStream (lab infra) — WorkQueue stream, msgs removed on ACK (pending = true backlog)
  ▼
load-demo-worker (Go consumers) — tunable CPU spin per tx, ACK, transactions_processed_total
  - KEDA ScaledObject: min 1, max 5, scale on JetStream num_pending
  - requests sized + max capped so all replicas fit the warm worker node
  ▼
Prometheus (scrapes load-demo-worker + NATS + kube-state-metrics)
```

### Design rationale

- **One bidirectional WebSocket:** the browser is the genuine load origin (up); the gateway
  streams true **system-wide** metrics back (down), so multiple tabs add up and every tab
  shows the same totals.
- **lab-web stays static:** metrics arrive via the gateway socket, so no lab-web route
  handlers and **no change to lab-web's egress NetworkPolicy**. Minimal blast radius on the
  live site.
- **Same-origin path routing:** a 2nd HTTPRoute sends `dev.infra.zingdev.xyz/loadgen` →
  gateway, `/` → lab-web. No CORS, no new cert/subdomain; Envoy passes WS upgrades.
- **Why a gateway (not browser-direct-to-NATS):** NATS can accept browser WebSocket clients
  directly (`nats.ws`), but that means exposing the broker publicly with auth/subject ACLs.
  Our thin gateway enforces rate cap, global cap and the auto-stop server-side.
- **Pods-only cost guard:** small worker requests + capped KEDA max ⇒ pods never go Pending
  ⇒ cluster-autoscaler never adds a paid node.

## Prometheus queries (gateway → down the socket)

- Processed TPS: `sum(rate(transactions_processed_total[30s]))` (fallback: NATS consumer ack-floor delta)
- Offered TPS: counted in-process by the gateway (single instance ⇒ inherently system-wide)
- Backlog: NATS JetStream consumer `NumPending` (read directly from NATS)
- Worker replicas: `kube_deployment_status_replicas_available{namespace="infra-dev",deployment="load-demo-worker"}` (fallback: NATS worker heartbeats)

## WebSocket protocol

- Client → server: `{"t":"load","n":<int>}` (the browser stops sending these when the burst
  ends or the slider is 0 — offered load decays to zero)
- Server → client: `{"t":"metrics", ...}` @1Hz, `{"t":"limit"}` when the global cap is hit

## Work items

### Phase 1 — `lab` infra (Flux) — DONE

- `gitops/infrastructure/controllers/nats/` — NATS JetStream HelmRelease (single server,
  in-memory store, prom exporter) + HelmRepository + kustomization.
- `gitops/infrastructure/controllers/keda/` — KEDA HelmRelease + kustomization.
- Registered both in `controllers/kustomization.yaml` (no `infrastructure.yaml` change needed —
  `infra-controllers` already reconciles the whole dir with `wait: true`).

### Phase 2 — demo services in `lab-web` (Go, `deploy/load-demo-*`) — DONE

- **`load-demo-gateway`** (`deploy/load-demo-gateway/`): Go WS server (origin check, per-conn + global
  caps, batch→NATS publish, ensures stream/consumer, 1 Hz metrics fan-down; Prometheus-primary
  with NATS-derived fallback) + Dockerfile. Manifests: `base` (Deployment 1 replica, Service) +
  `overlays/{dev,prod}` (**HTTPRoute path `/loadgen`**, ServiceMonitor, NetworkPolicy, env patch,
  image pin).
- **`load-demo-worker`** (`deploy/load-demo-worker/`): Go JetStream `Fetch` consumer (tunable CPU spin,
  ACK, `transactions_processed_total`, NATS heartbeat) + Dockerfile. Manifests: `base`
  (Deployment — no `replicas`, KEDA owns it; Service) + `overlays/{dev,prod}` (**KEDA ScaledObject**
  min 1 / max 5, ServiceMonitor, NetworkPolicy, image pin).
- CI: one workflow file per service (`.github/workflows/ci-load-demo-gateway.yaml`, `ci-load-demo-worker.yaml`) — same
  shape as the site's `ci-web.yaml`, each calling the lab repo's reusable `build.yml` + `deploy.yml`
  and filtered to its own Go source. Push → pins the dev overlay tag, release → prod. Deployed by
  the `load-demo-gateway-dev` / `load-demo-worker-dev` Flux Kustomizations (registered in the lab
  repo) into `infra-dev`. Prod overlays exist; prod registration is a later promotion step.
- Both services compile + `go vet` clean; kustomize builds verified. Live NATS smoke test is
  deferred to the dev deploy / local docker-compose (Docker not available locally).

### Phase 3 — `lab-web` UI + diagram

- `package.json`: add `uplot`.
- `src/lib/loadgen/useLoadgen.ts`: WS hook — connect `wss://<host>/loadgen`, pace emissions
  to slider TPS (batched ~10 Hz), enforce 10s auto-stop + countdown, expose live metrics.
- `src/components/LoadLab/`: a collapsible panel that is the **mirror image of `Hero.tsx`**
  (see "UI / layout" below) — small use-case description, uPlot streaming chart (processed
  vs offered), the slider, and the "Generate load" control + readouts (system TPS, backlog,
  worker pods).
- `src/app/page.tsx`: mount `LoadLab` on the right, hold shared live state
  `{active, replicas, tps}`, pass into `LabDiagram`. Two independent collapse states: the
  left Hero starts **expanded**, the right LoadLab starts **collapsed**.
- `src/lib/diagram/content.ts`: add `nats` + `load-demo-worker` nodes (worker in the application
  section) and edges `envoy-gateway→load-demo-gateway→nats→load-demo-worker`, plus
  `keda→load-demo-worker` and worker telemetry edges.
- `src/lib/diagram/theme.ts` + `types.ts`: add an `events` accent for NATS (optional).
- `src/components/diagram/ComponentNode.tsx`: render a pod-chip grid when `data.pods` is set.
- `src/components/diagram/LabDiagram.tsx`: accept live props; feed replica count into the
  `load-demo-worker` node `count`/chips and toggle `animated` on the load-demo edges while a
  burst runs (reuses the `:81-124` state plumbing + `FloatingEdge` animation).
- The site's own manifests (`deploy/web`) are unchanged; the demo ships via `deploy/{load-demo-gateway,load-demo-worker}` (Phase 2).

### UI / layout — symmetric to Hero

The LoadLab panel mirrors the existing `Hero.tsx` writeup panel so the two bookend the
diagram:

- **Mirrored placement:** Hero is a glass panel anchored **left** and vertically centered on
  desktop; LoadLab is the same glass panel treatment (`border-ink-muted/40 bg-paper/70
  backdrop-blur-md`, same padding/width/max-height) anchored **right**. In `page.tsx` it sits
  in a right-aligned `pointer-events-none` container mirroring the left one at
  `page.tsx:14-16`.
- **Collapsed by default:** unlike Hero (which starts expanded), LoadLab starts **collapsed**.
  Collapsed = slid off-screen to the right (`translate-x-[calc(100%+1.5rem)]`, opacity 0)
  with a small floating toggle button on the right edge to expand it — the mirror of Hero's
  left toggle. Toggle glyphs are flipped (`»` collapses toward the right, `«` expands).
- **Expanded contents (top → bottom):**
  1. Heading + collapse button (mirrored header row).
  2. A short use-case description (1–2 sentences: "generate real load against the live
     cluster and watch it autoscale").
  3. The uPlot **live graph** (system processed TPS vs offered), streaming.
  4. The **slider** (0–200 TPS) for this tab's intensity.
  5. The **load control** — "Generate load" button with a 10s countdown — plus compact
     readouts (system TPS, backlog, worker pods).
- Note the desktop `DetailPanel` also slides in from the right on node-select; keep LoadLab's
  stacking/offset clear of it (implementation detail).

### Phase 4 — Verify on dev

Slider + button → TPS graph climbs to offered rate → backlog spikes → KEDA adds
load-demo-worker pods (chips grow in the diagram) → backlog drains → burst auto-stops at 10s →
replicas scale back down. Confirm no new node is ever added, and open multiple tabs to see
aggregate TPS rise.

## Local development

Metrics come from Prometheus (see queries above), so a faithful local run needs a Prometheus
alongside NATS. Test in tiers, staying in Tier 0/1 day-to-day and using Tier 2/3 only to
confirm real KEDA autoscaling.

Wiring for local runs:

- `NEXT_PUBLIC_LOADGEN_URL` — the WS client uses this when set (e.g.
  `ws://localhost:8080/loadgen`) and falls back to same-origin `/loadgen` in prod.
- The gateway reads a configurable `PROM_URL` — a local Prometheus in Tier 1, the in-cluster
  Prometheus service in Tier 3.
- The gateway's origin check allows `localhost` origins when running in dev mode.

### Tier 0 — UI only (fastest loop, no infra)

`bun dev` + a small `scripts/mock-gateway.ts` (Bun/Node) that speaks the WS protocol and
fakes a backlog/replicas/TPS ramp-and-drain. Point `NEXT_PUBLIC_LOADGEN_URL` at it. Enough to
build the whole LoadLab panel, uPlot chart, slider, and the diagram pod-chip animation with
zero real infra.

### Tier 1 — real Go services (main dev loop)

A `docker-compose.yml` (add under `deploy/`) brings up NATS + the gateway + the worker(s);
`bun dev` runs the site with the WS pointed at `localhost`.

- Real WebSocket → real NATS → real CPU work → real `transactions_processed_total` → real
  processed-TPS graph.
- Scale workers with `docker compose up --scale load-demo-worker=3` to move the replica
  readout / pod chips.
- No local Prometheus needed: leave `PROM_URL` empty and the gateway falls back to NATS-derived
  signals — processed TPS from the consumer ack-floor delta, replica count from worker
  heartbeats, backlog from `NumPending`. (In-cluster, `PROM_URL` is set and Prometheus is
  authoritative.)

### Tier 2 — full autoscaling (optional, highest fidelity)

A local `k3d`/`kind` cluster with NATS + KEDA + kube-prometheus-stack (incl.
kube-state-metrics) + the manifests. Gives the real `kube_deployment_status_replicas` metric
and real KEDA pod autoscaling before touching the dev cluster.

### Tier 3 — dev cluster

Final validation at `dev.infra.zingdev.xyz` per Phase 4.

## Safety / cost controls

- Hard global aggregate TPS cap (500) in the gateway (token bucket), independent of tab count —
  this is the real cost guard: it bounds total system load even if a client misbehaves.
- Per-connection cap (200 TPS) matching the slider max.
- KEDA `maxReplicaCount` (5) bounded; worker requests tiny so replicas always fit the warm
  worker node → no cluster-autoscaler node scaling → no extra Hetzner cost.
- Bounded ~10s burst enforced client-side (browser stops emitting at the deadline).
- Origin check on the WebSocket restricts producers to the lab-web origin.

## Open tuning knobs (defaults, adjust during build)

- KEDA `maxReplicaCount` (5) and `lagThreshold` (30) — tune so a 500-TPS burst climbs to
  ~max replicas before draining.
- `WORK_ITERS` — per-transaction CPU spin cost (starting point 50000).
- `load-demo-worker` resource requests (must let max replicas co-schedule on the warm node).
- Optional: shared token on the gateway (via ESO) instead of origin-check-only.
