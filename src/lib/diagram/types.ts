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
  | "apps"
  | "events";

export type FlowKind = "ingress" | "egress" | "admin";

export interface ComponentDef {
  id: string;
  name: string;
  kind: string;
  namespace?: string;
  version?: string;
  count?: string;
  summary: string;
  accent?: AccentKey;
  compact?: boolean;
}

export interface BoxSpec {
  id: string;
  label: string;
  accent: AccentKey;
  dashed?: boolean;
  stretch?: boolean;
  rows: string[][];
  kind?: string;
  namespace?: string;
  version?: string;
  count?: string;
  summary?: string;
}

export interface EdgeDef {
  source: string;
  target: string;
  flow?: FlowKind;
  label?: string;
  labelDy?: number;
  internetAnchor?: number;
  downFrac?: number;
  targetTopFrac?: number;
  targetBottomFrac?: number;
  sourceTopFrac?: number;
  sourceBottomFrac?: number;
}

export interface LaidNode {
  id: string;
  nodeKind: "group" | "component";
  parentId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent: string;
  dashed?: boolean;
  label?: string;
  component?: ComponentDef;
  groupLabel?: string;
}
