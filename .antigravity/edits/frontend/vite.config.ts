// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react";
//
// export default defineConfig({
//   plugins: [react()],
//   server: {
//     host: "127.0.0.1",
//     port: 5173,
//   },
// });

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,   // disable in prod for smaller bundle
    chunkSizeWarningLimit: 800,
  },
  // No proxy needed in production — direct API calls to Render
});