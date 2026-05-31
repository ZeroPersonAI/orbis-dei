import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In dev, the frontend runs on Vite (5173) and proxies API + WS to the Node
// server (1421). In production, the Node server serves the built `dist/`.
const SERVER = process.env.ORBIS_SERVER ?? "http://localhost:1421";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: SERVER, changeOrigin: true },
      "/ws": { target: SERVER, ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
  },
});
