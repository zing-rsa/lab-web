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
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";

import {
  BASE_EDGES,
  BASE_NODES,
  DEPENDENCY_EDGE_COLOR,
  LAID_BY_ID,
  WORKER_POD_IDS,
  podBoxWidth,
  podBoxX,
  neighbourhood,
  type FlowKind,
} from "@/lib/diagram";
import { ComponentNode } from "./ComponentNode";
import { GroupNode } from "./GroupNode";
import { FloatingEdge } from "./FloatingEdge";
import { Legend } from "./Legend";
import { DetailPanel, NodePopup, type Selection } from "./DetailPanel";

const nodeTypes = { component: ComponentNode, lane: GroupNode };
const edgeTypes = { floating: FloatingEdge };

const MAX_WORKER_PODS = WORKER_POD_IDS.length;

// Purple "live load" path shown only while *this* tab is generating load: it follows the ingress
// line to the Envoy gateway, diverts into the load-demo gateway, through NATS, then fans out to
// each live worker pod (one edge per visible pod).
const LOADPATH_PREFIX = "loadpath-";
const LOADPATH_COLOR = "#b794f6";

function buildLoadPathEdges(podCount: number): Edge[] {
  const mk = (source: string, target: string, extra: Record<string, unknown> = {}): Edge => ({
    id: `${LOADPATH_PREFIX}${source}-${target}`,
    source,
    target,
    type: "floating",
    zIndex: 40,
    data: { loadpath: true, ...extra },
    markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: LOADPATH_COLOR },
  });

  const edges: Edge[] = [
    mk("internet", "cloudflare-dns", { internetAnchor: 0.25 }),
    mk("cloudflare-dns", "hetzner-lb"),
    mk("hetzner-lb", "envoy-gateway"),
    mk("envoy-gateway", "load-demo-gateway"),
    mk("load-demo-gateway", "nats"),
  ];
  for (let i = 0; i < podCount; i++) edges.push(mk("nats", WORKER_POD_IDS[i]));
  return edges;
}

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

interface FlowProps {
  writeupCollapsed: boolean;
  localLoad: boolean;
  replicas: number;
}

function Flow({ writeupCollapsed, localLoad, replicas }: FlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(BASE_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(BASE_EDGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>("internet");
  const [isMobile, setIsMobile] = useState(false);
  const { fitView } = useReactFlow();

  const focusId = hoveredId ?? selectedId;

  const collapsedRef = useRef(writeupCollapsed);
  useEffect(() => {
    collapsedRef.current = writeupCollapsed;
  }, [writeupCollapsed]);

  const fitPadding =
    FIT[isMobile ? "mobile" : "desktop"][writeupCollapsed ? "collapsed" : "expanded"];

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const padding =
      FIT[isMobile ? "mobile" : "desktop"][collapsedRef.current ? "collapsed" : "expanded"];
    const id = requestAnimationFrame(() => fitView({ padding }));
    return () => cancelAnimationFrame(id);
  }, [isMobile, fitView]);

  useEffect(() => {
    const { flowSet, connected } = focusId
      ? neighbourhood(focusId)
      : { flowSet: null, connected: null };

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
        const d = n.data as { selected?: boolean; neighbor?: boolean; dimmed?: boolean };
        if (d.selected === selected && d.neighbor === neighbor && d.dimmed === dimmed)
          return n;
        return { ...n, data: { ...n.data, selected, neighbor, dimmed } };
      }),
    );

    setEdges((eds) =>
      eds.map((e) => {
        if (e.id.startsWith(LOADPATH_PREFIX)) return e;
        const d = e.data as
          | { flow?: FlowKind; highlighted?: boolean; dimmed?: boolean }
          | undefined;
        const highlighted = focusId
          ? d?.flow
            ? !!flowSet?.has(e.source) && !!flowSet?.has(e.target)
            : e.source === focusId || e.target === focusId
          : false;
        const dimmed = !!focusId && !highlighted;
        const baseZ = d?.flow ? 5 : 1;
        const zIndex = highlighted ? 24 : baseZ;
        if (d?.highlighted === highlighted && d?.dimmed === dimmed && e.zIndex === zIndex)
          return e;
        return { ...e, data: { ...e.data, highlighted, dimmed }, zIndex };
      }),
    );
  }, [focusId, selectedId, setNodes, setEdges]);

  const podCount = Math.max(1, Math.min(MAX_WORKER_PODS, replicas));

  // Add/remove the purple live-load path edges as this tab starts/stops generating load.
  useEffect(() => {
    setEdges((eds) => {
      const base = eds.filter((e) => !e.id.startsWith(LOADPATH_PREFIX));
      return localLoad ? [...base, ...buildLoadPathEdges(podCount)] : base;
    });
  }, [localLoad, podCount, setEdges]);

  // Grow/shrink the pod-pool box to fit the live replica count (kept centred in app-pods) and
  // fade pods in/out with it.
  useEffect(() => {
    const boxW = podBoxWidth(podCount);
    const boxX = podBoxX(podCount);
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === "load-demo-pods") {
          if (n.style?.width === boxW && n.position.x === boxX) return n;
          return { ...n, position: { ...n.position, x: boxX }, style: { ...n.style, width: boxW } };
        }
        const idx = WORKER_POD_IDS.indexOf(n.id);
        if (idx === -1) return n;
        const visible = idx < podCount;
        const d = n.data as { visible?: boolean };
        const pointerEvents = visible ? "auto" : "none";
        if (d.visible === visible && n.style?.pointerEvents === pointerEvents) return n;
        return {
          ...n,
          style: { ...n.style, pointerEvents },
          data: { ...n.data, visible },
        };
      }),
    );
  }, [podCount, setNodes]);

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
              ? ((n.data as { accent?: string })?.accent ?? DEPENDENCY_EDGE_COLOR)
              : "#161616"
          }
          nodeStrokeColor="#2a2a2a"
          nodeStrokeWidth={2}
        />
        <Panel position="top-right">
          <Legend />
        </Panel>

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

interface LabDiagramProps {
  writeupCollapsed?: boolean;
  localLoad?: boolean;
  replicas?: number;
}

export function LabDiagram({
  writeupCollapsed = false,
  localLoad = false,
  replicas = 1,
}: LabDiagramProps) {
  return (
    <ReactFlowProvider>
      <Flow
        writeupCollapsed={writeupCollapsed}
        localLoad={localLoad}
        replicas={replicas}
      />
    </ReactFlowProvider>
  );
}
