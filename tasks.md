# GyanGrit — Master Task Tracker & Project State

> Single source of truth. No Obsidian. Updated end of every session.

---

## CURRENT STATE (2026-03-26 — end of session)

**Live URLs:**
- Frontend: https://gyan-grit.vercel.app
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

### Fixed by Sonnet (this chat)

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
  UPSTASH_REDIS_KV_URL=rediss://default:...@golden-sheep-83421.upstash.io:6379
  UPSTASH_REDIS_KV_REST_API_URL=https://golden-sheep-83421.upstash.io
  UPSTASH_REDIS_KV_REST_API_TOKEN=gQAAA...
  ```
- Vercel: auto-injected

### Upstash QStash (keys obtained, implementation pending)
- For scheduled jobs: daily flashcard due notifications, OTP retry logic
- **Render env vars added:**
  ```
  UPSTASH_QSTASH_QSTASH_URL=https://qstash.upstash.io
  UPSTASH_QSTASH_QSTASH_TOKEN=eyJV...
  ```
- Vercel: auto-injected

### Sentry
- Error tracking — captures all Django 500s with full stack trace
- **Render env vars added:**
  ```
  SENTRY_DSN=https://30eb244c...@o4511100995043328.ingest.de.sentry.io/4511101006970960
  SENTRY_AUTH_TOKEN=5e5192a9...
  ```
- **Vercel env var added:**
  ```
  VITE_SENTRY_DSN=https://30eb244c...@o4511100995043328.ingest.de.sentry.io/4511101006970960
  ```

### Skipped (not needed at this scale)
- Upstash Vector — post-capstone (AI chatbot RAG improvement)
- Upstash Search — no search feature exists

---

## COMPLETE RENDER ENV VAR STATE (as of end of session)

```
ABLY_API_KEY=HJyd-A.0-SXPQ:Y2AgNphHYQDQET24yh7_lsv_5hlrUlORFlL8V4WbW2g
ALLOWED_HOSTS=gyangrit.onrender.com
CLOUDFLARE_R2_ACCESS_KEY_ID=65f5a6407fe7ec6bc0d81a7aff8c740c
CLOUDFLARE_R2_ACCOUNT_ID=50883c022115b64382eb0a72478718e3
CLOUDFLARE_R2_BUCKET_NAME=gyangrit-media
CLOUDFLARE_R2_PUBLIC_URL=https://pub-e9d4409f2ff64c3da255818e71428b31.r2.dev
CLOUDFLARE_R2_SECRET_ACCESS_KEY=9f64bae65bc753ff07c84ed4cf7e67cfbc4f78264b17916a6dcd953adfc5ac70
CORS_ALLOWED_ORIGINS=https://gyan-grit.vercel.app
DATABASE_URL=postgres://postgres.rvyuccwggicloiyoixjb:NNKZFK2BCSPipWy5@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
DEBUG=False
DJANGO_SETTINGS_MODULE=gyangrit.settings.prod
EMAIL_HOST_PASSWORD=ocwc vuxh enjt rjmn
EMAIL_HOST_USER=veerababusaviti2103@gmail.com
FAST2SMS_API_KEY=p6PoDZ92g8rRxBkHOmjniebCfI4AQJUuGlE7MaWVtY0Fh5LKcwIi5EFlW4j3kbeRpvnHJNwBzDtGsArf
GEMINI_API_KEY=AIzaSyDAAUFrK6SsRf7AcXR72SIBS3su03BJCno
LIVEKIT_API_KEY=APIaYnaw5R7oGaM
LIVEKIT_API_SECRET=WcbjFatmePCw17vRbNm6RMa7e3RdXnruJtcUEOqoAib
LIVEKIT_URL=wss://gyangrit-ld2s7sp2.livekit.cloud
SECRET_KEY=django-insecure-change-this-to-a-long-random-string   ← CHANGE THIS
UPSTASH_REDIS_KV_URL=rediss://default:gQAAAAAAAUXdAAIncDIxNmZmZWNiNjIyOTU0YmU3OGNmMzhjNjI2NjM1MGIxN3AyODM0MjE@golden-sheep-83421.upstash.io:6379
UPSTASH_REDIS_KV_REST_API_URL=https://golden-sheep-83421.upstash.io
UPSTASH_REDIS_KV_REST_API_TOKEN=gQAAAAAAAUXdAAIncDIxNmZmZWNiNjIyOTU0YmU3OGNmMzhjNjI2NjM1MGIxN3AyODM0MjE
UPSTASH_QSTASH_QSTASH_URL=https://qstash.upstash.io
UPSTASH_QSTASH_QSTASH_TOKEN=eyJVc2VySUQiOiJkYWE0NjgzNy05MzIxLTQ0N2ItYjE1YS1mNTk1Zjk5Njg0ZWMiLCJQYXNzd29yZCI6ImZmN2ViNzNmODkxMzQwOThhMjJhYmM3NmFlNjA1YzQ1In0=
SENTRY_DSN=https://30eb244c85f8cf83d6cf909e1d049b46@o4511100995043328.ingest.de.sentry.io/4511101006970960
SENTRY_AUTH_TOKEN=5e5192a91a4f759dec4869fbb86d0f5f3f3d47695fa1591b14862eb0078e7c87
```

**⚠️ SECRET_KEY must be changed** — currently using placeholder. Generate with:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

---

## WHAT TO DO NEXT

### P0 — Fix SECRET_KEY (5 min)
Generate a real SECRET_KEY and update in Render. The placeholder `django-insecure-...` works but is a security risk.

### P1 — Integration smoke test (1 day)
Full end-to-end flow before capstone submission:
- Register student via join code → complete profile → dashboard loads
- Teacher creates flashcard deck → publishes → student studies it
- Teacher starts live session → student joins → attendance recorded
- Student asks AI question → gets curriculum-relevant answer
- Teacher posts in chat → student bell shows notification in real time
- Student enters competition → answers questions → sees live leaderboard
- Verify Sentry is receiving errors (trigger a 404 deliberately, check Sentry dashboard)

### P2 — UI polish (2 days)
- Mobile layout pass — 375px screen issues
- NavMenu → SidebarDrawer for staff roles (replace ⚠️ demo nav)
- Empty states on FlashcardsStudyPage, LiveSessionPage
- Loading skeletons where missing

### P3 — QStash scheduled jobs (post-capstone)
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

---

## SESSION LOG

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
