import { siteConfig } from "@/site.config";
import { TypedHeading } from "@/components/ui";

const STATS = [
  { label: "control-plane nodes", value: "3" },
  { label: "worker nodes", value: "1–3" },
  { label: "platform operators", value: "10+" },
  { label: "provider lock-in", value: "1 folder" },
];

/** Floating writeup card that hovers over the diagram canvas. */
export function Hero() {
  return (
    <div className="pointer-events-auto flex max-h-[calc(100vh-2rem)] w-[min(88vw,25rem)] flex-col overflow-y-auto border border-ink-muted/40 bg-paper/70 p-6 shadow-2xl backdrop-blur-md sm:p-7">
      <p className="mb-4 text-sm text-ink-muted">
        <span className="text-ink-faint">$</span> cat README.md
      </p>

      <TypedHeading
        text={siteConfig.heading}
        className="text-2xl font-bold leading-tight"
      />

      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
        {siteConfig.intro}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-px border border-ink-muted/30 bg-ink-muted/20">
        {STATS.map((s) => (
          <div key={s.label} className="bg-paper/80 p-3">
            <dt className="text-xl font-bold tabular-nums text-ink">
              {s.value}
            </dt>
            <dd className="mt-1 text-[11px] leading-tight text-ink-faint">
              {s.label}
            </dd>
          </div>
        ))}
      </dl>

      <nav className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <a
          href={siteConfig.repo}
          target="_blank"
          rel="noreferrer noopener"
          className="text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          → gitops repo
        </a>
        <a
          href={siteConfig.portfolio}
          className="text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          → back to portfolio
        </a>
      </nav>

      <p className="mt-6 border-t border-ink-muted/20 pt-4 text-xs leading-relaxed text-ink-faint">
        {siteConfig.footer} · drag, scroll and click the diagram to explore.
      </p>
    </div>
  );
}
