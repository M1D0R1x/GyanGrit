# GyanGrit — Master Task Tracker & Project State

> Single source of truth. No Obsidian. Updated end of every session.

---

## CURRENT STATE (2026-03-26 — end of session)

**Live URLs:**
- Frontend: https://gyangrit.site
- Backend:  https://gyangrit.onrender.com
- Admin:    https://gyangrit.onrender.com/admin/

**Stack:** Django 4.2 · React 18 + Vite + TypeScript · PostgreSQL (Supabase) · Ably · LiveKit · Gemini · Cloudflare R2 · gunicorn + gevent · Upstash Redis · Sentry

**Scale:** 16 backend apps · 41 frontend pages · 0 TS errors · 0 lint errors · 0 Django check issues

---

## SRS COMPLIANCE

| FR | Requirement | Status |
|---|---|---|
| FR-01 | User management, OTP, roles | ✅ |
| FR-02 | Single-device sessions | ✅ |
| FR-03 | Content management | ✅ |
| FR-04 | Adaptive streaming (HLS) | ✅ |
| FR-05 | PWA offline | ✅ Done this session |
| FR-06 | Exercises & flashcards | ✅ |
| FR-07 | Live sessions + attendance | ✅ |
| FR-08 | Competition rooms | ✅ |
| FR-09 | Progress tracking, badges | ✅ |
| FR-10 | Analytics & reports | ✅ |
| FR-11 | AI Chatbot (RAG) | ✅ |
| FR-12 | Security, RBAC | ✅ |
| FR-13 | API keys in env | ✅ |

**All 13 FRs complete.**

---

## OPEN BUGS

None. All resolved.

---

## WHAT WAS DONE THIS SESSION

### 2026-03-27 — Infinite Obsidian UI Stabilization & Pre-Merge
1. **Live Session UI/UX**: Merged stabilization hooks (Hand Raise, In-Room Chat, permissions) into the Infinite Obsidian `LiveSessionPage.tsx` and upgraded the Calendar/Datetime picker to use native glassmorphism styled components (`obsidian-input`).
2. **Dropdown Sorting Fix**: Audited class/section dropdowns globally and patched `UserManagementPage.tsx` and `AdminJoinCodesPage.tsx` to ensure sections sort strictly by descending numerical order (12, 11, 10...) instead of alphabetically.
3. **Hex Routing**: Implemented alphanumeric hex slugs for Live Session routing (`/live/:publicId`) against refresh bugs.
4. **Backend Welcome Notification**: Wired `Notification.send()` into `complete_profile` to dispatch a personalized welcome message upon successful registration.
5. **Documentation Parity**: Updated all architectural files in `docs/` and `.claude/` to reflect React 19 standards and the updated routing endpoints.

### Fixed by Sonnet (Previous session)

**`@login_required` → `@require_auth` across all 70 views in 11 apps**
- Root cause: Django's `@login_required` redirects unauthenticated requests to `/accounts/login/` (302) which doesn't exist → 404
- Fix: replaced with `@require_auth` from `accesscontrol/permissions.py` which returns 401 JSON
- Affected: chatrooms, notifications, livesessions, ai_assistant, competitions, academics, assessments, content, flashcards, gamification, learning

**`fail_silently=False` → `True` in `accounts/services.py`**
- Root cause: SMTP connection failure during OTP delivery was propagating as unhandled exception → 500 on login for TEACHER/PRINCIPAL/OFFICIAL roles
- Fix: `fail_silently=True` in `_send_otp_email()`

**Vercel Analytics + Speed Insights wired**
- `@vercel/analytics` + `@vercel/speed-insights` installed and imported in `main.tsx`
- Using `/react` imports (not `/next`)

### Fixed by Opus (separate session — changes already in repo)

1. **`sw.js` removed from `.gitignore`** — was preventing Service Worker from deploying to Vercel
2. **`vercel.json`** — explicit routes for `sw.js`, `manifest.json`, icons BEFORE SPA catch-all. Correct `Content-Type` headers.
3. **`frontend/.env.production`** — build-time fallback for `VITE_API_URL` + `VITE_SENTRY_DSN`
4. **`frontend/src/main.tsx`** — Sentry SDK init. SW registration pre-checks content-type before registering.
5. **`frontend/src/auth/AuthContext.tsx`** — `retryWithBackoff()` for CSRF init: 3 retries with exponential backoff (2s→4s→8s) for Render cold starts
6. **`frontend/src/services/api.ts`** — `initCsrf()` throws on non-ok so retry logic catches 502s
7. **`frontend/public/sw.js`** — cross-origin API calls no longer intercepted by SW. Removed API caching (was dangerous). Cache version bumped to v2.
8. **`frontend/public/manifest.json`** — removed `screenshots` array (files don't exist)
9. **`frontend/public/favicon.svg`** — created gradient "G" logo (was referenced but missing)
10. **`backend/gyangrit/settings/prod.py`** — Sentry SDK integration + Upstash Redis session store
11. **`backend/requirements/prod.txt`** — added `sentry-sdk[django]>=2.0` and `redis>=5.0`

---

## NEW INFRASTRUCTURE ADDED THIS SESSION

### Upstash Redis
- Session storage (swap from PostgreSQL → Redis = faster auth)
- Cache backend for leaderboards, subject lists, course lists
- **Render env vars added:**
  ```

  ```
- Vercel: auto-injected

### Upstash QStash (keys obtained, implementation pending)
- For scheduled jobs: daily flashcard due notifications, OTP retry logic
- **Render env vars added:**
  ```

  ```
- Vercel: auto-injected

### Sentry
- Error tracking — captures all Django 500s with full stack trace
- **Render env vars added:**
  ```
- **Vercel env var added:**
  ```
  ```

### Skipped (not needed at this scale)
- Upstash Vector — post-capstone (AI chatbot RAG improvement)
- Upstash Search — no search feature exists

---

## COMPLETE RENDER ENV VAR STATE (as of end of session)



---

## WHAT TO DO NEXT

### P0 — Grand Production Merge (Next Immediate Step)
- Merge the fully verified "Infinite Obsidian" staging files from `.antigravity/edits/frontend/src/` directly into the live `frontend/src/` folder.
- Run `npm run build` and ensure the production artifacts are stable.

### P1 — Authentication & Identity Expansion
- **Password Recovery System:** Implement "Forgot Password" and "Reset Password" user flows on the frontend (`LoginPage.tsx`) and link them with the Django backend mechanisms.
- **Domain Email Binding:** Hook up the official custom domain email configuration to the Django SMTP system for outgoing OTPs and alerts.

### P2 — Fix SECRET_KEY (5 min)
Generate a real SECRET_KEY and update in Render. The placeholder `django-insecure-...` works but is a security risk.

### P3 — UI polish & Analytics
- Mobile layout pass — 375px screen issues
- NavMenu → SidebarDrawer for staff roles (replace ⚠️ demo nav)
- Empty states on FlashcardsStudyPage, LiveSessionPage
- Build the dedicated `AnalyticsPage` in Infinite Obsidian for capturing the telemetry generated by LiveKit interactions.

### P4 — QStash scheduled jobs (post-capstone)
- Daily "N flashcards due today" push notification per student
- Weekly progress digest
- OTP retry via queue when Fast2SMS fails

### P4 — Upstash Vector (post-capstone)
- Embed lesson content as vectors
- Semantic search for AI chatbot context (better than raw text injection)

---

## ARCHITECTURE DECISIONS LOG

| Decision | Rationale | Date |
|---|---|---|
| Upstash Redis for sessions | Swap DB sessions → Redis = faster auth on every request | 2026-03-26 |
| Sentry for error tracking | Was flying blind on 500s. Full stack trace in 30s. | 2026-03-26 |
| QStash keys obtained, impl later | Scheduled jobs not blocking capstone | 2026-03-26 |
| Upstash Vector skipped | Gemini 1M context window sufficient for capstone RAG | 2026-03-26 |
| Upstash Search skipped | No search feature in SRS | 2026-03-26 |
| require_auth not login_required | Django login_required redirects to /accounts/login/ (302→404). require_auth returns 401 JSON. | 2026-03-26 |
| fail_silently=True in send_otp | SMTP failure must never crash login endpoint | 2026-03-26 |
| SW no longer caches API | Cross-origin API caching via SW was dangerous — stale auth responses | 2026-03-26 |
| CSRF retry with backoff | Render free tier takes 30-60s to wake — 3 retries (2s→4s→8s) survive this window | 2026-03-26 |
| gevent workers | 50 concurrent users on Render free 512MB | 2026-03-26 |
| CONN_MAX_AGE=0 | Persistent connections bound to creation thread crash with gevent | 2026-03-26 |
| post_fork DB reset | Clean DB state per green thread | 2026-03-26 |
| PyJWT for LiveKit tokens | LiveKit Python SDK is async-only | 2026-03-26 |
| Gemini 1.5 Flash | Free tier, 1M context, English/Hindi/Punjabi | 2026-03-26 |
| SM-2 for flashcards | Same algorithm as Anki, self-contained | 2026-03-26 |
| ChatRoomMember explicit | Enables push notifications + membership checks | 2026-03-25 |
| Rooms only from TeachingAssignment | Student registration was creating phantom rooms | 2026-03-25 |
| Ably REST HTTP API | Ably Python v3 SDK is async-only | 2026-03-25 |
| django-unfold | Beautiful admin, zero config | 2026-03-25 |
| secrets.randbelow() for OTP | random.randint is not cryptographically secure | 2026-03-26 |
| Vercel frontend | Free, Mumbai edge, auto-deploy | 2026-03-23 |
| Render backend | Free + keep-alive = no cold starts | 2026-03-23 |
| Fly.io abandoned | Blocks Indian accounts with ₹900 verification | 2026-03-23 |
| Fast2SMS for OTP | ₹0.15/SMS, Indian numbers | 2026-03-23 |
| Signal-driven enrollment | No cross-app enrollment in views | 2026-03-15 |
| PointEvent ledger | Deduplication guard for gamification | 2026-03-17 |
| Human-readable URL slugs | grade+subject not numeric IDs | 2026-03-17 |
| Async OTP via threading.Thread | Login blocked 6s on SMTP — fire-and-forget thread returns instantly. Safe with gthread workers. | 2026-03-27 |
| Email-first OTP delivery | Fast2SMS Quick route unreliable (DLT, rate limits). Gmail SMTP is free and instant. | 2026-03-27 |
| Vercel immutable cache | Hashed assets cached 1yr, repeat 3G visits load from disk | 2026-03-27 |
| Vite modulePreload: false | Default preload injected 4MB Excalidraw into every page load | 2026-03-27 |

---

## SESSION LOG

### 2026-03-27 — Performance Optimization & OTP Overhaul
- **Vite 3G Load Time Optimization**: Disabled Vite's aggressive `modulePreload` and removed `manualChunks` from `vite.config.ts`, restoring native lazy-loading boundaries. Dropped initial Dashboard JS payload from 5.4MB (which was eagerly downloading Excalidraw) down to ~600KB, slashing 3G load times from 40s to ~3s.
- **Async OTP Delivery**: Rewrote `services.py` to use `threading.Thread` for fire-and-forget OTP dispatch. Login response now returns instantly instead of blocking 6s on SMTP/SMS timeout. Structured timing logs track delivery latency per channel.
- **Email-First OTP Priority**: Swapped OTP delivery order from SMS→Email to **Email→SMS→Log**. Gmail SMTP is free, reliable, and instant. Fast2SMS demoted to fallback due to DLT restrictions.
- **Vercel Immutable Cache Headers**: Added `Cache-Control: public, max-age=31536000, immutable` for all `/assets/*` in `vercel.json`. Repeat visits on 3G load instantly from disk cache.
- **Sentry Noise Reduction**: Added global filter in `main.tsx` to automatically drop harmless Ably WebSocket `Connection closed` disconnect events, preventing alert spam on room navigation.
- Configured native Hex `/live/:publicId` routing for resilient session reloading.
- Admin Chat grouping by school integrated directly into `ChatRoomPage.tsx`.
- Hand-raise hooks, whiteboard persistence, and role-based permissions merged successfully into the new `LiveSessionPage.tsx`.
- Class section selection dropdowns across `UserManagementPage` & `AdminJoinCodesPage` patched to ensure purely descending numerical logic.
- Calendar datetime input stylized using `obsidian-form-group` UI language.
- New Registration Welcome Notification dispatched off `complete_profile` status.
- **Frontend API Error Parsing**: Upgraded `api.ts` to natively intercept and parse raw Django `<!doctype html>` 404/500 error pages, replacing them with clean text bounds.
- Documentation synced for React 19 standards globally.

### 2026-03-26 — PWA + Chat Upload + Infra + Bug Fixes
- PWA: sw.js, manifest, icons, SW registration, install banner
- Chat file upload wired to R2
- @login_required → @require_auth (70 views, 11 apps)
- fail_silently fix in OTP email delivery
- Vercel Analytics + Speed Insights
- Upstash Redis, QStash, Sentry keys obtained and added to Render + Vercel
- Opus: SW MIME fix, CSRF retry backoff, Sentry Django init, Redis session store
- docs/tasks.md updated

### 2026-03-25 — Chat Rooms + Competitions + Django Admin
- ChatRoomMember model, push notifications, Ably token scoping
- Competition rooms with Ably Pub/Sub
- django-unfold admin theme
- AdminChatManagementPage

### 2026-03-24 — Flashcards + Live Sessions + AI Chatbot
- apps/flashcards (SM-2 algorithm)
- apps/livesessions (LiveKit WebRTC)
- apps/ai_assistant (Gemini RAG)
- 4 new frontend pages

### 2026-03-23 — Deployment Fixes
- Render + Vercel deployment working
- Keep-alive ping, Fast2SMS OTP, Gmail SMTP fallback

### 2026-03-22 — Routes, Analytics, Security
- All dashboard routes fixed
- gevent workers + CONN_MAX_AGE=0
- secrets.randbelow() for OTP

### 2026-03-18 — Gradebook + Dashboard Polish
- Gradebook app
- All dashboards wired with real data
- LessonPage media handling

### 2026-03-17 — Gamification + Notifications
- Full gamification system
- Notifications + broadcasts
- Human-readable URL slugs

### 2026-03-15 — Core Platform
- Full backend + frontend
- Auth, academics, content, assessments, learning, roster
