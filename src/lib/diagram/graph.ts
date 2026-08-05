import { EDGES } from "./content";
import { LAID, LAID_BY_ID } from "./model";

function undirected(filter: (source: string, target: string, flow?: string) => boolean) {
  const map = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a)!.add(b);
  };
  for (const e of EDGES) {
    if (!filter(e.source, e.target, e.flow)) continue;
    add(e.source, e.target);
    add(e.target, e.source);
  }
  return map;
}

const ADJACENCY = undirected(() => true);

const FLOW_ADJACENCY = undirected((_s, _t, flow) => !!flow);

const DESCENDANTS = (() => {
  const map = new Map<string, Set<string>>();
  for (const n of LAID) {
    if (n.nodeKind !== "component") continue;
    let p = n.parentId;
    while (p) {
      if (!map.has(p)) map.set(p, new Set());
      map.get(p)!.add(n.id);
      p = LAID_BY_ID.get(p)?.parentId;
    }
  }
  return map;
})();

function flowClosure(start: string): Set<string> {
  const seen = new Set<string>();
  if (!FLOW_ADJACENCY.has(start)) return seen;
  const stack = [start];
  seen.add(start);
  while (stack.length) {
    const n = stack.pop()!;
    for (const m of FLOW_ADJACENCY.get(n) ?? []) {
      if (!seen.has(m)) {
        seen.add(m);
        stack.push(m);
      }
    }
  }
  return seen;
}

export interface Neighbourhood {
  flowSet: Set<string>;
  connected: Set<string>;
}

export function neighbourhood(focusId: string): Neighbourhood {
  const flowSet = flowClosure(focusId);
  const connected = new Set(ADJACENCY.get(focusId) ?? []);
  for (const d of DESCENDANTS.get(focusId) ?? []) connected.add(d);
  for (const f of flowSet) connected.add(f);
  return { flowSet, connected };
}
