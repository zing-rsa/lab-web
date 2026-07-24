"use client";

import { siteConfig } from "@/site.config";
import { TypedHeading } from "@/components/ui";
import { clsx } from "@/lib/utils";

interface HeroProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Collapsible writeup card that hovers over the diagram canvas. */
export function Hero({ collapsed, onToggle }: HeroProps) {
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
            aria-label="Collapse writeup"
            className="-mr-1 -mt-1 shrink-0 text-lg leading-none text-ink-muted transition-colors hover:text-ink"
          >
            «
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          {siteConfig.intro}
        </p>

        <nav className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <a
            href={siteConfig.repo}
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            → view source
          </a>
          <a
            href={siteConfig.portfolio}
            className="text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            → my portfolio
          </a>
        </nav>

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
