import { FLOW_COLORS } from "@/lib/diagram";

const FLOWS: { color: string; label: string }[] = [
  { color: FLOW_COLORS.ingress, label: "public ingress" },
  { color: FLOW_COLORS.admin, label: "controlled/admin ingress" },
  { color: FLOW_COLORS.egress, label: "application egress" },
];

export function Legend() {
  return (
    <div className="hidden flex-col gap-1.5 border border-ink-muted/30 bg-paper/85 px-3 py-2 text-[10px] leading-relaxed text-ink-faint backdrop-blur-sm sm:flex">
      <span>
        <span className="text-ink-muted">click</span> for details ·{" "}
        <span className="text-ink-muted">hover</span> to trace links ·{" "}
        <span className="text-ink-muted">scroll</span> to zoom
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {FLOWS.map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-[2px] w-4"
              style={{ backgroundColor: color }}
            />
            {label}
          </span>
        ))}
      </span>
    </div>
  );
}
