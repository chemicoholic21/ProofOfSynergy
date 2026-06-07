import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1d1d1f",
        "ink-soft": "#6e6e73",
        accent: "#0071e3",
      },
    },
  },
  plugins: [],
};
export default config;
