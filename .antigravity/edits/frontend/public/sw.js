/**
 * GyanGrit Service Worker
 *
 * Strategy:
 *   - App shell (HTML, CSS, JS, fonts) → Cache First (install + precache)
 *   - API calls (cross-origin to Render) → Network Only (no caching)
 *     Session cookies + CSRF make API caching dangerous in this architecture.
 *   - Static assets (images, icons) → Cache First with background update
 *   - Navigation → SPA shell (serve index.html)
 *   - Everything else → Network First
 *
 * IMPORTANT: The API is cross-origin (gyangrit.onrender.com) while the frontend
 * is on gyan-grit.vercel.app. We identify API calls by hostname, not pathname.
 *
 * Cache names are versioned. Bump CACHE_VERSION on each deploy to
 * force old caches to be replaced.
 */

const CACHE_VERSION   = "v2";
const SHELL_CACHE     = `gyangrit-shell-${CACHE_VERSION}`;
const ASSET_CACHE     = `gyangrit-assets-${CACHE_VERSION}`;

// App shell resources precached on install.
// Only include files that DEFINITELY exist — missing files won't break install
// thanks to Promise.allSettled, but generate noisy warnings.
const SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-180.png",
];

// ── Install: precache the app shell ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return Promise.allSettled(
        SHELL_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Failed to precache ${url}:`, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const currentCaches = [SHELL_CACHE, ASSET_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith("gyangrit-") && !currentCaches.includes(name))
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ───────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, and WebSocket requests
  if (request.method !== "GET") return;
  if (url.protocol === "chrome-extension:") return;
  if (request.headers.get("upgrade") === "websocket") return;

  // ── Cross-origin API calls → ALWAYS go to network ──────────────────────
  // The API is on gyangrit.onrender.com. Caching API responses with session
  // cookies is dangerous (stale auth, wrong user data). Let them fail
  // naturally so the frontend handles errors.
  if (url.hostname !== self.location.hostname) {
    return; // let the browser handle it — no SW interception
  }

  // ── Vercel analytics / Speed insights → skip ──────────────────────────
  if (url.pathname.startsWith("/_vercel/")) {
    return; // don't interfere with Vercel's own scripts
  }

  // Static assets (images, fonts, icons, Vite bundles) — Cache First
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|woff2?|ttf|eot)$/)
  ) {
    event.respondWith(cacheFirstAsset(request));
    return;
  }

  // App shell / navigation — serve index.html for all routes (SPA)
  if (request.mode === "navigate") {
    event.respondWith(serveShell(request));
    return;
  }

  // Default — Network First
  event.respondWith(networkFirst(request, SHELL_CACHE));
});

// ── Strategy: Cache First for static assets ───────────────────────────────────
async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(ASSET_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Asset unavailable offline", { status: 503 });
  }
}

// ── Strategy: SPA shell — serve index.html for navigations ───────────────────
async function serveShell(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const indexCached = await caches.match("/index.html");
  if (indexCached) return indexCached;

  try {
    return await fetch(request);
  } catch {
    return offlinePage();
  }
}

// ── Strategy: Network First generic ──────────────────────────────────────────
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlinePage();
  }
}

// ── Offline fallback page ─────────────────────────────────────────────────────
function offlinePage() {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GyanGrit — Offline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "DM Sans", system-ui, sans-serif;
      background: #0d1117; color: #e2e8f0;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px; text-align: center;
    }
    .icon { font-size: 64px; margin-bottom: 24px; }
    h1 { font-family: "Sora", sans-serif; font-size: 24px; font-weight: 800; margin-bottom: 12px; color: #fff; }
    p { font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; max-width: 320px; }
    button {
      background: #3b82f6; color: #fff; border: none;
      padding: 12px 28px; border-radius: 8px; font-size: 15px;
      font-weight: 600; cursor: pointer;
    }
    .hint { font-size: 13px; color: #64748b; margin-top: 16px; }
  </style>
</head>
<body>
  <div>
    <div class="icon">📚</div>
    <h1>You're Offline</h1>
    <p>GyanGrit needs an internet connection to load. Please check your WiFi or mobile data.</p>
    <button onclick="window.location.reload()">Try Again</button>
    <p class="hint">Previously opened pages may still work — try the back button.</p>
  </div>
</body>
</html>`,
    {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

// ── Background sync placeholder ──────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-progress") {
    event.waitUntil(syncPendingProgress());
  }
});

async function syncPendingProgress() {
  console.log("[SW] Background sync: sync-progress");
}

// ── Push notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "GyanGrit", body: event.data.text() };
  }

  const options = {
    body:    data.body || data.preview || "",
    icon:    "/icons/icon-192.png",
    badge:   "/icons/icon-192.png",
    tag:     data.tag || "gyangrit",
    data:    { url: data.url || "/dashboard" },
    vibrate: [200, 100, 200],
    actions: [
      { action: "open",    title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "GyanGrit", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const path = event.notification.data?.url || "/dashboard";
  // Build full URL from SW origin (works in both browser and PWA)
  const fullUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window/tab
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          // Navigate the existing window to the notification URL
          client.navigate(fullUrl);
          return client;
        }
      }
      // No existing window — open a new one
      return clients.openWindow(fullUrl);
    })
  );
});
