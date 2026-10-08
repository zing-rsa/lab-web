import type { Config } from "tailwindcss";

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
        loadpathIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // Pulsing notification dot: fades/glows on and off.
        notify: {
          "0%, 100%": {
            opacity: "0.35",
            boxShadow: "0 0 0 0 rgba(224,145,63,0)",
          },
          "50%": {
            opacity: "1",
            boxShadow: "0 0 6px 1px rgba(224,145,63,0.85)",
          },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(143,202,157,0)" },
          "50%": { boxShadow: "0 0 18px 2px rgba(143,202,157,0.35)" },
        },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        dash: "dash 0.9s linear infinite",
        loadpath: "dash 0.9s linear infinite, loadpathIn 320ms ease-out",
        notify: "notify 1.6s ease-in-out infinite",
        glow: "glow 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
