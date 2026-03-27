import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import * as Sentry from "@sentry/react";
import { router } from "./app/router";
import { AuthProvider } from "./auth/AuthContext";
import { ChunkErrorBoundary } from "./components/ChunkErrorBoundary";
import "./index.css";

// ── Sentry error tracking ─────────────────────────────────────────────────────
// Only initializes in production when DSN is set.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN && import.meta.env.PROD) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: 0.3,       // 30% of transactions — enough for a school app
    replaysSessionSampleRate: 0, // don't record replays by default
    replaysOnErrorSampleRate: 1.0, // but capture 100% of error sessions
    environment: import.meta.env.MODE,
    // Filter out noise — SW registration failures, Vercel analytics, etc.
    beforeSend(event) {
      const msg = event.exception?.values?.[0]?.value ?? "";
      if (
        msg.includes("ServiceWorker") ||
        msg.includes("_vercel/insights") ||
        msg.includes("_vercel/speed-insights") ||
        msg.includes("Connection closed")
      ) {
        return null; // drop these
      }
      return event;
    },
  });
}

// ── Service Worker registration ───────────────────────────────────────────────
// Only register in production. SW handles: app shell caching, API offline
// fallback, and push notifications.
//
// CRITICAL: Check that the response is actually JavaScript before registering.
// Vercel SPA rewrites can return index.html for /sw.js if misconfigured,
// causing a SecurityError.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    // Pre-flight: verify sw.js actually returns JavaScript
    fetch("/sw.js", { method: "HEAD" })
      .then((res) => {
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("javascript")) {
          console.warn(
            `[PWA] Skipping SW registration — /sw.js returned content-type: ${ct}`
          );
          return;
        }
        return navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((registration) => {
            console.log("[PWA] Service Worker registered:", registration.scope);
            // Check for SW updates every hour
            setInterval(() => registration.update(), 60 * 60 * 1000);
          });
      })
      .catch((error) => {
        // Don't let SW failure break the app — it's a progressive enhancement
        console.warn("[PWA] Service Worker registration skipped:", error.message);
      });
  });
}

// Handle Vite's preload error event (fires before React sees the error)
// This is the earliest possible interception point for stale chunk 404s.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
window.addEventListener("vite:preloadError", () => {
  const key = `chunk-preload-${window.location.pathname}`;
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <ChunkErrorBoundary>
    <AuthProvider>
      <RouterProvider router={router} />
      {/* Vercel Analytics — tracks page views and web vitals in production */}
      <Analytics />
      {/* Vercel Speed Insights — tracks Core Web Vitals per route */}
      <SpeedInsights />
    </AuthProvider>
  </ChunkErrorBoundary>
);
