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

## 📋 Sprint 3 — To Do

| # | Issue | Priority |
|---|-------|----------|
| 9 | SectionLessonPage: same "Content coming soon" offline fix | 🟢 Low |
| 10 | Offline banner in AppLayout when offlineMode=true | 🟡 Medium |
| 11 | Auto-sync progress when back online after offline session | 🟡 Medium |
| 12 | iOS Safari: test IndexedDB quota & SW registration timing | 🔴 High |
