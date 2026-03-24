import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { router } from "./app/router";
import { AuthProvider } from "./auth/AuthContext";
import "./index.css";
import "./nav-menu-animation.css";

// ── Service Worker registration ───────────────────────────────────────────────
// Only register in production. SW handles: app shell caching, API offline
// fallback, and push notifications.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("[PWA] Service Worker registered:", registration.scope);
        // Check for SW updates every hour
        setInterval(() => registration.update(), 60 * 60 * 1000);
      })
      .catch((error) => {
        console.error("[PWA] Service Worker registration failed:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <RouterProvider router={router} />
    {/* Vercel Analytics — tracks page views and web vitals in production */}
    <Analytics />
    {/* Vercel Speed Insights — tracks Core Web Vitals per route */}
    <SpeedInsights />
  </AuthProvider>
);
