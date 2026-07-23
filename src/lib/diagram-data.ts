/**
 * Nested-containment model of the lab cluster rendered by the React Flow
 * diagram.
 *
 * Containment mirrors where things actually run: Hetzner Cloud ▸ private
 * network ▸ the two k3s node pools (control plane / workers), with each
 * workload nested under the node pool it schedules on. Layout is computed by a
 * small box-packing pass (`buildLayout`) that sizes each container from its
 * children and centres every row.
 *
 * Responsibility (gitops, platform, secrets, observability, data, apps) is not
 * a container any more — it is carried understatedly by each component's
 * `accent` colour, so the diagram groups by node yet still reads by concern.
 *
 * Edges are tagged: `flow: "ingress" | "egress"` are the animated, coloured
 * request/egress paths; untagged edges are internal dependency links shown
 * only when a component is focused.
 */

export interface ComponentDef {
  id: string;
  name: string;
  /** One-line type descriptor shown under the name. */
  kind: string;
  namespace?: string;
  version?: string;
  /** Replica/instance annotation, e.g. "×3" or "1–3". */
  count?: string;
  summary: string;
  /** Responsibility colour; overrides the containing box's accent. */
  accent?: AccentKey;
}

export interface BoxSpec {
  id: string;
  label: string;
  accent: AccentKey;
  /** Dashed border, e.g. for the ephemeral application-pods container. */
  dashed?: boolean;
  /** Grow to fill the parent's inner width (equalises sibling boxes). */
  stretch?: boolean;
  /** Children per row (ids reference other boxes or components). */
  rows: string[][];
  /** When set, the box is a clickable node pool with its own detail card. */
  kind?: string;
  namespace?: string;
  version?: string;
  count?: string;
  summary?: string;
}

export type FlowKind = "ingress" | "egress" | "admin";

export interface EdgeDef {
  source: string;
  target: string;
  /** Coloured animated path; omitted = internal dependency link. */
  flow?: FlowKind;
  /** Optional label rendered on the edge (typically on the first segment). */
  label?: string;
  /** Vertical nudge (px) for the label; negative moves it up. */
  labelDy?: number;
  /**
   * Anchor the internet-side endpoint at this fraction (0–1) of the internet
   * node's bottom edge, so the flows fan out with even spacing.
   */
  internetAnchor?: number;
  /**
   * Route straight down: exit the source's bottom edge at this x-fraction and
   * drop vertically into the target's top edge.
   */
  downFrac?: number;
  /**
   * Enter the target on its top edge at this x-fraction (rather than a side
   * midpoint), e.g. to line the entry up with a downstream exit.
   */
  targetTopFrac?: number;
  /**
   * Enter the target on its bottom edge at this x-fraction, e.g. to line a
   * bottom entry up vertically with the node's top exit.
   */
  targetBottomFrac?: number;
  /**
   * Exit the source on its top edge at this x-fraction, e.g. to line a top
   * exit up vertically with the node's bottom entry.
   */
  sourceTopFrac?: number;
  /**
   * Exit the source on its bottom edge at this x-fraction, e.g. to line a
   * bottom exit up vertically with the node's top entry.
   */
  sourceBottomFrac?: number;
}

export type AccentKey =
  | "external"
  | "hetzner"
  | "nodes"
  | "kubernetes"
  | "gitops"
  | "platform"
  | "secrets"
  | "observability"
  | "data"
  | "apps";

/** Muted, desaturated accents that read on the near-black paper background. */
export const ACCENTS: Record<AccentKey, string> = {
  external: "#8a8a8a",
  hetzner: "#d78c8c",
  nodes: "#cbb173",
  kubernetes: "#7aa7db",
  gitops: "#b394db",
  platform: "#86c08f",
  secrets: "#d9b072",
  observability: "#db9b73",
  data: "#74bcc9",
  apps: "#8fca9d",
};

export const FLOW_COLORS: Record<FlowKind, string> = {
  ingress: "#63b8cf",
  egress: "#d1a05f",
  admin: "#d05f5f",
};

/** Human label for a component's responsibility, shown in the detail panel. */
export const RESPONSIBILITY_LABELS: Record<AccentKey, string> = {
  external: "external",
  hetzner: "Hetzner Cloud",
  nodes: "cluster node",
  kubernetes: "gateway · ingress",
  gitops: "gitops",
  platform: "platform · controllers",
  secrets: "secrets · storage",
  observability: "observability",
  data: "data",
  apps: "applications",
};

export const COMPONENTS: ComponentDef[] = [
  // --- external edge ---
  {
    id: "internet",
    name: "Internet",
    kind: "public network",
    accent: "external",
    summary:
      "The public internet. All ingress arrives here and all node egress is NATed back out to it through the bastion.",
  },
  {
    id: "cloudflare-dns",
    name: "Cloudflare DNS",
    kind: "DNS · authoritative zone",
    accent: "external",
    summary:
      "Authoritative DNS for zingdev.xyz. Records are managed automatically by external-dns; cert-manager solves ACME DNS-01 challenges here for wildcard TLS.",
  },

  // --- Hetzner Cloud edge ---
  {
    id: "hetzner-lb",
    name: "Hetzner L4 Load Balancer",
    kind: "L4 load balancer",
    accent: "hetzner",
    summary:
      "Layer-4 load balancer on ports 80/443 in nbg1. Not declared in Terraform — the Hetzner CCM provisions it dynamically from the Envoy Gateway LoadBalancer Service and forwards to the gateway over the private network.",
  },
  {
    id: "hetzner-firewall",
    name: "Hetzner Firewall",
    kind: "cloud firewall",
    accent: "hetzner",
    summary:
      "Cloud firewall attached to the bastion. Inbound is restricted to SSH (22) and ICMP from a single home IP; governs public traffic only.",
  },
  {
    id: "bastion",
    name: "Cx23 Bastion / NAT Gateway",
    kind: "cx23 · bastion + NAT",
    count: "×1",
    accent: "hetzner",
    summary:
      "Dual-role cx23 host at 10.0.1.1: SSH jump host into the private-only nodes and the NAT gateway for the network's 0.0.0.0/0 egress route. Every node reaches the internet through it.",
  },

  // --- control plane node pool ---
  {
    id: "kube-system",
    name: "Kube System",
    kind: "k3s system",
    namespace: "kube-system",
    accent: "platform",
    summary:
      "Core k3s system namespace: CoreDNS plus the control-plane components (API server, scheduler, controller-manager, etcd) folded into the single k3s process.",
  },
  {
    id: "hetzner-ccm",
    name: "Hetzner CCM",
    kind: "cloud controller manager",
    namespace: "kube-system",
    version: "1.32.0",
    accent: "hetzner",
    summary:
      "Cloud controller manager. Clears the uninitialized node taint, sets providerIDs/addresses, and turns LoadBalancer Services into real Hetzner load balancers. Deployed by Terraform pre-Flux.",
  },
  {
    id: "alloy",
    name: "Alloy DaemonSet",
    kind: "telemetry collector",
    namespace: "observability",
    version: "1.10.0",
    count: "per node",
    accent: "observability",
    summary:
      "Grafana Alloy on every node (including control plane). Receives OTLP traces and tails CRI pod logs, enriches them with k8s metadata, then fans out traces to Tempo and logs to Loki.",
  },
  {
    id: "openbao",
    name: "OpenBao",
    kind: "secrets store · Raft",
    namespace: "openbao",
    version: "0.28.4",
    count: "×1",
    accent: "secrets",
    summary:
      "Single-node integrated-Raft secrets store with static-key auto-unseal and declarative self-init. Pinned to control-plane nodes; the source of truth that External Secrets syncs into the cluster.",
  },
  {
    id: "cluster-autoscaler",
    name: "Cluster Autoscaler",
    kind: "node autoscaler",
    namespace: "kube-system",
    version: "9.57.0",
    accent: "hetzner",
    summary:
      "Hetzner-backed autoscaler managing the worker pool (min 1 / max 3, cx33). Runs on control-plane nodes so it can bootstrap workers from zero pressure. Deployed by Terraform.",
  },

  // --- worker node pool ---
  {
    id: "flux",
    name: "Flux System",
    kind: "gitops reconciler",
    namespace: "flux-system",
    version: "v2.8.8",
    accent: "gitops",
    summary:
      "GitOps engine bootstrapped by Terraform. Continuously reconciles the gitops/ tree from Git, deploying and healing every platform operator and application below.",
  },
  {
    id: "envoy-gateway",
    name: "Envoy Gateway",
    kind: "Gateway API ingress",
    namespace: "envoy-gateway-system",
    version: "1.8.1",
    accent: "kubernetes",
    summary:
      "Gateway API implementation. A single shared Gateway with per-environment HTTPS listeners terminates TLS and routes HTTPRoutes to application Services; its Service is what the CCM exposes via the LB.",
  },
  {
    id: "external-dns",
    name: "external-dns",
    kind: "DNS controller",
    namespace: "external-dns",
    version: "1.21.1",
    accent: "platform",
    summary:
      "Watches Gateway API routes and Services and syncs Cloudflare DNS records to point at the ingress LB. Reads its Cloudflare token from a Secret synced out of OpenBao by ESO.",
  },
  {
    id: "cnpg",
    name: "CloudNativePG",
    kind: "Postgres operator",
    namespace: "cnpg-system",
    version: "0.28.3",
    accent: "data",
    summary:
      "Cluster-scoped Postgres operator. Reconciles per-environment Postgres clusters (in dev/uat/prod namespaces) on hcloud volumes and exposes them to application pods.",
  },
  {
    id: "external-secrets",
    name: "External Secrets",
    kind: "secrets operator",
    namespace: "external-secrets",
    version: "2.7.0",
    accent: "secrets",
    summary:
      "External Secrets Operator. A ClusterSecretStore points at OpenBao and syncs KV paths into native Kubernetes Secrets consumed by external-dns, cert-manager, and applications.",
  },
  {
    id: "cert-manager",
    name: "cert-manager",
    kind: "TLS certificates",
    namespace: "cert-manager",
    version: "1.20.2",
    accent: "platform",
    summary:
      "Issues TLS certificates via Let's Encrypt ACME DNS-01 over Cloudflare, producing wildcard certs for the Gateway listeners. Uses the Cloudflare token synced by ESO.",
  },
  {
    id: "grafana",
    name: "Grafana",
    kind: "dashboards · UI",
    namespace: "observability",
    version: "86.2.3",
    accent: "observability",
    summary:
      "Dashboards and exploration UI (shipped in kube-prometheus-stack). Queries Prometheus, Loki and Tempo as datasources; exposed at grafana.infra.zingdev.xyz via the Gateway.",
  },
  {
    id: "prometheus",
    name: "Prometheus",
    kind: "metrics · TSDB",
    namespace: "observability",
    version: "86.2.3",
    accent: "observability",
    summary:
      "Metrics store (kube-prometheus-stack). Scrapes application PodMonitors, CloudNativePG, node-exporter and kube-state-metrics; 15-day retention on an hcloud volume.",
  },
  {
    id: "loki",
    name: "Loki",
    kind: "logs",
    namespace: "observability",
    version: "7.0.0",
    accent: "observability",
    summary:
      "Log store — single-binary, filesystem-backed, 7-day retention. Receives logs from the Alloy DaemonSet over OTLP and is queried by Grafana.",
  },
  {
    id: "tempo",
    name: "Tempo",
    kind: "traces",
    namespace: "observability",
    version: "1.24.4",
    accent: "observability",
    summary:
      "Trace store — monolithic, filesystem-backed, 7-day retention. Receives OTLP traces from the Alloy DaemonSet and is queried by Grafana.",
  },

  // --- application pods ---
  {
    id: "app1",
    name: "App 1",
    kind: "workload",
    accent: "apps",
    summary:
      "A deployed application workload. Apps live in their own repos and register into the cluster via reusable CI/CD and a Flux registration.",
  },
  {
    id: "app2",
    name: "App 2",
    kind: "workload",
    accent: "apps",
    summary:
      "A deployed application workload. Apps live in their own repos and register into the cluster via reusable CI/CD and a Flux registration.",
  },
  {
    id: "app3",
    name: "App 3",
    kind: "workload",
    accent: "apps",
    summary:
      "A deployed application workload. Apps live in their own repos and register into the cluster via reusable CI/CD and a Flux registration.",
  },
];

/**
 * Containment tree. `rows` reference child boxes or components — each row is
 * centred by the layout pass. Workloads nest under the node pool they run on;
 * responsibility is conveyed by each component's accent colour, not by a box.
 */
export const BOXES: BoxSpec[] = [
  {
    id: "hetzner-cloud",
    label: "HETZNER CLOUD",
    accent: "hetzner",
    kind: "cloud project · nbg1",
    summary:
      "The Hetzner Cloud project: a private 10.0.0.0/16 network with the edge load balancer, firewall, and all compute. The bootstrapping layer (network, DNS, state) is the only provider-specific part of the stack.",
    rows: [["hetzner-lb", "hetzner-firewall"], ["hetzner-compute"]],
  },
  {
    id: "hetzner-compute",
    label: "HETZNER COMPUTE",
    accent: "hetzner",
    kind: "private-only VMs",
    summary:
      "Private-only Hetzner VMs running k3s, reachable only through the bastion. Split into a control-plane pool and an autoscaled worker pool.",
    rows: [["bastion"], ["control-plane-pool"], ["worker-pool"]],
  },
  {
    id: "control-plane-pool",
    label: "K8S CONTROL PLANE NODE POOL",
    accent: "nodes",
    stretch: true,
    kind: "k3s server nodes",
    count: "×3",
    summary:
      "Three cx23 k3s server nodes (private IPs 10.0.1.10+), tainted CriticalAddonsOnly. Runs the k3s control plane plus the pre-Flux and control-plane-pinned workloads.",
    rows: [
      ["kube-system", "hetzner-ccm", "alloy", "openbao", "cluster-autoscaler"],
    ],
  },
  {
    id: "worker-pool",
    label: "K8S WORKER NODE POOL",
    accent: "nodes",
    stretch: true,
    kind: "k3s agent nodes",
    count: "1–3",
    summary:
      "The autoscaled cx33 worker pool (min 1 / max 3) managed by the cluster autoscaler. Runs Flux, the platform operators, the observability and data layers, and application workloads.",
    rows: [
      ["platform-ops"],
      ["observability-stack"],
      ["app-pods"],
      ["cnpg"],
    ],
  },
  {
    id: "platform-ops",
    label: "OPERATORS / INFRASTRUCTURE",
    accent: "platform",
    dashed: true,
    kind: "platform controllers",
    summary:
      "The GitOps and platform controllers running on the workers: the ingress gateway, the Flux reconciler, and the operators that wire the cluster to Cloudflare and OpenBao (DNS, secrets, TLS).",
    rows: [
      ["envoy-gateway", "flux"],
      ["external-dns", "external-secrets", "cert-manager"],
    ],
  },
  {
    id: "observability-stack",
    label: "OBSERVABILITY STACK",
    accent: "observability",
    dashed: true,
    kind: "grafana lgtm · namespace",
    namespace: "observability",
    summary:
      "Self-hosted Grafana LGTM observability. Grafana visualises metrics, logs and traces sourced from Prometheus, Loki and Tempo — which are in turn fed by the Alloy DaemonSet and Prometheus scraping across the cluster.",
    rows: [["grafana", "prometheus", "loki", "tempo"]],
  },
  {
    id: "app-pods",
    label: "APPLICATION PODS",
    accent: "apps",
    dashed: true,
    kind: "workloads · dev/uat/prod",
    count: "×3",
    summary:
      "Application workloads promoted through dev → uat → prod namespaces. They consume Postgres from CloudNativePG, Secrets from ESO, and emit telemetry to the observability stack.",
    rows: [["app1", "app2", "app3"]],
  },
];

/** Top-level nodes, stacked vertically and centred by the layout pass. */
export const ROOTS: string[] = ["internet", "cloudflare-dns", "hetzner-cloud"];

/**
 * Post-layout absolute horizontal shifts (applied before alignments). Pushes
 * the firewall well to the right so the admin/egress corridor is clear of the
 * central public-ingress column instead of routing behind it.
 */
export const OFFSETS: { id: string; dx: number }[] = [
  { id: "hetzner-firewall", dx: 100 },
];

/**
 * Post-layout horizontal nudges: shift `id` so its centre lines up with
 * `toId`'s centre — or, when `toId2` is given, the midpoint between the two
 * (e.g. the bastion sitting roughly between the load balancer and firewall).
 * `dx` applies an extra offset after centring.
 */
export const ALIGNMENTS: { id: string; toId: string; toId2?: string; dx?: number }[] = [
  { id: "bastion", toId: "hetzner-lb", toId2: "hetzner-firewall", dx: 30 },
  { id: "cloudflare-dns", toId: "hetzner-lb" },
];

export const EDGES: EdgeDef[] = [
  // --- public ingress: request path in ---
  {
    source: "internet",
    target: "cloudflare-dns",
    flow: "ingress",
    label: "Public Ingress",
    internetAnchor: 0.25,
  },
  { source: "cloudflare-dns", target: "hetzner-lb", flow: "ingress" },
  { source: "hetzner-lb", target: "envoy-gateway", flow: "ingress" },
  { source: "envoy-gateway", target: "app-pods", flow: "ingress" },

  // --- controlled/admin ingress ---
  {
    source: "internet",
    target: "hetzner-firewall",
    flow: "admin",
    label: "Admin Ingress",
    internetAnchor: 0.75,
    targetTopFrac: 0.14,
  },
  {
    source: "hetzner-firewall",
    target: "bastion",
    flow: "admin",
    targetTopFrac: 0.8,
    sourceBottomFrac: 0.14,
  },
  {
    source: "bastion",
    target: "control-plane-pool",
    flow: "admin",
    downFrac: 0.8,
  },

  // --- application egress: NAT back out to the internet ---
  { source: "app-pods", target: "bastion", flow: "egress", targetBottomFrac: 0.3 },
  {
    source: "bastion",
    target: "internet",
    flow: "egress",
    label: "Application Egress",
    labelDy: -8,
    internetAnchor: 0.5,
    sourceTopFrac: 0.3,
  },

  // --- internal dependency links (revealed on hover/focus) ---
  { source: "flux", target: "envoy-gateway" },
  { source: "flux", target: "external-dns" },
  { source: "flux", target: "cert-manager" },
  { source: "flux", target: "external-secrets" },
  { source: "flux", target: "openbao" },
  { source: "flux", target: "cnpg" },
  { source: "flux", target: "grafana" },
  { source: "flux", target: "prometheus" },
  { source: "flux", target: "loki" },
  { source: "flux", target: "tempo" },
  { source: "flux", target: "alloy" },
  { source: "flux", target: "app-pods" },

  { source: "external-secrets", target: "openbao" },
  { source: "external-dns", target: "external-secrets" },
  { source: "cert-manager", target: "external-secrets" },
  { source: "external-dns", target: "cloudflare-dns" },

  { source: "hetzner-ccm", target: "hetzner-lb" },
  { source: "cluster-autoscaler", target: "worker-pool" },

  // Observability: Grafana queries the three backends…
  { source: "grafana", target: "prometheus" },
  { source: "grafana", target: "loki" },
  { source: "grafana", target: "tempo" },
  // …the Alloy DaemonSet ships logs/traces into Loki/Tempo…
  { source: "alloy", target: "loki" },
  { source: "alloy", target: "tempo" },
  // …and the telemetry producers emit into the backends.
  { source: "app-pods", target: "prometheus" },
  { source: "app-pods", target: "loki" },
  { source: "app-pods", target: "tempo" },
  { source: "cnpg", target: "prometheus" },

  { source: "app1", target: "cnpg" },
  { source: "app2", target: "cnpg" },
  { source: "app3", target: "cnpg" },
  { source: "app-pods", target: "external-secrets" },
  { source: "external-dns", target: "app-pods" },
  { source: "cert-manager", target: "app-pods" },
];

// --- box-packing layout ---

const LEAF_W = 190;
const LEAF_H = 82;
const HEADER = 32;
const PAD = 32;
const GAP = 20;

const LEAF_MAP = new Map(COMPONENTS.map((c) => [c.id, c]));
const BOX_MAP = new Map(BOXES.map((b) => [b.id, b]));
const isBox = (id: string) => BOX_MAP.has(id);

export interface LaidNode {
  id: string;
  nodeKind: "group" | "component";
  parentId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent: string;
  /** dashed container border. */
  dashed?: boolean;
  /** group label (containers). */
  label?: string;
  /** leaf detail + the containing group's label. */
  component?: ComponentDef;
  groupLabel?: string;
}

function measure(
  id: string,
  cache: Map<string, { w: number; h: number }>,
): { w: number; h: number } {
  const hit = cache.get(id);
  if (hit) return hit;

  if (!isBox(id)) {
    const s = { w: LEAF_W, h: LEAF_H };
    cache.set(id, s);
    return s;
  }

  const box = BOX_MAP.get(id)!;
  let innerW = 0;
  let innerH = 0;
  box.rows.forEach((row, ri) => {
    let rowW = 0;
    let rowH = 0;
    row.forEach((cid, ci) => {
      const s = measure(cid, cache);
      rowW += s.w + (ci > 0 ? GAP : 0);
      rowH = Math.max(rowH, s.h);
    });
    innerW = Math.max(innerW, rowW);
    innerH += rowH + (ri > 0 ? GAP : 0);
  });

  const s = { w: innerW + 2 * PAD, h: HEADER + innerH + PAD };
  cache.set(id, s);
  return s;
}

/** Effective placement width of a child, honouring `stretch`. */
function childWidth(
  cid: string,
  parentInnerW: number,
  cache: Map<string, { w: number; h: number }>,
): number {
  if (isBox(cid) && BOX_MAP.get(cid)!.stretch) return parentInnerW;
  return measure(cid, cache).w;
}

function placeBox(
  id: string,
  parentId: string | undefined,
  x: number,
  y: number,
  cache: Map<string, { w: number; h: number }>,
  out: LaidNode[],
  forcedWidth?: number,
): void {
  const box = BOX_MAP.get(id)!;
  const size = measure(id, cache);
  const width = forcedWidth ?? size.w;
  out.push({
    id,
    nodeKind: "group",
    parentId,
    x,
    y,
    width,
    height: size.h,
    accent: ACCENTS[box.accent],
    dashed: box.dashed,
    label: box.label,
    // A container with a summary carries its own detail card so it stays clickable.
    ...(box.summary
      ? {
          component: {
            id: box.id,
            name: box.label,
            kind: box.kind ?? "",
            namespace: box.namespace,
            version: box.version,
            count: box.count,
            summary: box.summary,
          },
          groupLabel: RESPONSIBILITY_LABELS[box.accent],
        }
      : {}),
  });

  const innerW = width - 2 * PAD;

  let cy = HEADER;
  for (const row of box.rows) {
    let rowH = 0;
    let rowW = 0;
    for (const cid of row) {
      const cs = measure(cid, cache);
      rowH = Math.max(rowH, cs.h);
      rowW += childWidth(cid, innerW, cache);
    }
    rowW += GAP * (row.length - 1);

    // Centre the row within the box's inner width.
    let cx = PAD + (innerW - rowW) / 2;
    for (const cid of row) {
      const cs = measure(cid, cache);
      const cw = childWidth(cid, innerW, cache);
      const childY = cy + (rowH - cs.h) / 2;
      if (isBox(cid)) {
        placeBox(cid, id, cx, childY, cache, out, cw);
      } else {
        const c = LEAF_MAP.get(cid)!;
        out.push({
          id: cid,
          nodeKind: "component",
          parentId: id,
          x: cx,
          y: childY,
          width: cw,
          height: cs.h,
          accent: ACCENTS[c.accent ?? box.accent],
          component: c,
          groupLabel: RESPONSIBILITY_LABELS[c.accent ?? box.accent],
        });
      }
      cx += cw + GAP;
    }
    cy += rowH + GAP;
  }
}

const ROOT_GAP = 56;

/**
 * Produce all positioned nodes (parents precede children). Top-level nodes
 * (`ROOTS`, boxes or leaves) are stacked vertically and centred on the widest
 * one, mirroring the internet ▸ DNS ▸ cloud flow of the source diagram.
 */
export function buildLayout(): LaidNode[] {
  const cache = new Map<string, { w: number; h: number }>();
  const out: LaidNode[] = [];

  const rootIds = ROOTS.length
    ? ROOTS
    : (() => {
        const nested = new Set(BOXES.flatMap((b) => b.rows.flat()).filter(isBox));
        return BOXES.filter((b) => !nested.has(b.id)).map((b) => b.id);
      })();

  const sizes = rootIds.map((id) => measure(id, cache));
  const maxW = Math.max(0, ...sizes.map((s) => s.w));

  let y = 0;
  rootIds.forEach((id, i) => {
    const size = sizes[i];
    const x = (maxW - size.w) / 2;
    if (isBox(id)) {
      placeBox(id, undefined, x, y, cache, out);
    } else {
      const c = LEAF_MAP.get(id)!;
      out.push({
        id,
        nodeKind: "component",
        x,
        y,
        width: size.w,
        height: size.h,
        accent: ACCENTS[c.accent ?? "external"],
        component: c,
        groupLabel: RESPONSIBILITY_LABELS[c.accent ?? "external"],
      });
    }
    y += size.h + ROOT_GAP;
  });

  // Absolute centre-x of a laid node (positions are parent-relative).
  const byId = new Map(out.map((n) => [n.id, n]));
  const absCenterX = (node: LaidNode): number => {
    let x = node.x;
    let p = node.parentId;
    while (p) {
      const pn = byId.get(p);
      if (!pn) break;
      x += pn.x;
      p = pn.parentId;
    }
    return x + node.width / 2;
  };

  for (const { id, dx } of OFFSETS) {
    const node = byId.get(id);
    if (node) node.x += dx;
  }

  for (const { id, toId, toId2, dx } of ALIGNMENTS) {
    const node = byId.get(id);
    const target = byId.get(toId);
    if (!node || !target) continue;
    let targetCenter = absCenterX(target);
    if (toId2) {
      const target2 = byId.get(toId2);
      if (target2) targetCenter = (targetCenter + absCenterX(target2)) / 2;
    }
    // A horizontal translation is identical in absolute and parent-relative
    // space, so nudging the node's own x is enough (children move with it).
    node.x += targetCenter - absCenterX(node) + (dx ?? 0);
  }

  return out;
}
