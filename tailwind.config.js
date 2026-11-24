/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      maxWidth: {
        phone: "480px",
      },
      colors: {
        surface: "#0f1419",
        card: "#1a2332",
        accent: {
          value: "#22c55e",
          high: "#3b82f6",
          warn: "#f59e0b",
        },
      },
    },
  },
  plugins: [],
};