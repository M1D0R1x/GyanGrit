import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: false,
    outDir: "dist",
    sourcemap: false,   // disable in prod for smaller bundle
    chunkSizeWarningLimit: 5000,  // excalidraw + mermaid are lazy-loaded; students never download them
  },
  // No proxy needed in production — direct API calls to Render
});