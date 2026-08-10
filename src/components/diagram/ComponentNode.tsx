import { Handle, Position, type NodeProps } from "@xyflow/react";
import { clsx } from "@/lib/utils";
import type { ComponentDef } from "@/lib/diagram";

export interface ComponentNodeData extends Omit<ComponentDef, "accent"> {
  accent: string;
  groupLabel: string;
  selected: boolean;
  dimmed: boolean;
  neighbor: boolean;
  [key: string]: unknown;
}

export function ComponentNode({ data }: NodeProps) {
  const d = data as ComponentNodeData;

  if (d.compact) {
    const visible = d.visible !== false;
    return (
      <div
        className={clsx(
          "group relative flex h-full w-full items-center justify-center gap-1.5 overflow-hidden border bg-paper px-2 transition-all duration-300 hover:border-ink",
          d.selected ? "border-ink" : d.neighbor ? "border-ink-muted/80" : "border-ink-muted/40",
        )}
        style={{
          opacity: visible ? (d.dimmed ? 0.25 : 1) : 0,
          transform: visible ? "scale(1)" : "scale(0.8)",
          ...(d.selected ? { boxShadow: `0 0 0 1px ${d.accent}` } : {}),
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={false}
          className="!h-1 !w-1 !border-0 !bg-transparent"
        />
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: d.accent }}
        />
        <span className="truncate text-[10px] leading-tight text-ink">{d.name}</span>
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={false}
          className="!h-1 !w-1 !border-0 !bg-transparent"
        />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "group relative flex h-full w-full flex-col justify-between overflow-hidden border bg-paper pl-3.5 pr-3 py-2.5 transition-all duration-200 hover:border-ink",
        d.selected
          ? "border-ink"
          : d.neighbor
            ? "border-ink-muted/80"
            : "border-ink-muted/40",
        d.dimmed ? "opacity-25" : "opacity-100",
      )}
      style={d.selected ? { boxShadow: `0 0 0 1px ${d.accent}` } : undefined}
    >
      <span
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: d.accent }}
      />

      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="!h-1 !w-1 !border-0 !bg-transparent"
      />

      <div className="flex items-start justify-between gap-1">
        <span className="truncate text-[13px] leading-tight text-ink">
          {d.name}
        </span>
        {d.count ? (
          <span
            className="shrink-0 border px-1 text-[9px] leading-tight"
            style={{ borderColor: `${d.accent}80`, color: `${d.accent}e6` }}
          >
            {d.count}
          </span>
        ) : null}
      </div>

      <div className="text-[10px] leading-tight text-ink-muted">{d.kind}</div>

      <div className="flex items-center justify-between gap-2 text-[9px] leading-tight text-ink-faint">
        <span className="truncate">{d.namespace ?? ""}</span>
        {d.version ? <span className="shrink-0">{d.version}</span> : null}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="!h-1 !w-1 !border-0 !bg-transparent"
      />
    </div>
  );
}
