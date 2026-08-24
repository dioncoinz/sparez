import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211c",
        canvas: "#f4f5f1",
        forest: { 50: "#edf5f0", 100: "#d9e9df", 500: "#347054", 600: "#285d45", 700: "#214b39", 800: "#1d3d31", 900: "#19332a" },
        safety: { 400: "#f6b94b", 500: "#e9a72e" }
      },
      boxShadow: { soft: "0 1px 2px rgba(23,33,28,.04), 0 8px 24px rgba(23,33,28,.05)" },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem" }
    },
  },
  plugins: [],
} satisfies Config;
