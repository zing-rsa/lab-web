"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  NodeToolbar,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";

import {
  buildLayout,
  EDGES,
  FLOW_COLORS,
  type FlowKind,
  type LaidNode,
} from "@/lib/diagram-data";
import { ComponentNode } from "./ComponentNode";
import { GroupNode } from "./GroupNode";
import { FloatingEdge } from "./FloatingEdge";
import { DetailPanel, NodePopup, type Selection } from "./DetailPanel";

const nodeTypes = { component: ComponentNode, lane: GroupNode };
const edgeTypes = { floating: FloatingEdge };

const LAID = buildLayout();
const LAID_BY_ID = new Map(LAID.map((n) => [n.id, n]));

/** id -> set of directly connected component ids. */
const ADJACENCY = (() => {
  const map = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a)!.add(b);
  };
  for (const e of EDGES) {
    add(e.source, e.target);
    add(e.target, e.source);
  }
  return map;
})();

/** box id -> every component id nested anywhere beneath it. */
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

/** Undirected adjacency over ingress/egress edges only. */
const FLOW_ADJACENCY = (() => {
  const map = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a)!.add(b);
  };
  for (const e of EDGES) {
    if (!e.flow) continue;
    add(e.source, e.target);
    add(e.target, e.source);
  }
  return map;
})();

/**
 * Every node reachable from `start` by walking flow edges. Lets hovering a node
 * on the request path (e.g. the internet) light up the entire ingress + egress
 * flow through the system, not just its immediate neighbours.
 */
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

const BASE_NODES: Node[] = LAID.map((n: LaidNode) => {
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
      : {
          ...n.component,
          accent: n.accent,
          groupLabel: n.groupLabel,
        },
  };
});

const BASE_EDGES: Edge[] = EDGES.map((e) => {
  const color = e.flow ? FLOW_COLORS[e.flow] : "#5a5a5a";
  return {
    id: `${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    // At rest, flow paths sit behind the node boxes (no overlap); they're
    // elevated above the nodes only while highlighted (see the effect below).
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
    markerEnd: { type: MarkerType.ArrowClosed, width: 13, height: 13, color },
  };
});

// Fit padding reserves room for the writeup card while it's open, then frees
// that space once it's collapsed so the diagram re-centres to fill the viewport.
const FIT = {
  desktop: {
    expanded: { left: "560px", right: "48px", top: "56px", bottom: "56px" },
    collapsed: { left: "48px", right: "48px", top: "56px", bottom: "56px" },
  },
  mobile: {
    expanded: { left: "6%", right: "6%", top: "8%", bottom: "8%" },
    collapsed: { left: "6%", right: "6%", top: "8%", bottom: "8%" },
  },
} as const;

function Flow({ writeupCollapsed }: { writeupCollapsed: boolean }) {
  // Nodes/edges live in React Flow's own state so measured dimensions persist
  // across highlight updates — recreating the arrays each render wipes them and
  // makes the floating edges (and thus the whole diagram) flicker on hover.
  const [nodes, setNodes, onNodesChange] = useNodesState(BASE_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(BASE_EDGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Seed the focus on the internet node so the ingress/egress flow is lit up on
  // first load, as if it were being hovered; clears on the first interaction.
  const [hoveredId, setHoveredId] = useState<string | null>("internet");
  const [isMobile, setIsMobile] = useState(false);
  const { fitView } = useReactFlow();

  const focusId = hoveredId ?? selectedId;

  // Read the latest collapsed state without making it a fit dependency, so
  // toggling the writeup never triggers a re-fit (which would reset zoom/pan).
  const collapsedRef = useRef(writeupCollapsed);
  useEffect(() => {
    collapsedRef.current = writeupCollapsed;
  }, [writeupCollapsed]);

  const fitPadding = FIT[isMobile ? "mobile" : "desktop"][
    writeupCollapsed ? "collapsed" : "expanded"
  ];

  // Track the mobile breakpoint and re-fit only on load / breakpoint changes,
  // reserving room for the writeup based on its current collapsed state.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const padding = FIT[isMobile ? "mobile" : "desktop"][
      collapsedRef.current ? "collapsed" : "expanded"
    ];
    const id = requestAnimationFrame(() => fitView({ padding }));
    return () => cancelAnimationFrame(id);
  }, [isMobile, fitView]);

  useEffect(() => {
    // The full ingress+egress flow the focused node sits on…
    const flowSet = focusId ? flowClosure(focusId) : null;
    // …plus its direct dependency neighbours and any nested workloads.
    const connected = focusId
      ? (() => {
          const set = new Set(ADJACENCY.get(focusId) ?? []);
          for (const d of DESCENDANTS.get(focusId) ?? []) set.add(d);
          for (const f of flowSet ?? []) set.add(f);
          return set;
        })()
      : null;

    // Only replace a node/edge when its highlight state actually changes, so
    // untouched elements keep their identity (and measured size).
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type === "lane") {
          const selected = n.id === selectedId;
          const d = n.data as { selected?: boolean };
          if (d.selected === selected) return n;
          return { ...n, data: { ...n.data, selected } };
        }
        const isFocus = n.id === focusId;
        const isNeighbor = !!connected?.has(n.id);
        const selected = n.id === selectedId;
        const neighbor = !!focusId && (isFocus || isNeighbor);
        const dimmed = !!focusId && !isFocus && !isNeighbor;
        const d = n.data as {
          selected?: boolean;
          neighbor?: boolean;
          dimmed?: boolean;
        };
        if (d.selected === selected && d.neighbor === neighbor && d.dimmed === dimmed)
          return n;
        return { ...n, data: { ...n.data, selected, neighbor, dimmed } };
      }),
    );

    setEdges((eds) =>
      eds.map((e) => {
        const d = e.data as
          | { flow?: FlowKind; highlighted?: boolean; dimmed?: boolean }
          | undefined;
        // Flow edges light up when both ends sit on the focused node's flow;
        // dependency edges light up only when directly attached to the focus.
        const highlighted = focusId
          ? d?.flow
            ? !!flowSet?.has(e.source) && !!flowSet?.has(e.target)
            : e.source === focusId || e.target === focusId
          : false;
        const dimmed = !!focusId && !highlighted;
        // Elevate highlighted edges above the node boxes so the traced path is
        // crisp; otherwise they stay behind the nodes (base z-index).
        const baseZ = d?.flow ? 5 : 1;
        const zIndex = highlighted ? 24 : baseZ;
        if (
          d?.highlighted === highlighted &&
          d?.dimmed === dimmed &&
          e.zIndex === zIndex
        )
          return e;
        return { ...e, data: { ...e.data, highlighted, dimmed }, zIndex };
      }),
    );
  }, [focusId, selectedId, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    const clickable =
      node.type === "component" ||
      (node.type === "lane" && (node.data as { clickable?: boolean })?.clickable);
    if (!clickable) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev === node.id ? null : node.id));
  }, []);

  const onNodeMouseEnter: NodeMouseHandler = useCallback((_, node) => {
    if (node.type === "component") setHoveredId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => setHoveredId(null), []);
  const onPaneClick = useCallback(() => setSelectedId(null), []);

  const selection = useMemo<Selection | null>(() => {
    if (!selectedId) return null;
    const laid = LAID_BY_ID.get(selectedId);
    if (!laid?.component) return null;
    return {
      component: laid.component,
      groupLabel: laid.groupLabel ?? "",
      accent: laid.accent,
    };
  }, [selectedId]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: fitPadding }}
        minZoom={0.15}
        maxZoom={1.75}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#3a3a3a" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          className="hidden sm:block"
          bgColor="#0a0a0a"
          maskColor="rgba(20,20,20,0.55)"
          nodeColor={(n) =>
            n.type === "component"
              ? ((n.data as { accent?: string })?.accent ?? "#5a5a5a")
              : "#161616"
          }
          nodeStrokeColor="#2a2a2a"
          nodeStrokeWidth={2}
        />
        <Panel position="top-right">
          <div className="hidden flex-col gap-1.5 border border-ink-muted/30 bg-paper/85 px-3 py-2 text-[10px] leading-relaxed text-ink-faint backdrop-blur-sm sm:flex">
            <span>
              <span className="text-ink-muted">click</span> for details ·{" "}
              <span className="text-ink-muted">hover</span> to trace links ·{" "}
              <span className="text-ink-muted">scroll</span> to zoom
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-[2px] w-4"
                  style={{ backgroundColor: FLOW_COLORS.ingress }}
                />
                public ingress
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-[2px] w-4"
                  style={{ backgroundColor: FLOW_COLORS.admin }}
                />
                controlled/admin ingress
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-[2px] w-4"
                  style={{ backgroundColor: FLOW_COLORS.egress }}
                />
                application egress
              </span>
            </span>
          </div>
        </Panel>

        {/* Mobile: a compact popup anchored to the node instead of the full-
            screen slide-in, so the traced paths stay visible. */}
        {isMobile && selectedId ? (
          <NodeToolbar
            nodeId={selectedId}
            isVisible={!!selection}
            position={Position.Top}
            offset={10}
          >
            <NodePopup selection={selection} onClose={() => setSelectedId(null)} />
          </NodeToolbar>
        ) : null}
      </ReactFlow>

      {!isMobile ? (
        <DetailPanel selection={selection} onClose={() => setSelectedId(null)} />
      ) : null}
    </>
  );
}

/** Interactive nested diagram of the lab cluster. */
export function LabDiagram({ writeupCollapsed = false }: { writeupCollapsed?: boolean }) {
  return (
    <ReactFlowProvider>
      <Flow writeupCollapsed={writeupCollapsed} />
    </ReactFlowProvider>
  );
}
