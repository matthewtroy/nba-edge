/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,tsx}"],
  theme: {
    extend: {
      maxWidth: {
        phone: "480px",
      },
      colors: {
        page: "#0B0F14",
        card: "#121821",
        surface: "#0B0F14",
        price: {
          green: "#22c55e",
        },
        reason: {
          injury: "#f59e0b",
          matchup: "#14b8a6",
        },
        accent: {
          value: "#22c55e",
          high: "#e7ecf3",
          warn: "#f59e0b",
        },
      },
      borderRadius: {
        card: "16px",
      },
      spacing: {
        18: "4.5rem",
      },
      keyframes: {
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.28s ease-out",
        shimmer: "shimmer 1.2s ease-in-out infinite",
        spin: "spin 8s linear infinite",
      },
    },
  },
  plugins: [],
};