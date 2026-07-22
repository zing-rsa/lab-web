import { Position, type InternalNode } from "@xyflow/react";

/**
 * Floating-edge geometry: connect two nodes at the middle of whichever side
 * faces the other node, so every edge leaves/enters from the centre of a
 * rectangle edge rather than an arbitrary border point.
 */

function dims(node: InternalNode) {
  return {
    w: node.measured?.width ?? 0,
    h: node.measured?.height ?? 0,
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
  };
}

/** Absolute rect of a node, for custom edge anchoring/routing. */
export function nodeRect(node: InternalNode) {
  return dims(node);
}

/** Midpoint of the side of `node` that faces `other`. */
function sideMidpoint(node: InternalNode, other: InternalNode) {
  const a = dims(node);
  const b = dims(other);

  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  const dx = b.x + b.w / 2 - cx;
  const dy = b.y + b.h / 2 - cy;

  // Pick left/right vs top/bottom by comparing the direction against the
  // rectangle's aspect ratio, then snap to that side's centre.
  if (Math.abs(dx) * a.h >= Math.abs(dy) * a.w) {
    return dx >= 0
      ? { x: a.x + a.w, y: cy, pos: Position.Right }
      : { x: a.x, y: cy, pos: Position.Left };
  }
  return dy >= 0
    ? { x: cx, y: a.y + a.h, pos: Position.Bottom }
    : { x: cx, y: a.y, pos: Position.Top };
}

export function getEdgeParams(source: InternalNode, target: InternalNode) {
  const s = sideMidpoint(source, target);
  const t = sideMidpoint(target, source);

  return {
    sx: s.x,
    sy: s.y,
    tx: t.x,
    ty: t.y,
    sourcePos: s.pos,
    targetPos: t.pos,
  };
}
