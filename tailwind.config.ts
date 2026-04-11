import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0f172a",   // slate-950
          light:   "#1e293b",   // slate-800
          muted:   "#334155",   // slate-700
        },
        cream: {
          DEFAULT: "#ffffff",
          dark:    "#f8fafc",
          border:  "#e2e8f0",
        },
        red: {
          accent: "#ea580c",    // orange-600 — brand accent
          hover:  "#c2410c",    // orange-700
        },
        orange: {
          accent: "#ea580c",
          hover:  "#c2410c",
        },
        gold: {
          accent: "#f59e0b",
          light:  "#fbbf24",
        },
        ink: {
          DEFAULT: "#0f172a",   // slate-950 — near black
          muted:   "#475569",   // slate-600
          light:   "#64748b",   // slate-500
        },

      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Fraunces", "Georgia", "serif"],
        sans:  ["var(--font-dm-sans)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono:  ["var(--font-jetbrains)", "monospace"],
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
        xs:    ["0.75rem", { lineHeight: "1.125rem" }],
        sm:    ["0.875rem", { lineHeight: "1.375rem" }],
        base:  ["1rem",    { lineHeight: "1.625rem" }],
        lg:    ["1.125rem", { lineHeight: "1.75rem" }],
        xl:    ["1.25rem",  { lineHeight: "1.875rem" }],
        "2xl": ["1.5rem",   { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.375rem" }],
        "4xl": ["2.25rem",  { lineHeight: "2.75rem" }],
        "5xl": ["3rem",     { lineHeight: "1.1" }],
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
      },
      borderRadius: {
        DEFAULT: "3px",
        sm: "2px",
        md: "4px",
        lg: "6px",
      },
      borderColor: {
        DEFAULT: "#e2e8f0",
      },
    },
  },
  plugins: [],
};

export default config;
