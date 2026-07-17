import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#f7f9fb",
        foreground: "#162027",
        sidebar: "#0b2d35",
        sidebarMuted: "#123e48",
        surface: "#ffffff",
        border: "#d9e1e7",
        muted: "#65727c",
        accent: "#d9911f",
        accentSoft: "#fff4df",
        success: "#16744c",
        danger: "#b42318"
      },
      fontFamily: {
        sans: ["Inter", "IBM Plex Sans", "Arial", "sans-serif"]
      },
      boxShadow: {
        table: "0 1px 2px rgba(15, 23, 42, 0.05)"
      }
    }
  },
  plugins: []
};

export default config;
