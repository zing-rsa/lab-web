"use client";

import { siteConfig } from "@/site.config";
import { TypedHeading } from "@/components/TypedHeading";
import { clsx } from "@/lib/utils";

interface HeroProps {
  collapsed: boolean;
  onToggle: () => void;
  onRunDemo: () => void;
}

export function Hero({ collapsed, onToggle, onRunDemo }: HeroProps) {
  return (
    <>
      <div
        aria-hidden={collapsed}
        className={clsx(
          "pointer-events-auto relative flex max-h-[calc(100vh-1.5rem)] w-[min(80vw,24rem)] flex-col overflow-y-auto border border-ink-muted/40 bg-paper/70 p-5 shadow-2xl backdrop-blur-md transition-[transform,opacity] duration-300 sm:max-h-[calc(100vh-3rem)] sm:w-[min(88vw,25rem)] sm:p-7",
          collapsed
            ? "pointer-events-none -translate-x-[calc(100%+1.5rem)] opacity-0"
            : "translate-x-0 opacity-100",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <TypedHeading
            text={siteConfig.heading}
            className="text-2xl font-bold leading-tight"
          />
          <button
            type="button"
            onClick={onToggle}
            aria-label="Close writeup"
            className="-mr-1 -mt-1 shrink-0 text-sm leading-none text-ink-muted transition-colors hover:text-ink"
          >
            [x]
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          {siteConfig.intro}
        </p>

        <button
          type="button"
          onClick={onRunDemo}
          className="group mt-6 inline-flex items-center gap-2.5 self-center border border-[#8fca9d]/40 bg-[#8fca9d]/[0.06] px-3 py-1.5 text-sm text-[#8fca9d] transition-colors hover:border-[#8fca9d]/80 hover:bg-[#8fca9d]/[0.12] motion-safe:animate-glow"
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-[#8fca9d]"
          />
          run a demo
          <span
            aria-hidden
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            →
          </span>
        </button>

        <p className="mt-6 border-t border-ink-muted/20 pt-4 text-xs leading-relaxed text-ink-faint">
          drag, scroll and click the diagram to explore.
        </p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label="Show writeup"
        className={clsx(
          "absolute left-3 top-3 flex h-9 w-9 items-center justify-center border border-ink-muted/40 bg-paper/80 text-lg text-ink-muted shadow-lg backdrop-blur-md transition-opacity duration-300 hover:text-ink sm:left-6 sm:top-1/2 sm:-translate-y-1/2",
          collapsed ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        »
      </button>
    </>
  );
}
