import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Legacy tokens (keep for backward compat) ──────────────
        navy: {
          DEFAULT:  "#0f1923",
          light:    "#1a2a3a",
          muted:    "#2c3e50",
          // New scale
          50:  "#e8eaec",
          100: "#c5ccd3",
          200: "#8c9baa",
          300: "#536a7f",
          400: "#2a4156",
          500: "#0f1923",
          600: "#0c1520",
          700: "#091018",
          800: "#060b10",
          900: "#030608",
        },
        cream: {
          DEFAULT: "#f5f0e8",
          dark:    "#ede8de",
          border:  "#ccc5b5",
          // New scale
          50:  "#fdfcfa",
          100: "#f5f0e8",
          200: "#ece4d4",
          300: "#ddd4be",
          400: "#c9bba3",
          500: "#b0a08a",
        },
        red: {
          accent: "#c8391a",
          hover:  "#a82e14",
          // New scale
          50:  "#fdf0ec",
          100: "#f7cec4",
          200: "#ef9d89",
          300: "#e06c52",
          400: "#d14830",
          500: "#c8391a",
          600: "#a82e14",
          700: "#88240f",
          800: "#681a09",
          900: "#481005",
        },
        gold: {
          accent: "#b8960c",
          light:  "#d4af37",
          // New scale
          50:  "#fdf8e6",
          100: "#f7e9b0",
          200: "#edd479",
          300: "#d9b93a",
          400: "#c8a31a",
          500: "#b8960c",
          600: "#9a7d09",
          700: "#7c6407",
          800: "#5e4c05",
          900: "#403303",
        },
        ink: {
          DEFAULT: "#1a1a1a",
          muted:   "#4a4a4a",
          faint:   "#7a7a7a",
          // Legacy
          light:   "#6b6558",
        },
        rule:      "#d4cebe",
        "rule-dark": "#2d3d4d",
      },
      fontFamily: {
        // Legacy
        serif:    ["var(--font-headline)", "Georgia", "serif"],
        sans:     ["var(--font-body)", "system-ui", "sans-serif"],
        mono:     ["var(--font-data)", "monospace"],
        // New design system names
        headline: ["var(--font-headline)", "Georgia", "Times New Roman", "serif"],
        body:     ["var(--font-body)", "system-ui", "-apple-system", "sans-serif"],
        data:     ["var(--font-data)", "Courier New", "monospace"],
        prose:    ["var(--font-prose)", "Georgia", "Times New Roman", "serif"],
      },
      fontSize: {
        "2xs": ["0.65rem",   { lineHeight: "1rem" }],
        xs:    ["0.6875rem", { lineHeight: "1.125rem" }],
        sm:    ["0.8125rem", { lineHeight: "1.375rem" }],
        base:  ["1rem",      { lineHeight: "1.625rem" }],
        lg:    ["1.125rem",  { lineHeight: "1.75rem" }],
        xl:    ["1.25rem",   { lineHeight: "1.875rem" }],
        "2xl": ["1.5rem",    { lineHeight: "2rem" }],
        "3xl": ["1.875rem",  { lineHeight: "2.375rem" }],
        "4xl": ["2.25rem",   { lineHeight: "2.75rem" }],
        "5xl": ["3rem",      { lineHeight: "1.1" }],
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
      },
      borderRadius: {
        DEFAULT: "2px",
        sm:      "1px",
        md:      "3px",
        lg:      "4px",
      },
      borderColor: {
        DEFAULT:    "#d4cebe",
        rule:       "#d4cebe",
        "rule-dark": "#2d3d4d",
      },
      keyframes: {
        "ticker-scroll": {
          from: { transform: "translateX(0)" },
          to:   { transform: "translateX(-50%)" },
        },
      },
      animation: {
        ticker: "ticker-scroll 45s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
