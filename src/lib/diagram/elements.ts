import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { EDGES } from "./content";
import { LAID } from "./model";
import { flowStroke } from "./geometry";
import type { LaidNode } from "./types";

export const BASE_NODES: Node[] = LAID.map((n: LaidNode) => {
  const isGroup = n.nodeKind === "group";
  return {
    id: n.id,
    type: isGroup ? "lane" : "component",
    parentId: n.parentId,
    ...(n.parentId ? { extent: "parent" as const } : {}),
    position: { x: n.x, y: n.y },
    draggable: false,
    selectable: false,
    zIndex: isGroup ? 0 : 10,
    style: { width: n.width, height: n.height },
    data: isGroup
      ? { label: n.label, accent: n.accent, dashed: n.dashed, clickable: !!n.component }
      : { ...n.component, accent: n.accent, groupLabel: n.groupLabel },
  };
});

export const BASE_EDGES: Edge[] = EDGES.map((e) => ({
  id: `${e.source}-${e.target}`,
  source: e.source,
  target: e.target,
  type: "floating",
  zIndex: e.flow ? 5 : 1,
  data: {
    flow: e.flow,
    label: e.label,
    labelDy: e.labelDy,
    internetAnchor: e.internetAnchor,
    downFrac: e.downFrac,
    targetTopFrac: e.targetTopFrac,
    targetBottomFrac: e.targetBottomFrac,
    sourceTopFrac: e.sourceTopFrac,
    sourceBottomFrac: e.sourceBottomFrac,
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 13,
    height: 13,
    color: flowStroke(e.flow),
  },
}));
