import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "/nba-edge/",
  plugins: [react()],
  server: {
    port: 5180,
    host: true,
  },
  preview: {
    port: 4180,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@lib": path.resolve(__dirname, "lib"),
    },
  },
});