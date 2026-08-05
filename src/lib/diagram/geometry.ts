import { DEPENDENCY_EDGE_COLOR, FLOW_COLORS } from "./theme";
import type { EdgeDef, FlowKind } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Side = "top" | "bottom" | "left" | "right";

export interface Endpoints {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourceSide: Side;
  targetSide: Side;
}

const FLOW_OFFSET: Record<FlowKind, number> = {
  ingress: -14,
  admin: 0,
  egress: 16,
};

export function flowStroke(flow?: FlowKind): string {
  return flow ? FLOW_COLORS[flow] : DEPENDENCY_EDGE_COLOR;
}

function sideMidpoint(a: Rect, b: Rect): { x: number; y: number; side: Side } {
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  const dx = b.x + b.w / 2 - cx;
  const dy = b.y + b.h / 2 - cy;

  if (Math.abs(dx) * a.h >= Math.abs(dy) * a.w) {
    return dx >= 0
      ? { x: a.x + a.w, y: cy, side: "right" }
      : { x: a.x, y: cy, side: "left" };
  }
  return dy >= 0
    ? { x: cx, y: a.y + a.h, side: "bottom" }
    : { x: cx, y: a.y, side: "top" };
}

export function resolveEndpoints(edge: EdgeDef, s: Rect, t: Rect): Endpoints {
  const sm = sideMidpoint(s, t);
  const tm = sideMidpoint(t, s);
  let sx = sm.x,
    sy = sm.y,
    sourceSide = sm.side;
  let tx = tm.x,
    ty = tm.y,
    targetSide = tm.side;
  let anchored = false;

  if (typeof edge.downFrac === "number") {
    sx = s.x + s.w * edge.downFrac;
    sy = s.y + s.h;
    tx = sx;
    ty = t.y;
    sourceSide = "bottom";
    targetSide = "top";
    anchored = true;
  }

  if (typeof edge.targetTopFrac === "number") {
    tx = t.x + t.w * edge.targetTopFrac;
    ty = t.y;
    targetSide = "top";
    anchored = true;
  }

  if (typeof edge.targetBottomFrac === "number") {
    tx = t.x + t.w * edge.targetBottomFrac;
    ty = t.y + t.h;
    targetSide = "bottom";
    anchored = true;
  }

  if (typeof edge.sourceTopFrac === "number") {
    sx = s.x + s.w * edge.sourceTopFrac;
    sy = s.y;
    sourceSide = "top";
    anchored = true;
  }

  if (typeof edge.sourceBottomFrac === "number") {
    sx = s.x + s.w * edge.sourceBottomFrac;
    sy = s.y + s.h;
    sourceSide = "bottom";
    anchored = true;
  }

  if (typeof edge.internetAnchor === "number") {
    if (edge.source === "internet") {
      sx = s.x + s.w * edge.internetAnchor;
      sy = s.y + s.h;
      sourceSide = "bottom";
    } else if (edge.target === "internet") {
      tx = t.x + t.w * edge.internetAnchor;
      ty = t.y + t.h;
      targetSide = "bottom";
    }
    anchored = true;
  }

  if (edge.flow && !anchored) {
    const dx = tx - sx;
    const dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (nx < 0 || (nx === 0 && ny < 0)) {
      nx = -nx;
      ny = -ny;
    }
    const off = FLOW_OFFSET[edge.flow];
    sx += nx * off;
    sy += ny * off;
    tx += nx * off;
    ty += ny * off;
  }

  return { sx, sy, tx, ty, sourceSide, targetSide };
}
