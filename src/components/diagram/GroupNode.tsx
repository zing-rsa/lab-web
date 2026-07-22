import { Handle, Position, type NodeProps } from "@xyflow/react";
import { clsx } from "@/lib/utils";

export interface GroupNodeData {
  label: string;
  accent: string;
  clickable?: boolean;
  selected?: boolean;
  dashed?: boolean;
  [key: string]: unknown;
}

/**
 * A nesting container. Transparent fill so edges crossing it stay visible;
 * accent-tinted border + label mark the layer. Node-pool boxes are clickable
 * for a detail card.
 */
export function GroupNode({ data }: NodeProps) {
  const d = data as GroupNodeData;

  return (
    <div
      className={clsx(
        "relative h-full w-full rounded-md border transition-colors",
        d.dashed ? "border-dashed" : "border-solid",
        d.clickable && "cursor-pointer",
      )}
      style={{
        borderColor: d.selected ? `${d.accent}b3` : `${d.accent}59`,
        backgroundColor: d.selected ? `${d.accent}14` : `${d.accent}0a`,
      }}
    >
      {/* Hidden handles so floating edges can attach to a container node. */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="!h-1 !w-1 !border-0 !bg-transparent"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="!h-1 !w-1 !border-0 !bg-transparent"
      />

      <span
        className="absolute left-3 top-2 text-[11px] font-medium tracking-[0.2em]"
        style={{ color: `${d.accent}d9` }}
      >
        {d.label}
      </span>
    </div>
  );
}
