import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#FAF7F2",
        fg: "#2D3A2E",
        accent: "#D97757",
        "accent-soft": "#F5E6DC",
        "user-bubble": "#2D3A2E",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["Nunito", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.04)", opacity: "0.9" },
        },
        "recording-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(217,119,87,0.6)" },
          "50%": { boxShadow: "0 0 0 18px rgba(217,119,87,0)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "recording-ring": "recording-ring 1.4s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
