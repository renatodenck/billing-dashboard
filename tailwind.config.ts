import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        psa: {
          orange: "#FF640F",
          "orange-soft": "#FFE5D5",
          blue: "#053CAA",
          "blue-soft": "#E1E9FF",
          ink: "#0B1320",
          muted: "#5B6679",
          line: "#E6E9EF",
          surface: "#FFFFFF",
          bg: "#F7F8FB",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
