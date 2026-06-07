import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        monad: {
          purple: "#836EF9",
          dark: "#0E0B1A",
          card: "#171327",
          border: "#2A2440",
        },
      },
    },
  },
  plugins: [],
};
export default config;
