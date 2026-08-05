import { ALIGNMENTS, BOXES, COMPONENTS, OFFSETS, ROOTS } from "./content";
import { ACCENTS, RESPONSIBILITY_LABELS } from "./theme";
import type { LaidNode } from "./types";

const LEAF_W = 190;
const LEAF_H = 82;
const HEADER = 32;
const PAD = 32;
const GAP = 20;
const ROOT_GAP = 56;

const LEAF_MAP = new Map(COMPONENTS.map((c) => [c.id, c]));
const BOX_MAP = new Map(BOXES.map((b) => [b.id, b]));
const isBox = (id: string) => BOX_MAP.has(id);

type Size = { w: number; h: number };

function measure(id: string, cache: Map<string, Size>): Size {
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

function childWidth(cid: string, parentInnerW: number, cache: Map<string, Size>): number {
  if (isBox(cid) && BOX_MAP.get(cid)!.stretch) return parentInnerW;
  return measure(cid, cache).w;
}

function placeBox(
  id: string,
  parentId: string | undefined,
  x: number,
  y: number,
  cache: Map<string, Size>,
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

function absCenterX(node: LaidNode, byId: Map<string, LaidNode>): number {
  let x = node.x;
  let p = node.parentId;
  while (p) {
    const pn = byId.get(p);
    if (!pn) break;
    x += pn.x;
    p = pn.parentId;
  }
  return x + node.width / 2;
}

export function buildLayout(): LaidNode[] {
  const cache = new Map<string, Size>();
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

  const byId = new Map(out.map((n) => [n.id, n]));

  for (const { id, dx } of OFFSETS) {
    const node = byId.get(id);
    if (node) node.x += dx;
  }

  for (const { id, toId, toId2, dx } of ALIGNMENTS) {
    const node = byId.get(id);
    const target = byId.get(toId);
    if (!node || !target) continue;
    let targetCenter = absCenterX(target, byId);
    if (toId2) {
      const target2 = byId.get(toId2);
      if (target2) targetCenter = (targetCenter + absCenterX(target2, byId)) / 2;
    }
    node.x += targetCenter - absCenterX(node, byId) + (dx ?? 0);
  }

  return out;
}
