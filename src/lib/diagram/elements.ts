import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { EDGES } from "./content";
import { LAID, LAID_BY_ID } from "./model";
import { flowStroke } from "./geometry";
import type { LaidNode } from "./types";

// The load-demo pod pool is scaled live: it starts sized for a single pod and grows/shrinks with
// KEDA. Pods aren't extent-clamped so hidden ones can sit past the box edge while it contracts.
export const WORKER_POD_IDS = ["ldw-1", "ldw-2", "ldw-3", "ldw-4", "ldw-5"];
export const POD_STEP =
  (LAID_BY_ID.get("ldw-2")?.x ?? 0) - (LAID_BY_ID.get("ldw-1")?.x ?? 0);
export const POD_BOX_FULL_W = LAID_BY_ID.get("load-demo-pods")?.width ?? 0;
// x of the box at full width (centered in app-pods by the layout engine).
const POD_BOX_FULL_X = LAID_BY_ID.get("load-demo-pods")?.x ?? 0;
export const podBoxWidth = (podCount: number) =>
  POD_BOX_FULL_W - (WORKER_POD_IDS.length - podCount) * POD_STEP;
// Keep the (narrower) box centered on the full-width footprint as it grows/shrinks.
export const podBoxX = (podCount: number) =>
  POD_BOX_FULL_X + (POD_BOX_FULL_W - podBoxWidth(podCount)) / 2;
// x (within the box) of the Nth pod slot. Hidden pods are packed onto the last visible slot so
// they never extend the graph bounds (which would throw off fitView centering).
const POD_FIRST_X = LAID_BY_ID.get("ldw-1")?.x ?? 0;
export const podSlotX = (slot: number) => POD_FIRST_X + slot * POD_STEP;

export const BASE_NODES: Node[] = LAID.map((n: LaidNode) => {
  const isGroup = n.nodeKind === "group";
  const isPod = WORKER_POD_IDS.includes(n.id);
  const isPodBox = n.id === "load-demo-pods";
  return {
    id: n.id,
    type: isGroup ? "lane" : "component",
    parentId: n.parentId,
    ...(n.parentId && !isPod ? { extent: "parent" as const } : {}),
    // Start sized for one pod: box + its lone worker centred, the four hidden pods packed on slot 0.
    // Grow/shrink transitions are enabled after mount (in LabDiagram) so nodes don't fly in on load.
    position: { x: isPodBox ? podBoxX(1) : isPod ? podSlotX(0) : n.x, y: n.y },
    draggable: false,
    selectable: false,
    zIndex: isGroup ? 0 : 10,
    style: {
      width: isPodBox ? podBoxWidth(1) : n.width,
      height: n.height,
      ...(isPod ? { pointerEvents: n.id === "ldw-1" ? "auto" : "none" } : {}),
    },
    data: isGroup
      ? { label: n.label, accent: n.accent, dashed: n.dashed, clickable: !!n.component }
      : {
          ...n.component,
          accent: n.accent,
          groupLabel: n.groupLabel,
          ...(isPod ? { visible: n.id === "ldw-1" } : {}),
        },
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
