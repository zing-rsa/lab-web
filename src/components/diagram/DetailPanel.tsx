import { clsx } from "@/lib/utils";
import type { ComponentDef } from "@/lib/diagram-data";

export interface Selection {
  component: ComponentDef;
  groupLabel: string;
  accent: string;
}

interface DetailPanelProps {
  selection: Selection | null;
  onClose: () => void;
}

/** Slide-in panel with the selected component's details. */
export function DetailPanel({ selection, onClose }: DetailPanelProps) {
  const c = selection?.component;

  return (
    <aside
      aria-hidden={!selection}
      className={clsx(
        "absolute right-0 top-0 z-20 flex h-full w-full flex-col border-l border-ink-muted/40 bg-paper/95 backdrop-blur-sm transition-transform duration-300 sm:w-80",
        selection ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
    >
      {selection && c ? (
        <div className="flex h-full flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <p
              className="flex items-center gap-2 text-[10px] tracking-[0.2em]"
              style={{ color: `${selection.accent}d9` }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: selection.accent }}
              />
              {selection.groupLabel}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="-mt-1 text-ink-muted transition-colors hover:text-ink"
            >
              [x]
            </button>
          </div>

          <h3 className="mt-3 text-lg font-bold text-ink">{c.name}</h3>
          <p className="mt-1 text-xs text-ink-muted">{c.kind}</p>

          <dl className="mt-5 space-y-2 text-xs">
            {c.namespace ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">namespace</dt>
                <dd className="text-right text-ink-muted">{c.namespace}</dd>
              </div>
            ) : null}
            {c.version ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">version</dt>
                <dd className="text-right text-ink-muted">{c.version}</dd>
              </div>
            ) : null}
            {c.count ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">instances</dt>
                <dd className="text-right text-ink-muted">{c.count}</dd>
              </div>
            ) : null}
          </dl>

          <p className="mt-5 border-t border-ink-muted/20 pt-4 text-sm leading-relaxed text-ink-muted">
            {c.summary}
          </p>
        </div>
      ) : null}
    </aside>
  );
}
