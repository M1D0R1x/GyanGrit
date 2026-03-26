import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,   // disable in prod for smaller bundle
    chunkSizeWarningLimit: 5000,  // excalidraw + mermaid are lazy-loaded; students never download them
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // ── Excalidraw ecosystem (lazy-loaded via Whiteboard.tsx) ──
          // Only downloads when teacher opens the whiteboard in a live session
          if (id.includes("mermaid")) return "vendor-mermaid";
          if (id.includes("@excalidraw")) return "vendor-excalidraw";

          // ── LiveKit (lazy-loaded via LiveSessionPage) ──
          if (id.includes("livekit")) return "vendor-livekit";

          // ── Ably (lazy-loaded via ChatRoomPage / CompetitionRoomPage) ──
          if (id.includes("ably") || id.includes("@ably")) return "vendor-ably";

          // ── Marked + DOMPurify (notification detail modal only) ──
          if (id.includes("marked") || id.includes("dompurify")) return "vendor-markdown";

          // ── Core React (loaded on every page — keep together) ──
          if (id.includes("react-dom") || id.includes("react-router")) return "vendor-react";
        },
      },
    },
  },
  // No proxy needed in production — direct API calls to Render
});