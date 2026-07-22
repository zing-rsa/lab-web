import {
  getBezierPath,
  useInternalNode,
  EdgeLabelRenderer,
  Position,
  type EdgeProps,
} from "@xyflow/react";
import { FLOW_COLORS, type FlowKind } from "@/lib/diagram-data";
import { getEdgeParams, nodeRect } from "./edge-geometry";

export interface FloatingEdgeData {
  flow?: FlowKind;
  label?: string;
  internetAnchor?: number;
  downFrac?: number;
  targetTopFrac?: number;
  highlighted: boolean;
  dimmed: boolean;
  [key: string]: unknown;
}

/** Perpendicular lane per flow, so the three routes never sit on top of each other. */
const FLOW_OFFSET: Record<FlowKind, number> = {
  ingress: -14,
  admin: 0,
  egress: 16,
};

/**
 * Center-to-center bezier edge. Ingress/egress flows are always drawn, coloured
 * and animated; dependency edges are hidden until a connected node is focused.
 */
export function FloatingEdge({
  id,
  source,
  target,
  markerEnd,
  data,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const params = getEdgeParams(sourceNode, targetNode);
  let { sx, sy, tx, ty, sourcePos, targetPos } = params;

  const d = (data ?? {}) as FloatingEdgeData;
  const isFlow = !!d.flow;
  let anchored = false;

  // Route straight down: exit the source's bottom edge and drop into the
  // target's top edge (e.g. bastion -> control plane).
  if (typeof d.downFrac === "number") {
    const s = nodeRect(sourceNode);
    const t = nodeRect(targetNode);
    sx = s.x + s.w * d.downFrac;
    sy = s.y + s.h;
    tx = sx;
    ty = t.y;
    sourcePos = Position.Bottom;
    targetPos = Position.Top;
    anchored = true;
  }

  // Enter the target on its top edge at a set x-fraction (align with a
  // downstream exit rather than snapping to the side midpoint).
  if (typeof d.targetTopFrac === "number") {
    const t = nodeRect(targetNode);
    tx = t.x + t.w * d.targetTopFrac;
    ty = t.y;
    targetPos = Position.Top;
    anchored = true;
  }

  // Fan the flows out of the internet node's bottom edge with even spacing.
  if (typeof d.internetAnchor === "number") {
    if (source === "internet") {
      const i = nodeRect(sourceNode);
      sx = i.x + i.w * d.internetAnchor;
      sy = i.y + i.h;
      sourcePos = Position.Bottom;
    } else if (target === "internet") {
      const i = nodeRect(targetNode);
      tx = i.x + i.w * d.internetAnchor;
      ty = i.y + i.h;
      targetPos = Position.Bottom;
    }
    anchored = true;
  }

  // Split the flows into separate lanes so anti-parallel or collinear routes
  // never overlap: shift each endpoint along the edge normal by a per-flow
  // amount, using a screen-consistent normal orientation.
  if (isFlow && !anchored) {
    const dx = tx - sx;
    const dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (nx < 0 || (nx === 0 && ny < 0)) {
      nx = -nx;
      ny = -ny;
    }
    const off = FLOW_OFFSET[d.flow!];
    sx += nx * off;
    sy += ny * off;
    tx += nx * off;
    ty += ny * off;
  }

  const [path, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    targetX: tx,
    targetY: ty,
    curvature: 0.3,
  });

  let stroke = "#5a5a5a";
  let opacity = 0;
  let width = 1;
  let animated = false;

  if (isFlow) {
    stroke = FLOW_COLORS[d.flow!];
    if (d.dimmed) {
      opacity = 0.18;
      width = 1;
    } else if (d.highlighted) {
      // On the traced flow: brightest and thickest.
      opacity = 1;
      width = 2.4;
      animated = true;
    } else {
      opacity = 0.95;
      width = 1.6;
      animated = true;
    }
  } else if (d.highlighted) {
    stroke = "#e8e8e8";
    opacity = 0.9;
    width = 1.4;
    animated = true;
  }

  if (opacity === 0) return null;

  return (
    <>
      <path
        id={id}
        d={path}
        fill="none"
        markerEnd={markerEnd}
        stroke={stroke}
        strokeWidth={width}
        strokeOpacity={opacity}
        strokeDasharray={animated ? "6 6" : undefined}
        className={animated ? "animate-dash" : undefined}
      />
      {isFlow && d.label && !d.dimmed ? (
        <EdgeLabelRenderer>
          <div
            className="absolute whitespace-nowrap rounded border bg-paper/90 px-1.5 py-0.5 text-[9px] font-medium tracking-wide backdrop-blur-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              color: stroke,
              borderColor: `${stroke}66`,
              pointerEvents: "none",
            }}
          >
            {d.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
