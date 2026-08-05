import type { BoxSpec, ComponentDef, EdgeDef } from "./types";

export const COMPONENTS: ComponentDef[] = [
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
    rows: [["platform-ops"], ["observability-stack"], ["app-pods"], ["cnpg"]],
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

export const ROOTS: string[] = ["internet", "cloudflare-dns", "hetzner-cloud"];

export const OFFSETS: { id: string; dx: number }[] = [{ id: "hetzner-firewall", dx: 100 }];

export const ALIGNMENTS: { id: string; toId: string; toId2?: string; dx?: number }[] = [
  { id: "bastion", toId: "hetzner-lb", toId2: "hetzner-firewall", dx: 30 },
  { id: "cloudflare-dns", toId: "hetzner-lb" },
];

export const EDGES: EdgeDef[] = [
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

  { source: "grafana", target: "prometheus" },
  { source: "grafana", target: "loki" },
  { source: "grafana", target: "tempo" },
  { source: "alloy", target: "loki" },
  { source: "alloy", target: "tempo" },
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
