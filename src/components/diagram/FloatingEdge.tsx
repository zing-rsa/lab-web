import {
  getBezierPath,
  useInternalNode,
  EdgeLabelRenderer,
  Position,
  type EdgeProps,
  type InternalNode,
} from "@xyflow/react";
import {
  flowStroke,
  resolveEndpoints,
  type FlowKind,
  type Rect,
  type Side,
} from "@/lib/diagram";

export interface FloatingEdgeData {
  flow?: FlowKind;
  label?: string;
  labelDy?: number;
  internetAnchor?: number;
  downFrac?: number;
  targetTopFrac?: number;
  targetBottomFrac?: number;
  sourceTopFrac?: number;
  sourceBottomFrac?: number;
  highlighted: boolean;
  dimmed: boolean;
  [key: string]: unknown;
}

const SIDE_TO_POSITION: Record<Side, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

function nodeRect(node: InternalNode): Rect {
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    w: node.measured?.width ?? 0,
    h: node.measured?.height ?? 0,
  };
}

export function FloatingEdge({ id, source, target, markerEnd, data }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const d = (data ?? {}) as FloatingEdgeData;
  const isFlow = !!d.flow;

  const { sx, sy, tx, ty, sourceSide, targetSide } = resolveEndpoints(
    {
      source,
      target,
      flow: d.flow,
      internetAnchor: d.internetAnchor,
      downFrac: d.downFrac,
      targetTopFrac: d.targetTopFrac,
      targetBottomFrac: d.targetBottomFrac,
      sourceTopFrac: d.sourceTopFrac,
      sourceBottomFrac: d.sourceBottomFrac,
    },
    nodeRect(sourceNode),
    nodeRect(targetNode),
  );

  const [path, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: SIDE_TO_POSITION[sourceSide],
    targetPosition: SIDE_TO_POSITION[targetSide],
    targetX: tx,
    targetY: ty,
    curvature: 0.3,
  });

  let stroke = flowStroke(d.flow);
  let opacity = 0;
  let width = 1;
  let animated = false;

  if (isFlow) {
    if (d.dimmed) {
      opacity = 0.18;
      width = 1;
    } else if (d.highlighted) {
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
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + (d.labelDy ?? 0)}px)`,
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
