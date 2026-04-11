# GyanGrit — UX & Offline Sprint Tracker

> Updated: 2026-04-06

---

## ✅ Sprint 1 — Connection & Offline UX (Done)

| # | Issue | Status | Files |
|---|-------|--------|-------|
| 1 | Slow connection bar blocking TopBar nav | ✅ Fixed | `OfflineStatusBar.tsx` |
| 2 | Video download stuck at 0% | ✅ Fixed | `hooks/useOffline.ts` |
| 3 | Saved lessons "Content coming soon" instead of offline message | ✅ Fixed | `pages/LessonPage.tsx` |
| 4 | Mobile PWA icons/fonts too small | ✅ Fixed | `index.css` |

---

## ✅ Sprint 2 — Offline-First PWA (Done)

| # | Issue | Status | Files |
|---|-------|--------|-------|
| 5 | App doesn't load at all when offline (SW not caching Vite bundles) | ✅ Fixed | `public/sw.js` |
| 6 | Infinite spinner on mobile PWA when offline | ✅ Fixed | `auth/AuthContext.tsx` |
| 7 | Login shows raw API URL in error (e.g. "Failed to fetch api.gyangrit.site") | ✅ Fixed | `pages/LoginPage.tsx`, `services/api.ts` |
| 8 | Students forced to login every time even with downloaded content | ✅ Fixed | `auth/AuthContext.tsx`, `auth/RequireRole.tsx` |

### Sprint 2 Fix Details

**#5 — App won't load offline**
- Root: SW `SHELL_URLS` only cached HTML/icons. Vite bundles (`/assets/*.js`, `/assets/*.css`) have content-hash filenames — never precached.
- Fix: SW v4 adds `cacheFirstImmutable()` strategy for all `/assets/*` files. They're cached on **first fetch while online** and served from cache offline forever after.

**#6 — Infinite spinner / auth loop**
- Root: `AuthContext` calls `initCsrf()` + `/accounts/me/` on every boot. Offline → 3 retries × 2s/4s/8s delay = 14+ seconds, then redirects to login which tries again.
- Fix: `AuthContext` now caches `UserProfile` to `localStorage` on login. On offline boot → restores immediately, sets `offlineMode=true`, zero network calls.

**#7 — Raw API URL in error messages**
- Root: `fetch()` throws `TypeError: Failed to fetch https://api.gyangrit.site/...` — `api.ts` rethrew raw error, LoginPage showed it verbatim.
- Fix: `sanitizeNetworkError()` in `api.ts` converts any fetch TypeError to a user-friendly message. `LoginPage` also checks `navigator.onLine` before submitting.

**#8 — Login required even with downloaded lessons**
- Root: `RequireRole` redirects to `/login` whenever `auth.authenticated === false`. Offline = unauthenticated = no access.
- Fix: `RequireRole` now checks `auth.offlineMode` — cached users are allowed through without live authentication. Auth type updated with `offlineMode: boolean`.

---

## ✅ Sprint 3 — Offline UX + P2 Performance (In Progress)

> Updated: 2026-04-11

| # | Issue | Status | Files |
|---|-------|--------|-------|
| 9 | SectionLessonPage offline fallback | ✅ Done | `pages/SectionLessonPage.tsx` |
| 10 | Offline mode banner in AppLayout | ✅ Done | `components/AppLayout.tsx` |
| 11 | Auto-sync analytics heartbeats when back online | ✅ Done | `services/analytics.ts`, `services/offline.ts`, `services/offlineSync.ts` |
| 12 | iOS Safari: test IndexedDB quota & SW registration | ⏳ Manual | Needs physical device testing |

### Sprint 3 Fix Details

**#9 — SectionLessonPage offline fallback**
- Mirrored the `LessonPage` offline pattern into `SectionLessonPage`. On API failure, loads from IndexedDB with OFFLINE badge and differentiated empty states (no text vs not downloaded).

**#10 — Offline banner in AppLayout**
- Added persistent glassmorphism banner below TopBar when `auth.offlineMode === true`. Non-blocking, dismissible, with wifi-off icon. Distinct from OfflineStatusBar toasts.

**#11 — Auto-sync heartbeats on reconnect**
- `sendHeartbeat()` now queues to IndexedDB via `enqueueOfflineAction("analytics_heartbeat", ...)` when offline instead of silently dropping.
- Added `analytics_heartbeat` case to `offlineSync.ts` processor.
- Heartbeats are replayed through the existing FIFO queue on reconnect.

---

## ✅ P2 Performance Audit

| # | Item | Status | Files |
|---|------|--------|-------|
| 14 | Manifest screenshots for install prompt | ✅ Done | `manifest.json`, `public/screenshots/` |
| 15 | Windows tile branding | ✅ Done (P0) | `index.html` |
| 16 | Server cold-start diagnosis | ⏳ Manual | Needs SSH to Oracle Cloud |
| 17 | Async analytics endpoint (return 202) | ✅ Done | `analytics/views.py` |
| 18 | Embed CSRF in HTML | ⏸ Skipped | N/A — Vercel serves frontend, Django serves API |

### P2 Fix Details

**#14 — Manifest screenshots**
- Added phone (narrow) and tablet (wide) screenshots to `manifest.json`. These appear in the Android install prompt.

**#17 — Async analytics**
- `heartbeat()` and `log_event()` endpoints now return `202 Accepted` immediately.
- Actual DB write runs in a daemon `threading.Thread`. Response time drops from ~864ms to <10ms.
- Background thread includes `close_old_connections()` for DB cleanup and `logger.exception()` for error visibility.

**#13 — SW precache verification (P1 leftover)**
- Confirmed: `injectSWBundles()` Vite plugin correctly injects 12 hashed bundle URLs into `dist/sw.js` at build time. Offline boot is reliable after deploy.

