import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

/**
 * Injects entry-point bundle URLs into sw.js at build time.
 *
 * After Vite writes the build output, this plugin:
 * 1. Reads dist/.vite/manifest.json to find the hashed entry JS + CSS filenames
 * 2. Replaces the PRECACHE_BUNDLES placeholder in dist/sw.js with the real URLs
 *
 * This guarantees that the SW precaches the main app bundles on install,
 * so the entire app loads offline after a single online visit — even if the
 * user only visited the login page and never navigated to any other route.
 */
function injectSWBundles(): Plugin {
  return {
    name: "inject-sw-bundles",
    apply: "build",
    writeBundle() {
      const distDir = resolve(__dirname, "dist");
      const swPath = resolve(distDir, "sw.js");
      const manifestPath = resolve(distDir, ".vite/manifest.json");

      let manifestData: Record<string, { file: string; css?: string[] }>;
      try {
        manifestData = JSON.parse(readFileSync(manifestPath, "utf-8"));
      } catch {
        console.warn("[inject-sw-bundles] No manifest.json found — skipping SW injection");
        return;
      }

      // Collect entry JS + CSS files from manifest
      const bundleUrls: string[] = [];
      for (const [, entry] of Object.entries(manifestData)) {
        if (entry.file) bundleUrls.push("/" + entry.file);
        if (entry.css) {
          for (const css of entry.css) bundleUrls.push("/" + css);
        }
      }

      // Deduplicate
      const unique = [...new Set(bundleUrls)];

      // Only keep the entry-point bundles (index-*.js/css) — not lazy chunks
      // Lazy chunks are cached on-demand by cacheFirstImmutable().
      // We want to precache just what's needed for the app shell to boot.
      const entryBundles = unique.filter(
        (u) => u.includes("/index-") || u.includes("/vendor-")
      );

      let sw = readFileSync(swPath, "utf-8");
      sw = sw.replace(
        "/* __PRECACHE_BUNDLES__ */",
        entryBundles.map((u) => `  "${u}",`).join("\n")
      );
      writeFileSync(swPath, sw);

      console.log(`[inject-sw-bundles] Injected ${entryBundles.length} bundle URLs into sw.js:`);
      entryBundles.forEach((u) => console.log(`  ${u}`));
    },
  };
}

export default defineConfig({
  plugins: [react(), injectSWBundles()],
  build: {
    manifest: true,  // generates .vite/manifest.json for SW bundle injection
    modulePreload: false,
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":      ["react", "react-dom", "react-router-dom"],
          "vendor-ui":         ["sonner", "react-helmet-async"],
          "vendor-realtime":   ["ably", "@ably/chat"],
          "vendor-canvas":     ["@excalidraw/excalidraw"],
          "vendor-livekit":    ["livekit-client", "@livekit/components-react", "@livekit/components-styles"],
          "vendor-monitoring": ["@sentry/react", "@vercel/analytics", "@vercel/speed-insights"],
        },
      },
    },
  },
});