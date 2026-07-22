import type { Config } from "tailwindcss";

/**
 * Black-and-white terminal palette shared with the portfolio site. Everything
 * is a shade of a single ink/paper pair so the site stays strictly monochrome;
 * "accent" shades are only used for low-/high-lighting, never colour.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./site.config.ts"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#e8e8e8",
          muted: "#8a8a8a",
          faint: "#5a5a5a",
        },
        paper: {
          DEFAULT: "#0a0a0a",
          faint: "#141414",
          muted: "#1f1f1f",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        dash: {
          to: { strokeDashoffset: "-12" },
        },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        dash: "dash 0.9s linear infinite",
      },
      maxWidth: {
        content: "72rem",
      },
    },
  },
  plugins: [],
};

export default config;
