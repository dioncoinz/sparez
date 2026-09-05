import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--ink) / <alpha-value>)",
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        forest: { 50: "#fff2ec", 100: "#fbd9ca", 300: "#efac8e", 500: "#dd622d", 600: "#ac4219", 700: "#913714", 800: "#a53d16", 900: "#000000" },
        safety: { 400: "#dd622d", 500: "#ac4219" }
      },
      boxShadow: { soft: "0 1px 2px rgba(23,33,28,.04), 0 8px 24px rgba(23,33,28,.05)" },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem" }
    },
  },
  plugins: [],
} satisfies Config;
