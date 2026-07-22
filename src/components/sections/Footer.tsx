import { siteConfig } from "@/site.config";

/** Closing section with a link back to the portfolio. */
export function Footer() {
  return (
    <footer className="border-t border-ink-muted/30">
      <div className="mx-auto flex w-full max-w-content flex-col items-start gap-6 px-6 py-16 sm:px-8 sm:py-20">
        <p className="text-lg text-ink sm:text-xl">{siteConfig.footer}</p>

        <a
          href={siteConfig.portfolio}
          className="text-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          → zingdev.xyz
        </a>

        <p className="mt-4 text-xs text-ink-faint">
          built with next.js + react-flow · running on the cluster it describes
        </p>
      </div>
    </footer>
  );
}
