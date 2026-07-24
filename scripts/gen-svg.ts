/**
 * Generates a static SVG of the lab diagram from the same layout/data the
 * React Flow canvas uses, so boxes, nodes, accents and the ingress/egress
 * flows all match. Run: `bunx tsx scripts/gen-svg.ts`.
 */
import { writeFileSync } from "node:fs";
import {
  buildLayout,
  EDGES,
  ACCENTS,
  FLOW_COLORS,
  type EdgeDef,
  type FlowKind,
  type LaidNode,
} from "../src/lib/diagram-data";

const PALETTE = {
  ink: "#e8e8e8",
  inkMuted: "#8a8a8a",
  inkFaint: "#5a5a5a",
  paper: "#0a0a0a",
};
const FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";

const laid = buildLayout();
const byId = new Map(laid.map((n) => [n.id, n]));

// Absolute rect (layout positions are parent-relative).
interface Rect { x: number; y: number; w: number; h: number }
function rect(id: string): Rect {
  const n = byId.get(id)!;
  let x = n.x;
  let y = n.y;
  let p = n.parentId;
  while (p) {
    const pn = byId.get(p);
    if (!pn) break;
    x += pn.x;
    y += pn.y;
    p = pn.parentId;
  }
  return { x, y, w: n.width, h: n.height };
}

// --- edge geometry (ported from edge-geometry.ts + FloatingEdge.tsx) ---
type Pos = "top" | "bottom" | "left" | "right";

function sideMidpoint(a: Rect, b: Rect): { x: number; y: number; pos: Pos } {
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  const dx = b.x + b.w / 2 - cx;
  const dy = b.y + b.h / 2 - cy;
  if (Math.abs(dx) * a.h >= Math.abs(dy) * a.w) {
    return dx >= 0
      ? { x: a.x + a.w, y: cy, pos: "right" }
      : { x: a.x, y: cy, pos: "left" };
  }
  return dy >= 0
    ? { x: cx, y: a.y + a.h, pos: "bottom" }
    : { x: cx, y: a.y, pos: "top" };
}

const FLOW_OFFSET: Record<FlowKind, number> = { ingress: -14, admin: 0, egress: 16 };

interface EdgeGeom {
  sx: number; sy: number; tx: number; ty: number;
  sp: Pos; tp: Pos;
}
function edgeGeom(e: EdgeDef): EdgeGeom {
  const s = rect(e.source);
  const t = rect(e.target);
  const sm = sideMidpoint(s, t);
  const tm = sideMidpoint(t, s);
  let sx = sm.x, sy = sm.y, sp = sm.pos;
  let tx = tm.x, ty = tm.y, tp = tm.pos;
  let anchored = false;

  if (typeof e.downFrac === "number") {
    sx = s.x + s.w * e.downFrac; sy = s.y + s.h; tx = sx; ty = t.y;
    sp = "bottom"; tp = "top"; anchored = true;
  }
  if (typeof e.targetTopFrac === "number") {
    tx = t.x + t.w * e.targetTopFrac; ty = t.y; tp = "top"; anchored = true;
  }
  if (typeof e.targetBottomFrac === "number") {
    tx = t.x + t.w * e.targetBottomFrac; ty = t.y + t.h; tp = "bottom"; anchored = true;
  }
  if (typeof e.sourceTopFrac === "number") {
    sx = s.x + s.w * e.sourceTopFrac; sy = s.y; sp = "top"; anchored = true;
  }
  if (typeof e.sourceBottomFrac === "number") {
    sx = s.x + s.w * e.sourceBottomFrac; sy = s.y + s.h; sp = "bottom"; anchored = true;
  }
  if (typeof e.internetAnchor === "number") {
    if (e.source === "internet") {
      sx = s.x + s.w * e.internetAnchor; sy = s.y + s.h; sp = "bottom";
    } else if (e.target === "internet") {
      tx = t.x + t.w * e.internetAnchor; ty = t.y + t.h; tp = "bottom";
    }
    anchored = true;
  }
  if (e.flow && !anchored) {
    const dx = tx - sx, dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if (nx < 0 || (nx === 0 && ny < 0)) { nx = -nx; ny = -ny; }
    const off = FLOW_OFFSET[e.flow];
    sx += nx * off; sy += ny * off; tx += nx * off; ty += ny * off;
  }
  return { sx, sy, tx, ty, sp, tp };
}

const CURV = 0.3;
function ctrlOffset(distance: number): number {
  return distance >= 0 ? 0.5 * distance : CURV * 25 * Math.sqrt(-distance);
}
function control(pos: Pos, x1: number, y1: number, x2: number, y2: number): [number, number] {
  switch (pos) {
    case "left": return [x1 - ctrlOffset(x1 - x2), y1];
    case "right": return [x1 + ctrlOffset(x2 - x1), y1];
    case "top": return [x1, y1 - ctrlOffset(y1 - y2)];
    case "bottom": return [x1, y1 + ctrlOffset(y2 - y1)];
  }
}
function bezier(g: EdgeGeom) {
  const [c1x, c1y] = control(g.sp, g.sx, g.sy, g.tx, g.ty);
  const [c2x, c2y] = control(g.tp, g.tx, g.ty, g.sx, g.sy);
  const path = `M${g.sx},${g.sy} C${c1x},${c1y} ${c2x},${c2y} ${g.tx},${g.ty}`;
  // Cubic bezier midpoint (t=0.5).
  const cx = 0.125 * g.sx + 0.375 * c1x + 0.375 * c2x + 0.125 * g.tx;
  const cy = 0.125 * g.sy + 0.375 * c1y + 0.375 * c2y + 0.125 * g.ty;
  return { path, cx, cy };
}

// --- helpers ---
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function truncate(s: string, maxW: number, charW: number): string {
  const max = Math.floor(maxW / charW);
  return s.length <= max ? s : s.slice(0, Math.max(1, max - 1)) + "…";
}

// --- viewBox from node + edge extents ---
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const n of laid) {
  const r = rect(n.id);
  minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
  maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h);
}
const flowEdges = EDGES.filter((e) => e.flow);
const geoms = flowEdges.map((e) => ({ e, g: edgeGeom(e), b: bezier(edgeGeom(e)) }));
for (const { g } of geoms) {
  minX = Math.min(minX, g.sx, g.tx); minY = Math.min(minY, g.sy, g.ty);
  maxX = Math.max(maxX, g.sx, g.tx); maxY = Math.max(maxY, g.sy, g.ty);
}
const PAD = 40;
const vbX = Math.floor(minX - PAD);
const vbY = Math.floor(minY - PAD);
const vbW = Math.ceil(maxX - minX + PAD * 2);
const vbH = Math.ceil(maxY - minY + PAD * 2);

// --- build svg ---
const out: string[] = [];
out.push(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" font-family="${FONT}">`,
);

// arrowhead markers, one per flow colour
out.push(`<defs>`);
for (const [kind, color] of Object.entries(FLOW_COLORS)) {
  out.push(
    `<marker id="arrow-${kind}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`,
  );
}
out.push(`</defs>`);

// group boxes (parents first — laid order already has parents before children)
const groups = laid.filter((n) => n.nodeKind === "group");
const comps = laid.filter((n) => n.nodeKind === "component");

out.push(`<g>`); // groups
for (const n of groups) {
  const r = rect(n.id);
  out.push(
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6" fill="${n.accent}" fill-opacity="0.04" stroke="${n.accent}" stroke-opacity="0.35" stroke-width="1"${n.dashed ? ' stroke-dasharray="5 4"' : ""}/>`,
  );
  if (n.label)
    out.push(
      `<text x="${r.x + 12}" y="${r.y + 18}" font-size="11" font-weight="500" letter-spacing="2" fill="${n.accent}" fill-opacity="0.85">${esc(n.label)}</text>`,
    );
}
out.push(`</g>`);

// flow edges (under nodes, like the resting state of the canvas)
out.push(`<g fill="none" stroke-width="1.6">`);
for (const { e, b } of geoms) {
  const color = FLOW_COLORS[e.flow!];
  out.push(
    `<path d="${b.path}" stroke="${color}" marker-end="url(#arrow-${e.flow})"/>`,
  );
}
out.push(`</g>`);

// component nodes
out.push(`<g>`);
for (const n of comps) {
  const r = rect(n.id);
  const c = n.component!;
  const innerLeft = r.x + 14;
  const innerRight = r.x + r.w - 12;
  const innerW = innerRight - innerLeft;
  out.push(`<g>`);
  out.push(
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${PALETTE.paper}" stroke="${PALETTE.inkMuted}" stroke-opacity="0.4" stroke-width="1"/>`,
  );
  out.push(
    `<rect x="${r.x}" y="${r.y}" width="3" height="${r.h}" fill="${n.accent}"/>`,
  );
  // name (+ optional count badge on the right)
  const badgeW = c.count ? c.count.length * 6 + 8 : 0;
  const nameW = innerW - (badgeW ? badgeW + 6 : 0);
  out.push(
    `<text x="${innerLeft}" y="${r.y + 20}" font-size="13" fill="${PALETTE.ink}">${esc(truncate(c.name, nameW, 7.6))}</text>`,
  );
  if (c.count) {
    const bx = innerRight - badgeW;
    out.push(
      `<rect x="${bx}" y="${r.y + 11}" width="${badgeW}" height="13" fill="none" stroke="${n.accent}" stroke-opacity="0.5"/>`,
      `<text x="${bx + 4}" y="${r.y + 21}" font-size="9" fill="${n.accent}" fill-opacity="0.9">${esc(c.count)}</text>`,
    );
  }
  out.push(
    `<text x="${innerLeft}" y="${r.y + 38}" font-size="10" fill="${PALETTE.inkMuted}">${esc(truncate(c.kind, innerW, 6))}</text>`,
  );
  if (c.namespace)
    out.push(
      `<text x="${innerLeft}" y="${r.y + r.h - 8}" font-size="9" fill="${PALETTE.inkFaint}">${esc(truncate(c.namespace, innerW - 40, 5.4))}</text>`,
    );
  if (c.version)
    out.push(
      `<text x="${innerRight}" y="${r.y + r.h - 8}" font-size="9" text-anchor="end" fill="${PALETTE.inkFaint}">${esc(c.version)}</text>`,
    );
  out.push(`</g>`);
}
out.push(`</g>`);

// flow labels (on top)
out.push(`<g>`);
for (const { e, b } of geoms) {
  if (!e.label) continue;
  const color = FLOW_COLORS[e.flow!];
  const y = b.cy + (e.labelDy ?? 0);
  const w = e.label.length * 6.2 + 10;
  out.push(
    `<rect x="${b.cx - w / 2}" y="${y - 9}" width="${w}" height="15" rx="2" fill="${PALETTE.paper}" fill-opacity="0.9" stroke="${color}" stroke-opacity="0.4"/>`,
    `<text x="${b.cx}" y="${y + 2}" font-size="9" font-weight="500" text-anchor="middle" fill="${color}">${esc(e.label)}</text>`,
  );
}
out.push(`</g>`);

out.push(`</svg>`);

const svg = out.join("\n");
writeFileSync("public/lab-diagram.svg", svg);
console.log(`wrote public/lab-diagram.svg (${svg.length} bytes, viewBox ${vbX} ${vbY} ${vbW} ${vbH})`);
