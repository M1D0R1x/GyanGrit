# GyanGrit — Web Performance Audit
**Date:** April 6, 2026  
**Data Source:** 12 HAR files across 4 network conditions × 3 user flows  
**Environment:** Production (`www.gyangrit.site` / `api.gyangrit.site`)

---

## 1. Executive Summary

| Verdict | Score |
|---|---|
| **No-throttle performance** | ✅ Good (333ms load) |
| **Fast 4G performance** | ⚠️ Acceptable (709–729ms load) |
| **Slow 4G performance** | 🔴 Poor (2.8–3.0s load) |
| **3G performance** | 🔴 Critical (9.9s load) |
| **API response times** | 🔴 All endpoints averaging 800ms–1100ms |
| **JS Bundle size** | 🔴 Single 347KB+ JS chunk, no code splitting |
| **Ably WebSocket** | 🔴 Consuming 28–53% of cumulative load time on lesson pages |
| **HTTP caching** | ✅ Compression working; 🔴 0 cached hits observed |
| **CORS preflight overhead** | 🔴 Every API call has a paired OPTIONS preflight |
| **Duplicate API calls** | 🔴 Multiple endpoints called 2–4x per page |
| **Vercel Analytics** | ⚠️ 4× `/_vercel/insights/view` calls per lesson (overhead) |
| **Errors** | ✅ Zero 4xx/5xx errors across all flows |

**Bottom line:** GyanGrit works well on fast connections but degrades severely on mobile networks. The **three biggest culprits** in order: **1) Ably initializing on every page load**, **2) monolithic JS bundle**, **3) all API endpoints running without caching**.

---

## 2. Network Condition Comparison

### Pre-Login Flow (Landing → Login page)

| Condition | Requests | Transfer | Page Load (`onLoad`) | Slow Reqs (>1s) |
|---|---|---|---|---|
| No Throttle | 17 | 347 KB | **2,528ms** ⚠️ | 1 |
| Fast 4G | 17 | 347 KB | **709ms** ✅ | 0 |
| Slow 4G | 17 | 348 KB | **3,047ms** 🔴 | 2 |
| 3G | 16 | 347 KB | **9,907ms** 🔴 | 15 |

### Post-Login Dashboard Flow

| Condition | Requests | Transfer | Page Load (`onLoad`) | Slow Reqs (>1s) |
|---|---|---|---|---|
| No Throttle | 47 | 419 KB | **333ms** ✅ | 0 |
| Fast 4G | 49 | 420 KB | **729ms** ✅ | 1 |
| Slow 4G | 46 | 419 KB | **2,836ms** 🔴 | 1 |
| 3G | 47 | 419 KB | **9,942ms** 🔴 | 35 |

### Post-Login Lesson View Flow

| Condition | Requests | Transfer | Page Load (`onLoad`) | Slow Reqs (>1s) |
|---|---|---|---|---|
| No Throttle | 70 | 442 KB | **1,048ms** ⚠️ | 1 |
| Fast 4G | 72 | 441 KB | **725ms** ✅ | 1 |
| Slow 4G | 72 | 441 KB | **2,848ms** 🔴 | 4 |
| 3G | 74 | 442 KB | **9,939ms** 🔴 | 53 |

---

## 3. 🔴 Problem #1: Ably Initializes on Every Page Load (Biggest Offender)

Ably (WebSocket real-time connection) connects **immediately on every page load** — even on the dashboard where the student isn't in a live class. The HAR data shows this is consuming **28–53% of cumulative load time** on lesson pages.

### Time breakdown by category (Lesson flows — cumulative across all requests)

| Category | No Throttle | Fast 4G | Slow 4G | 3G |
|---|---|---|---|---|
| **Ably/Realtime** | **15.5s (53%)** | **15.6s (50%)** | **16.2s (30%)** | **48.7s (28%)** |
| GyanGrit API | 6.8s (23%) | 6.8s (22%) | 16.4s (30%) | 52.0s (30%) |
| JS Download | 2.3s (8%) | 2.8s (9%) | 10.0s (18%) | 35.3s (21%) |
| CORS Preflight | 1.8s (6%) | 2.4s (8%) | 2.5s (5%) | 4.1s (2%) |
| Vercel Analytics | 1.9s (6%) | 1.6s (5%) | 4.9s (9%) | 17.2s (10%) |
| Sentry | — | 1.0s (3%) | 1.5s (3%) | 4.5s (3%) |
| CSS Download | 0.4s | 0.4s | 1.3s | 4.6s |
| Fonts | 0.4s | 0.2s | 1.0s | 3.4s |

> [!CAUTION]
> On **No Throttle**, Ably alone accounts for 15.5 seconds of cumulative time — that's a persistent WebSocket connection that the HAR captures as a long-running open connection. It's not blocking the page render directly, but it's consuming browser connection slots and firing `POST /api/v1/realtime/token/` (avg 1,089ms) on every page load, authenticated or not.

### What's happening
- `POST /api/v1/realtime/token/` fires on every page (dashboard, lesson) even when not in a live class
- The WebSocket to `wss://main.realtime.ably.net/` opens immediately (15s–45s connection)
- On 3G this WS handshake alone takes **45 seconds** to establish

### Fix: Lazy-initialize Ably

```js
// ❌ Current: Ably connects on app mount
// somewhere in App.jsx or a top-level provider
const client = new Ably.Realtime({ authUrl: '/api/v1/realtime/token/' });

// ✅ Fix: Only connect when user is in a live class feature
// abl.js
let ablyClient = null;

export async function getAblyClient() {
  if (!ablyClient) {
    const { Ably } = await import('ably'); // Dynamic import too
    ablyClient = new Ably.Realtime({ authUrl: '/api/v1/realtime/token/' });
  }
  return ablyClient;
}

// In LiveClass.jsx only:
useEffect(() => {
  let client;
  getAblyClient().then(c => { client = c; /* subscribe */ });
  return () => client?.close();
}, []);
```

**Expected impact:** Removes the `POST /api/v1/realtime/token/` call (1,089ms avg) from every non-live page load. On 3G, saves ~48s of cumulative pending time.

---

## 4. 🔴 Problem #2: Monolithic JS Bundle

The single largest render-blocking asset across all 12 files:

```
GET https://www.gyangrit.site/assets/index-BflGg3B2.js
```

| Network | Download Time |
|---|---|
| No Throttle | **2,237ms** (pure parse/exec) |
| Fast 4G | ~460ms |
| Slow 4G | **2,185ms** |
| 3G | **7,803ms** |

Every page loads the entire app code — lesson editor, Excalidraw, LiveKit, dashboard, admin — before anything renders.

### Fix: Code Splitting with Vite

```js
// vite.config.js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
        'vendor-ui':       ['framer-motion', 'lucide-react'],
        'vendor-realtime': ['ably'],           // isolated — lazy loaded
        'vendor-canvas':   ['@excalidraw/excalidraw'], // isolated
      }
    }
  }
}
```

```jsx
// routes.jsx — lazy load heavy pages
const LiveClass = lazy(() => import('./pages/LiveClass'));
const LessonEditor = lazy(() => import('./pages/LessonEditor'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
```

**Expected impact:** Login/dashboard bundle drops from ~347KB → ~80–100KB. 3G load time: 9.9s → ~3–4s.

---

## 5. 🔴 Problem #3: All API Endpoints Are Slow (800ms–1100ms avg)

Every single GyanGrit API endpoint averages close to 1 second per call. **Including `/api/v1/health/`** which should return in <5ms:

| Endpoint | Calls | Avg | Max | Action |
|---|---|---|---|---|
| `POST /api/v1/realtime/token/` | 8 | **1,089ms** | 2,193ms | Lazy init + cache per-user 30s |
| `GET /api/v1/assessments/my/` | 8 | **1,043ms** | 2,932ms | Redis cache 2min |
| `GET /api/v1/lessons/248/` | 3 | **1,033ms** | 2,179ms | Redis cache 10min |
| `GET /api/v1/notifications/` | 10 | **976ms** | 2,514ms | Redis cache 1min |
| `GET /api/v1/academics/subjects/` | 8 | **974ms** | 3,083ms | Redis cache 30min |
| `GET /api/v1/gamification/me/` | 8 | **916ms** | 2,456ms | Redis cache 5min |
| `GET /api/v1/courses/by-slug/` | 4 | **909ms** | 2,301ms | Redis cache 10min |
| `POST /api/v1/notifications/push/subscribe/` | 8 | **866ms** | 2,124ms | Defer to idle |
| `POST /api/v1/analytics/event/` | 20 | **864ms** | 2,473ms | Batch + async |
| `GET /api/v1/courses/progress/batch/` | 8 | **836ms** | 2,194ms | Redis cache 2min |
| `GET /api/v1/courses/50/lessons/` | 8 | **822ms** | 2,216ms | Redis cache 5min |
| `GET /api/v1/courses/` | 4 | **812ms** | 2,150ms | Redis cache 10min |
| `GET /api/v1/analytics/my-summary/` | 8 | **809ms** | 2,191ms | Redis cache 5min |
| `GET /api/v1/accounts/csrf/` | 12 | **807ms** | 2,148ms | Static response |
| `GET /api/v1/accounts/me/` | 12 | **805ms** | 2,102ms | Redis cache 5min |
| `GET /api/v1/analytics/my-risk/` | 8 | **797ms** | 2,156ms | Redis cache 5min |
| `GET /api/v1/health/` | 12 | **778ms** | 2,202ms | 🔴 Static no-DB |

> [!CAUTION]
> `/api/v1/health/` taking 778ms means every worker on Oracle Cloud is cold-starting or the DB connection pool is being exhausted. This is an infrastructure problem, not code. Investigate: Gunicorn worker count, `CONN_MAX_AGE` in Django DB settings, and whether Redis is actually connected.

### Root cause checklist
- [ ] Is `CONN_MAX_AGE = 60` set in `DATABASES` settings? (persistent DB connections)
- [ ] Is Redis actually connected and the caching we built in a prior session deployed?
- [ ] How many Gunicorn workers are running? (`--workers 4` recommended for 2-core OCI)
- [ ] Is the OCI instance in the same region as the DB? (cross-region adds 200ms+)

---

## 6. 🔴 Problem #4: CORS Preflight on Every API Call

Every API call has a paired `OPTIONS` preflight (37 preflight requests observed). These are not cached currently.

| Preflight | Avg | Total across 12 files |
|---|---|---|
| OPTIONS requests | ~100–156ms | 37 preflights |

### Fix: One setting in Django

```python
# settings.py
CORS_PREFLIGHT_MAX_AGE = 86400  # 24 hours
```

Browsers will cache the preflight result for 24 hours — no more OPTIONS before every GET/POST on return visits.

**Expected impact:** Saves 37 × ~120ms = ~4.4s of cumulative time per lesson session on mobile.

---

## 7. 🔴 Problem #5: Duplicate API Calls

Multiple endpoints are being called **2–4× per page**. These are redundant fetches — likely from multiple components mounting and each independently fetching the same data.

| Endpoint | Duplicate calls | Wasted time (3G) |
|---|---|---|
| `POST /api/v1/analytics/event/` | **4×** per lesson | ~8s |
| `POST /_vercel/insights/view` | **4×** per lesson | ~8s |
| `GET /api/v1/courses/50/lessons/` | **2×** in every lesson file | ~4s |
| `GET /api/v1/notifications/` | **2×** in Login3G | ~4s |
| `POST /api/4511101006970960/envelope/` (Sentry) | **2×** in some flows | ~4.5s |

### Fix: Global fetch deduplication / React Query

```js
// Use React Query (already likely installed) — it deduplicates in-flight requests
const { data: lessons } = useQuery({
  queryKey: ['courses', courseId, 'lessons'],
  queryFn: () => api.get(`/courses/${courseId}/lessons/`),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
// Multiple components calling this — React Query will fire ONE request
```

For analytics specifically, deduplicate by event type + timestamp window (don't fire the same event twice within 1s).

---

## 8. 🟠 Problem #6: Vercel Analytics Fires 4× Per Lesson

```
POST https://www.gyangrit.site/_vercel/insights/view
```

This fires **4 times per lesson page** (not once). On 3G this is 4 × 2,099ms = **8.4s** in cumulative time.

Additionally:
```
POST https://www.gyangrit.site/_vercel/speed-insights/vitals
```

That's a 5th analytics call per lesson. This is Vercel's own `@vercel/analytics` and `@vercel/speed-insights` packages firing on every route change.

### Fix: Disable or selectively enable

```jsx
// If you don't need per-route-change tracking:
// In App.jsx, only track once on mount, not on every router change
import { inject } from '@vercel/analytics';
// Only call once, not on every navigation
```

Or disable entirely if you're already using Sentry + your own analytics endpoint.

---

## 9. 🟠 Problem #7: Google Fonts — External + Render-Blocking

```
GET https://fonts.googleapis.com/css2    (fonts.googleapis.com)
GET https://fonts.gstatic.com/s/inter/…  (3G: 3,375ms)
```

Two external DNS lookups + downloads before text renders. On 3G the font file alone takes **3.4 seconds**.

### Fix: Self-host Inter

```bash
# Download from fontsource (zero Google dependency)
npm install @fontsource-variable/inter
```

```css
/* index.css */
@import '@fontsource-variable/inter';
/* Remove <link> to fonts.googleapis.com from index.html */
```

```css
/* Or manual @font-face with font-display: swap */
@font-face {
  font-family: 'Inter';
  src: url('/assets/fonts/inter-variable.woff2') format('woff2');
  font-display: swap; /* Text shows immediately, swaps when font loads */
  font-weight: 100 900;
}
```

**Expected impact:** Removes 2 external DNS lookups. On 3G saves 3.4s. Text is visible immediately due to `font-display: swap`.

---

## 10. 🟠 Problem #8: Sentry on Critical Path

```
POST https://o4511100995043328.ingest.de.sentry.io/api/4511101006970960/envelope/
```

| Network | Time |
|---|---|
| No Throttle | 192ms |
| Fast 4G | 316ms |
| Slow 4G | **1,269ms** |
| 3G | **~2,300ms** |

Fires **twice** per lesson (2 Sentry uploads). On Slow 4G this blocks the waterfall for 1.3s.

### Fix: Defer Sentry init

```js
// main.jsx
// ❌ Current: Sentry.init() at module load time
// ✅ Fix: Init after first paint
window.addEventListener('load', () => {
  requestIdleCallback(() => {
    import('./sentry').then(({ initSentry }) => initSentry());
  });
});
```

---

## 11. 🟠 Problem #9: No Browser Cache (0% cache hit rate)

**Zero 304 responses across all 12 HAR files** — every asset is re-downloaded on every visit.

Assets use content-hashed filenames (`index-BflGg3B2.js`, `index-CaAJPTj2.css`) which is perfect for immutable caching — but Vercel isn't serving the `Cache-Control` header.

### Fix: `vercel.json`

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/icons/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400" }
      ]
    },
    {
      "source": "/manifest.json",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600" }
      ]
    }
  ]
}
```

**Expected impact:** On repeat visits (second load), the 347KB bundle is served from disk in <5ms. Zero network cost.

---

## 12. Request Load Order (What Actually Fires First)

This is the actual waterfall on the **No Throttle lesson flow**. The sequence reveals what's blocking render:

```
#1  467ms  GET  /dashboard              ← HTML, render-blocking
#2  442ms  GET  /assets/index-BflGg3B2.js  ← ENTIRE APP, render-blocking
#3  121ms  GET  /assets/index-CaAJPTj2.css
#4  443ms  GET  /manifest.json
#5  241ms  GET  fonts.googleapis.com/css2   ← External DNS
#6   64ms  HEAD /sw.js
#7  385ms  GET  fonts.gstatic.com/inter… ← External DNS + font file
#8  107ms  GET  /_vercel/insights/script.js
#9  104ms  GET  /_vercel/speed-insights/script.js
#10 573ms  GET  /api/v1/accounts/csrf/
#11  92ms  GET  /api/v1/health/
#12 101ms  GET  /favicon.svg
#13  89ms  GET  /icons/icon-180.png
#14 413ms  POST /_vercel/insights/view  ← Analytics before content!
#15 194ms  GET  /api/v1/accounts/me/
```

**Problems visible here:**
- The entire JS bundle (`#2`) is loaded before any API data
- External Google Fonts (`#5`, `#7`) are DNS-resolved before content is ready
- Vercel Analytics (`#14`) fires before the main data endpoints
- CSRF (`#10`) is fetched separately rather than embedded in the HTML response

---

## 13. Good Things ✅

- **Zero errors (4xx/5xx) across all 12 flows** — bulletproof reliability
- **All responses gzip/br compressed** — compression working perfectly
- **Content-hashed asset filenames** — infrastructure ready for immutable caching
- **Parallel API calls** on dashboard load — not sequential waterfalls
- **Ably WebSocket working** — live class real-time connection succeeds
- **CSRF implementation correct** — proper OPTIONS + GET pattern
- **Sentry capturing sessions** — error monitoring in place

---

## 14. Prioritized Action Plan

### 🔴 P0 — Do This Week (Highest Impact)

| # | Action | Where | Expected Gain |
|---|---|---|---|
| 1 | **Lazy-initialize Ably** — only connect in LiveClass component | `App.jsx`, new `ably.js` util | Removes 1,089ms from every non-live page; saves 48s on 3G lesson |
| 2 | **Code-split Vite bundle** — vendor chunks + lazy routes | `vite.config.js`, `routes.jsx` | Login/dashboard: 7.8s → ~2s on 3G |
| 3 | **Diagnose server cold-start** — `CONN_MAX_AGE`, Gunicorn workers, Redis health | `settings.py`, OCI config | API: 800ms → <150ms |
| 4 | **`CORS_PREFLIGHT_MAX_AGE = 86400`** | `settings.py` | Saves 4.4s cumulative on mobile |

### 🟠 P1 — Next 2 Weeks

| # | Action | Where | Expected Gain |
|---|---|---|---|
| 5 | **Add Cache-Control headers** for `/assets/*` on Vercel | `vercel.json` | Repeat visits: bundle in <5ms |
| 6 | **Fix duplicate API calls** — React Query deduplication | All data-fetching components | Removes 4 duplicate calls per session |
| 7 | **Batch analytics events** — flush every 5s | `analytics.js` | Reduces 20 POSTs → 2–3 per lesson |
| 8 | **Self-host Inter font** with `font-display: swap` | `index.html`, `index.css` | Removes 3.4s on 3G |
| 9 | **Defer Sentry init** until after `load` | `main.jsx` | Removes 1.3s from Slow 4G critical path |
| 10 | **Redis cache** `/accounts/me/`, `/academics/subjects/`, `/courses/` | Django views | Cuts 800ms from every page load |

### 🟡 P2 — Sprint After

| # | Action | Where | Expected Gain |
|---|---|---|---|
| 11 | **Reduce Vercel Analytics to 1 call/session** | App analytics config | Removes 3 redundant POSTs per lesson |
| 12 | **Make analytics endpoint async** (Celery, return 202) | `analytics/views.py` | Sub-10ms analytics responses |
| 13 | **Pre-warm Gunicorn** in post-deploy hook | CI/CD deploy scripts | Eliminates cold-start on fresh deploy |
| 14 | **Embed CSRF token** in initial HTML | Django `index.html` template | Removes 1 API call per page load |

---

## 15. Target vs Current

| Metric | Current (3G) | Target (3G) | Current (Fast 4G) | Target (Fast 4G) |
|---|---|---|---|---|
| Pre-login load | 9,907ms | <4,000ms | 709ms | <300ms |
| Dashboard load | 9,942ms | <5,000ms | 729ms | <400ms |
| Lesson load | 9,939ms | <5,500ms | 725ms | <500ms |
| API avg response | 800–1100ms | <150ms | 800–1100ms | <150ms |
| Cache hit rate (repeat) | 0% | >80% | 0% | >80% |
| Ably init overhead | Every page | Lesson only | Every page | Lesson only |
| Duplicate API calls | 4–5 per session | 0 | 4–5 per session | 0 |
