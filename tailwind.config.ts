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
        // Tom-Gates-inspirierte Palette + Roboter-Akzent
        bg: "#FDF6EC", // warmes Sketchbook-Papier
        fg: "#141414", // fast-schwarz für kräftigen Kontrast
        accent: "#FF6B35", // knalliges Marker-Orange
        "accent-soft": "#FFE3D0",
        bot: "#14B8A6", // Roboter-Türkis (Sekundär)
        "bot-soft": "#CCFBF1",
        "user-bubble": "#141414",
      },
      fontFamily: {
        display: ["Kalam", "Comic Sans MS", "cursive"],
        body: ["Nunito", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem",
      },
      boxShadow: {
        comic: "3px 3px 0 0 #141414",
        "comic-sm": "2px 2px 0 0 #141414",
        "comic-lg": "5px 5px 0 0 #141414",
        "comic-pressed": "1px 1px 0 0 #141414",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.04)", opacity: "0.9" },
        },
        "recording-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255,107,53,0.6)" },
          "50%": { boxShadow: "0 0 0 18px rgba(255,107,53,0)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-1deg)" },
          "50%": { transform: "rotate(1deg)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "recording-ring": "recording-ring 1.4s ease-out infinite",
        wiggle: "wiggle 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
