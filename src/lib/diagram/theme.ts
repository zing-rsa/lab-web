import type { AccentKey, FlowKind } from "./types";

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

export const DEPENDENCY_EDGE_COLOR = "#5a5a5a";
