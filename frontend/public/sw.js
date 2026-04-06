/**
 * GyanGrit Service Worker v4
 *
 * Strategy:
 *   - App shell (HTML, icons, manifest) → precached on install
 *   - Vite JS/CSS bundles (/assets/*.js, /assets/*.css) → Cache First
 *     with background refresh. Cached on FIRST FETCH while online.
 *     Available offline after first visit.
 *   - API calls (cross-origin to api.gyangrit.site) → Network Only
 *     Session cookies + CSRF make API caching dangerous.
 *   - Static assets (images, fonts, icons) → Cache First
 *   - Navigation → SPA shell (serve index.html from cache)
 *   - Everything else → Network First with cache fallback
 *
 * OFFLINE BOOT: After a user visits once while online, ALL app assets
 * are cached. On subsequent offline visits, the full React app loads
 * from cache. Auth is handled by AuthContext reading localStorage.
 *
 * IMPORTANT: Bump CACHE_VERSION on each deploy to force new bundle
 * files to be fetched (old hashed files are automatically evicted).
 */

const CACHE_VERSION = "v5";
const SHELL_CACHE   = `gyangrit-shell-${CACHE_VERSION}`;
const ASSET_CACHE   = `gyangrit-assets-${CACHE_VERSION}`;

// Minimal shell precached on install (no hashed filenames here —
// those get cached at runtime on first fetch while online).
const SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-180.png",
  "/favicon.svg",
];

// Entry-point JS/CSS bundles — injected by vite.config.ts at build time.
// These are the main app shell bundles that MUST be available for offline boot.
// Lazy-loaded chunks are cached on-demand by cacheFirstImmutable().
const PRECACHE_BUNDLES = [
/* __PRECACHE_BUNDLES__ */
];

// ── Install: precache app shell + entry bundles ──────────────────────────────
self.addEventListener("install", (event) => {
  const allUrls = [...SHELL_URLS, ...PRECACHE_BUNDLES];
  event.waitUntil(
    Promise.all([
      // Shell goes into shell cache
      caches.open(SHELL_CACHE).then((cache) => {
        return Promise.allSettled(
          SHELL_URLS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`[SW] Failed to precache ${url}:`, err.message);
            })
          )
        );
      }),
      // Bundles go into asset cache (immutable — content-hashed)
      caches.open(ASSET_CACHE).then((cache) => {
        return Promise.allSettled(
          PRECACHE_BUNDLES.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`[SW] Failed to precache bundle ${url}:`, err.message);
            })
          )
        );
      }),
    ]).then(() => self.skipWaiting())
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

  // Skip non-GET, chrome-extension, and WebSocket
  if (request.method !== "GET") return;
  if (url.protocol === "chrome-extension:") return;
  if (request.headers.get("upgrade") === "websocket") return;

  // ── Cross-origin API calls → ALWAYS network (no caching) ──────────────
  // The API lives on a different hostname. Session cookies + CSRF = no cache.
  if (url.hostname !== self.location.hostname) {
    return; // Let browser handle it — no SW interception
  }

  // ── Vercel analytics → skip ────────────────────────────────────────────
  if (url.pathname.startsWith("/_vercel/")) return;

  // ── Vite hashed JS/CSS bundles → Cache First (immutable) ──────────────
  // These files have content-hash in the filename, so they're safe to
  // cache forever. Cached on first fetch while online.
  if (
    url.pathname.startsWith("/assets/") &&
    (url.pathname.endsWith(".js") ||
     url.pathname.endsWith(".css") ||
     url.pathname.endsWith(".woff2") ||
     url.pathname.endsWith(".woff"))
  ) {
    event.respondWith(cacheFirstImmutable(request));
    return;
  }

  // ── Other static assets (images, SVG, fonts) → Cache First ───────────
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ttf|eot)$/)
  ) {
    event.respondWith(cacheFirstAsset(request));
    return;
  }

  // ── SPA navigation → serve index.html from cache ──────────────────────
  if (request.mode === "navigate") {
    event.respondWith(serveShell(request));
    return;
  }

  // ── Default → Network First with cache fallback ───────────────────────
  event.respondWith(networkFirst(request, SHELL_CACHE));
});

// ── Strategy: Cache First for immutable assets (Vite bundles) ────────────────
// These have content hashes — safe to cache forever without revalidation.
async function cacheFirstImmutable(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(ASSET_CACHE);
      // Clone before reading — response body can only be consumed once
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Asset not cached yet and network failed — return 503
    return new Response("", {
      status: 503,
      statusText: "Service Unavailable — asset not cached yet",
    });
  }
}

// ── Strategy: Cache First for static assets (background refresh) ──────────────
async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Serve from cache, update in background
    fetch(request)
      .then((response) => {
        if (response.ok) {
          caches.open(ASSET_CACHE).then((cache) => cache.put(request, response));
        }
      })
      .catch(() => {});
    return cached;
  }

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

// ── Strategy: SPA shell — serve index.html for all navigations ───────────────
async function serveShell(request) {
  // Try exact URL first (e.g. /dashboard might be cached from a previous visit)
  const cached = await caches.match(request);
  if (cached) return cached;

  // Fall back to root index.html (SPA entry point)
  const indexCached = await caches.match("/index.html") ||
                      await caches.match("/");
  if (indexCached) return indexCached;

  // Last resort — try network
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(new Request("/index.html"), response.clone());
    }
    return response;
  } catch {
    return offlinePage();
  }
}

// ── Strategy: Network First ───────────────────────────────────────────────────
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>GyanGrit — Offline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "DM Sans", system-ui, sans-serif;
      background: #0d1117; color: #e2e8f0;
      display: flex; align-items: center; justify-content: center;
      min-height: 100dvh; padding: 24px; text-align: center;
    }
    .card { max-width: 340px; width: 100%; }
    .icon { font-size: 56px; margin-bottom: 20px; display: block; }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 10px; color: #fff; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.7; margin-bottom: 20px; }
    .btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
    button {
      background: #3b82f6; color: #fff; border: none;
      padding: 12px 24px; border-radius: 10px; font-size: 14px;
      font-weight: 600; cursor: pointer; min-height: 48px;
    }
    button.secondary {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="icon">📚</span>
    <h1>No Connection</h1>
    <p>You're offline. Open the app once with internet to access your downloaded lessons offline.</p>
    <div class="btns">
      <button onclick="window.location.href='/downloads'">My Downloads</button>
      <button class="secondary" onclick="window.location.reload()">Retry</button>
    </div>
  </div>
</body>
</html>`,
    {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

// ── Background sync ──────────────────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-progress" || event.tag === "sync-offline-queue") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "SYNC_OFFLINE_QUEUE" });
        });
      })
    );
  }
});

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

  const path    = event.notification.data?.url || "/dashboard";
  const fullUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          client.navigate(fullUrl);
          return client;
        }
      }
      return clients.openWindow(fullUrl);
    })
  );
});

// ── Background Fetch ─────────────────────────────────────────────────────────
// Downloads survive navigation, tab close, and browser restart.
// fetch ID format: "gyangrit-video-{lessonId}" or "gyangrit-pdf-{lessonId}"

self.addEventListener("backgroundfetchsuccess", (event) => {
  const bgFetch = event.registration;
  event.waitUntil(handleBgFetchComplete(bgFetch, "success"));
});

self.addEventListener("backgroundfetchfail", (event) => {
  const bgFetch = event.registration;
  notifyClients({ type: "BG_FETCH_FAIL", fetchId: bgFetch.id });
});

self.addEventListener("backgroundfetchabort", (event) => {
  const bgFetch = event.registration;
  notifyClients({ type: "BG_FETCH_ABORT", fetchId: bgFetch.id });
});

async function handleBgFetchComplete(bgFetch, status) {
  const [record] = await bgFetch.matchAll();
  if (!record) {
    notifyClients({ type: "BG_FETCH_FAIL", fetchId: bgFetch.id });
    return;
  }

  const response = await record.responseReady;
  if (!response.ok) {
    notifyClients({ type: "BG_FETCH_FAIL", fetchId: bgFetch.id, error: response.status });
    return;
  }

  // Parse the fetch ID: "gyangrit-video-{lessonId}" or "gyangrit-pdf-{lessonId}"
  const id        = bgFetch.id;
  const parts     = id.split("-");
  const mediaType = parts[1];
  const lessonId  = parseInt(parts[2], 10);

  if (!lessonId || !mediaType) {
    notifyClients({ type: "BG_FETCH_FAIL", fetchId: id, error: "bad-id" });
    return;
  }

  const data        = await response.arrayBuffer();
  const contentType = response.headers.get("Content-Type") || "application/octet-stream";
  const url         = record.request.url;
  const fileName    = url.split("/").pop() || `lesson_${lessonId}`;

  const storeName = mediaType === "video" ? "videos" : "pdfs";
  const key       = mediaType === "video" ? `vid_${lessonId}` : `pdf_${lessonId}`;
  const item      = mediaType === "video"
    ? { id: key, lessonId, fileName, data, size: data.byteLength, mimeType: contentType, savedAt: new Date().toISOString() }
    : { id: key, lessonId, fileName, data, size: data.byteLength, savedAt: new Date().toISOString() };

  await idbPut("gyangrit-offline", 2, storeName, item);

  await self.registration.showNotification("GyanGrit", {
    body: `Download complete — ${mediaType === "video" ? "Video" : "PDF"} saved offline`,
    icon: "/icons/icon-192.png",
    tag:  `dl-complete-${id}`,
    data: { url: "/downloads" },
  });

  notifyClients({ type: "BG_FETCH_SUCCESS", fetchId: id, lessonId, mediaType });
}

function notifyClients(msg) {
  self.clients.matchAll({ type: "window" }).then((clients) => {
    clients.forEach((client) => client.postMessage(msg));
  });
}

// Minimal IndexedDB put from inside the SW (no external imports)
function idbPut(dbName, version, storeName, item) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, version);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(item);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror   = () => { db.close(); reject(tx.error); };
    };
    req.onerror = () => reject(req.error);
  });
}
