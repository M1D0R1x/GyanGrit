import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { RouterProvider } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "sonner";
import { router } from "./app/router";
import { AuthProvider } from "./auth/AuthContext";
import { ChunkErrorBoundary } from "./components/ChunkErrorBoundary";
import { ThemeProvider } from "./components/ThemeProvider";
import { startOfflineSync } from "./services/offlineSync";
import "./index.css";

// ── Offline sync engine ───────────────────────────────────────────────────────
// Start background sync — processes queued offline actions when back online.
startOfflineSync();

// ── Sentry error tracking (deferred) ──────────────────────────────────────────
// Deferred until after first paint via requestIdleCallback + dynamic import.
// On Slow 4G this removes ~1.3s from the critical rendering path.
// Trade-off: errors during the initial render won't be captured by Sentry.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN && import.meta.env.PROD) {
  const initSentry = () => {
    import("@sentry/react").then((Sentry) => {
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
    }).catch(() => {
      // Sentry failed to load — not critical, continue without it
    });
  };

  // Wait for first paint, then init during idle time
  if (typeof requestIdleCallback === "function") {
    window.addEventListener("load", () => requestIdleCallback(initSentry), { once: true });
  } else {
    // Safari fallback — requestIdleCallback not supported
    window.addEventListener("load", () => setTimeout(initSentry, 1000), { once: true });
  }
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
            setInterval(() => { if (navigator.onLine) registration.update(); }, 60 * 60 * 1000);
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
  <HelmetProvider>
    <ChunkErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <RouterProvider router={router} />
          <Toaster
            position="bottom-right"
            gap={8}
            toastOptions={{
              style: {
                fontFamily:           "var(--font-body)",
                fontSize:             "14px",
                fontWeight:           "500",
                lineHeight:           "22px",
                // Neefe glassmorphism recipe: gradient fill + 1px stroke + blur(12px)
                background:           "linear-gradient(-20.95deg, rgba(255,255,255,0.06) 40.13%, rgba(255,255,255,0.1) 97.02%)",
                color:                "var(--ink-primary)",
                border:               "1px solid rgba(255,255,255,0.08)",
                borderRadius:         "12px",
                boxShadow:            "0 8px 32px rgba(0,0,0,0.32), 0 1px 2px rgba(0,0,0,0.16)",
                backdropFilter:       "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                // Correct icon + text flex alignment
                display:              "flex",
                alignItems:           "center",
                gap:                  "8px",
                padding:              "12px 16px",
                minHeight:            "56px",
              },
            }}
            closeButton
          />
          {/* Vercel Analytics — deduplicate consecutive same-URL page views */}
          <Analytics
            beforeSend={(event) => {
              // React Router can fire multiple route changes per navigation.
              // Skip consecutive duplicate URLs to avoid inflated page view counts.
              const key = "__va_last_url";
              const last = sessionStorage.getItem(key);
              if (last === event.url) return null;
              sessionStorage.setItem(key, event.url);
              return event;
            }}
          />
          {/* Vercel Speed Insights — sample 10% to reduce network overhead */}
          <SpeedInsights sampleRate={0.1} />
        </ThemeProvider>
      </AuthProvider>
    </ChunkErrorBoundary>
  </HelmetProvider>
);
