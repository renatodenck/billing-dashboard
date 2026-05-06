import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0b",
        panel: "#111114",
        border: "#1f1f24",
        muted: "#6b7280",
        accent: "#10a37f",
        meta: "#1877f2",
      },
    },
  },
  plugins: [],
} satisfies Config;
