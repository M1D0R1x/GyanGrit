# GyanGrit — Master Task Tracker & Project State

> Single source of truth for project history, current state, bugs, and what to do next.
> Obsidian is dropped — everything lives here.
> Format: sessions in reverse-chronological order. Bugs inline. Architecture log at bottom.

---

## CURRENT STATE (as of 2026-03-26)

**Live URLs:**
- Frontend: https://gyan-grit.vercel.app
- Backend:  https://gyangrit.onrender.com
- Admin:    https://gyangrit.onrender.com/admin/

**Tech stack:** Django 4.2 · React 18 + Vite + TypeScript · PostgreSQL (Supabase) · Ably · LiveKit · Gemini · Cloudflare R2 · gunicorn + gevent

**Apps:** 16 backend apps · 41 frontend pages · 0 TS errors · 0 lint errors · 0 Django check issues

**SRS compliance:**
| FR | Requirement | Status |
|---|---|---|
| FR-01 | User management, OTP, roles | ✅ |
| FR-02 | Single-device sessions | ✅ |
| FR-03 | Content management | ✅ |
| FR-04 | Adaptive streaming (HLS) | ✅ |
| FR-05 | PWA offline | ❌ Not built yet |
| FR-06 | Exercises & flashcards | ✅ |
| FR-07 | Live sessions + attendance | ✅ |
| FR-08 | Competition rooms | ✅ |
| FR-09 | Progress tracking, badges | ✅ |
| FR-10 | Analytics & reports | ✅ |
| FR-11 | AI Chatbot (RAG) | ✅ |
| FR-12 | Security, RBAC | ✅ |
| FR-13 | API keys in env | ✅ |

**Only FR-05 (PWA offline) remains unbuilt.**

---

## OPEN BUGS

| # | Date | Bug | Status |
|---|---|---|---|
| 1 | 2026-03-24 | gevent + CONN_MAX_AGE=600 → DatabaseWrapper thread-sharing error on /health | ✅ FIXED: CONN_MAX_AGE=0 in prod.py + post_fork connection reset in gunicorn.conf.py |
| 2 | 2026-03-26 | Vercel build fail: LiveSessionPage onAction type mismatch (id vs LiveSession) | ✅ FIXED: wrapped handleJoin as (sess: LiveSession) => handleJoin(sess.id) |

**Zero open bugs as of 2026-03-26.**

---

## WHAT TO DO NEXT (prioritised)

### P0 — Deploy current build (30 min)
The gevent DB bug is fixed locally but not yet deployed. Production is returning 500s on some requests.

```bash
# After pushing to main:
# Render auto-deploys. Then in Render Shell:
python manage.py migrate
python manage.py bootstrap_chatrooms
python manage.py collectstatic --no-input
```

### P1 — PWA + Offline (Session next, ~2 days)
**SRS FR-05.** The last unchecked functional requirement. High-impact for the capstone submission because:
- Rural school context: spotty internet is real — this directly addresses it
- SRS explicitly calls out NFR-05: "core learning functional offline for pre-downloaded content"
- Differentiates GyanGrit from basic web apps

What to build:
1. `frontend/public/manifest.json` — makes app installable on Android
2. `frontend/public/sw.js` — Service Worker with cache-first strategy for:
   - App shell (CSS, JS, fonts)
   - Course list and lesson metadata
   - Previously opened lesson pages
3. `vite.config.ts` — register SW with `vite-plugin-pwa` or manual `workbox`
4. "Install App" banner in TopBar for eligible devices
5. Offline fallback page when fully offline with no cache

### P2 — File upload in chat (~1 hour)
The attach button exists in ChatRoomPage but calls `setError("connect to R2")`. Wire `uploadFile()` from `services/media.ts` to the existing file input.

Files:
- `frontend/src/pages/ChatRoomPage.tsx` — replace error with actual upload call
- No backend changes needed (R2 presigned URLs already work)

### P3 — UI polish pass (~2 days)
The UI works but isn't polished for a capstone demo. Priority areas:
1. **Mobile layout** — many pages have padding/font issues on 375px screens
2. **NavMenu → SidebarDrawer** — replace the "⚠️ Demo nav" warning with a proper slide-in sidebar for staff roles
3. **Empty states** — some pages show blank instead of a helpful empty state
4. **Loading skeletons** — missing on a few pages (FlashcardsStudyPage, LiveSessionPage)
5. **Dashboard polish** — student dashboard should surface "class chat has new message" and "live class starting soon"

### P4 — Integration smoke test (1 day)
Before submission, test the complete flow end-to-end:
- Register student via join code → complete profile → dashboard
- Teacher assigns flashcard deck → student studies → SM-2 schedules review
- Teacher starts live session → student joins → attendance recorded
- Student asks AI question → gets curriculum-relevant answer
- Teacher posts in chat → student bell shows notification
- Student enters competition → answers questions → sees live leaderboard

### P5 — Post-capstone features (after submission)
- SidebarDrawer component replacing NavMenu
- PWA push notifications (VAPID keys + service worker)
- Attendance analytics dashboard for principal
- Teacher creates competition from any assessment (not just existing ones)
- Flashcard import from CSV
- AI chatbot analytics for teachers (what questions students are asking)

---

## SESSION LOG (reverse chronological)

---

### SESSION 2026-03-26 — Flashcards + Live Video + AI Chatbot + Documentation

**Status:** ✅ COMPLETE

#### New backend apps

**`apps/flashcards/`**
- `FlashcardDeck`, `Flashcard`, `FlashcardProgress` models
- SM-2 spaced repetition algorithm in `FlashcardProgress.apply_rating()`
- 8 endpoints: teacher deck/card CRUD + student study flow (due cards, review, stats)
- Scoped: teachers see own decks; students see published decks for enrolled subjects
- Migration applied: `flashcards/0001_initial.py`

**`apps/livesessions/`**
- `LiveSession`, `LiveAttendance` models
- LiveKit JWT generation via PyJWT (not LiveKit SDK — avoids async issues)
- Teacher: `canPublish=True` (camera + mic); Student: `canPublish=False` (viewer)
- 7 endpoints: create, start, end, join, token, attendance, upcoming
- Ably notification to all students when teacher starts session
- Migration applied: `livesessions/0001_initial.py`

**`apps/ai_assistant/`**
- `ChatConversation`, `AIChatMessage` models
- Gemini 1.5 Flash API with curriculum RAG (course titles + lesson descriptions as context)
- Multi-turn conversations, subject-scoped, supports English/Hindi/Punjabi
- System prompt blocks off-curriculum questions
- 4 endpoints: list/get conversations, chat, delete
- Migration applied: `ai_assistant/0001_initial.py`

#### New frontend pages
- `FlashcardDecksPage` — teacher split panel: deck list + card editor
- `FlashcardsStudyPage` — student flip UI, SM-2 rating 0-3, session complete screen
- `LiveSessionPage` — teacher hosts LiveKit room, student joins; uses `@livekit/components-react`
- `AIChatPage` — Gemini chatbot with sidebar history, thinking indicator, disclaimer

#### New npm packages
- `@livekit/components-react`, `@livekit/components-styles`, `livekit-client`

#### New services
- `services/flashcards.ts`, `services/livesessions.ts`, `services/aiAssistant.ts`

#### NavMenu + router updated
- Flashcards, Live Classes, AI Tutor added to all role nav groups
- 12 new routes added (student + teacher + principal + admin)

#### Documentation updated
- `docs/SYSTEM_ARCHITECTURE_AND_DESIGN_DOCUMENTATION.md` — full rewrite
- `docs/DATA_MODEL.md` — new apps 10–14 added
- `docs/API_AND_FRONTEND_END_POINTS.md` — all new endpoints + routes documented
- `docs/DEPLOYMENT.md` — gunicorn fix, env vars, capacity table
- `tasks.md` — consolidated master tracker (this file)

#### Bugs fixed
- gevent + CONN_MAX_AGE=600 → DatabaseWrapper thread error: `CONN_MAX_AGE=0` + `post_fork` reset
- Vercel build: LiveSessionPage onAction type incompatibility fixed

---

### SESSION 2026-03-26 — Security, NavMenu, Capacity

- [x] OTP: `random.randint` → `secrets.randbelow()` (Bandit B311, cryptographically secure)
- [x] Bandit scan: 0 High issues, `pass_marks=3` false positive silenced with `#nosec`
- [x] NavMenu: Chat + Competitions wired for all roles
- [x] BottomNav: Leaderboard tab → Chat tab (more relevant day-to-day)
- [x] Leaderboard moved to NavMenu student Home group
- [x] gunicorn.conf.py: switched to gevent workers for 50-user capacity on Render free
- [x] CONN_MAX_AGE: set to 0 in prod.py (gevent + persistent connections = crashes)
- [x] gevent post_fork hook added to reset DB connections
- [x] testing/ folder created: TESTING_GUIDE.md, Bruno collection, Playwright starter, k6 load test

---

### SESSION 2026-03-25 — Chat Rooms + Push Notifications + Django Admin

#### Chat rooms complete redesign
- `ChatRoomMember` model added (explicit membership — enables push notifications + admin visibility)
- Room types: `subject` | `staff` | `officials` (dropped `class_general`)
- Signal redesign: `TeachingAssignment.post_save` creates rooms, `User.post_save` only enrolls
- `_create_notification_records()` — Notification rows created on every message send
- `_push_chat_notification()` — Ably REST publish to `notifications:{user_id}`
- `AuthContext` subscribes to `notifications:{user_id}` → dispatches `notif:new` event
- `TopBar` listens to `notif:new` → immediate bell badge update
- Admin default view: own institution's rooms (not all 80)
- `AdminChatManagementPage` added — split panel: room browser + message viewer
- `bootstrap_chatrooms` management command rewritten — only creates rooms where TA exists
- Bug fixed: signal was creating 12 phantom rooms per student registration

#### Ably token
- `getAblyToken(roomId?, channelType?)` — added `channelType` param
- `channel_type=chat` → student gets `chat:{room_id}` for all memberships + `notifications:{user_id}`
- `channel_type=competition` → student gets `competition:{room_id}` only (unchanged)

#### Django admin
- `django-unfold` v0.86 installed, all 10+ admin.py files patched to `UnfoldModelAdmin`
- `UNFOLD` config in `base.py` with GyanGrit branding + grouped sidebar

---

### SESSION 2026-03-24 — Competition Rooms + SectionLessonPage Route

- `SectionLessonPage` route `/lessons/section/:lessonId` added (page existed, no route)
- `apps.competitions` Django app: CompetitionRoom, CompetitionParticipant, CompetitionAnswer
- 7 competition endpoints + Ably Pub/Sub (REST HTTP API, not SDK)
- `POST /api/v1/realtime/token/` — Ably JWT vending
- `CompetitionRoomPage.tsx` — full live competition UI
- Ably v3 SDK is async-only → rewrote to use Ably REST HTTP API via `requests` lib
- ABLY_API_KEY added to Render env vars

---

### SESSION 2026-03-23 — Deployment Fixes

- Vercel build error: `uploadFile` arg order in AdminLessonEditorPage
- Health endpoint: removed `@login_required` (was causing 302 redirect)
- prod.py: `_parse_hosts()` + `_parse_origins()` defensive parsers (strip trailing slashes)
- whitenoise added to `requirements/base.txt` (was prod-only, broke local dev)
- Keep-alive ping in `AuthContext.tsx` — pings `/health/` every 10 min in prod
- Fast2SMS OTP wired: `services.py` complete, `views.py` calls `send_otp()`
- Gmail SMTP added to `base.py`
- Fly.io abandoned (blocks Indian accounts with ₹900 verification)

---

### SESSION 2026-03-22 — Bug Fixes, Routes, Deployment Prep

- `teacher_course_analytics` scoped to assigned subjects only
- `AdminAssessmentBuilderPage` back nav: `useLocation` prefix detection
- `PrincipalDashboardPage` class cards → `/principal/classes/:id`
- `/profile` + `/notifications` moved to shared routes
- `prod.py` complete rewrite: env-based, SameSite=None, HSTS, logging
- WhiteNoise in MIDDLEWARE, cookie names in `base.py`
- `requirements/prod.txt`: dj-database-url + whitenoise[brotli]
- `backend/build.sh`, `frontend/vercel.json` created

---

### SESSION 2026-03-18 — Gradebook, Dashboard Polish, Analytics

- Gradebook app: `GradeEntry` model (term/category/marks/percentage)
- 6 gradebook endpoints
- `GradebookPage` (expandable rows, add/edit/delete, filters)
- `TeacherClassDetailPage`: "Gradebook →" button
- `PrincipalDashboardPage` + `OfficialDashboardPage`: real data wired
- `DashboardPage`: assessments section + score rings + resume button
- `LessonPage`: YouTube/Vimeo embed, R2 video, PDF inline, Markdown
- `NavMenu` component: role-aware supervisor demo nav
- All 3 major docs written

---

### SESSION 2026-03-17 — Gamification, Notifications, Slugs

- `PointEvent` ledger, `StudentPoints`, 9 badge types, streaks
- Class + school leaderboard
- `Notification` + `Broadcast` models, 8 endpoints
- Auto-notify on lesson/assessment publish (signals)
- Human-readable URL slugs for courses + assessments
- `NotificationsPage`: inbox, send form, broadcast history, Markdown render

---

### SESSION 2026-03-15 — Core Platform

- Full Django backend: accounts, academics, content, assessments, learning, roster, media
- Role system: STUDENT < TEACHER < PRINCIPAL < OFFICIAL < ADMIN
- Join-code registration, OTP, single-device enforcement
- Signal-driven auto-enrollment
- All 23 Punjab districts seeded
- Full React frontend: auth flow, student dashboard, lesson page, assessment engine
- Cloudflare R2 media management

---

## ARCHITECTURE DECISIONS LOG

| Decision | Rationale | Date |
|---|---|---|
| gevent workers for gunicorn | 50 concurrent users on Render free 512MB. Sync workers handle 1 req at a time. | 2026-03-26 |
| CONN_MAX_AGE=0 with gevent | Persistent connections bound to creation thread → crash with gevent green threads | 2026-03-26 |
| post_fork DB connection reset | Ensures clean DB state per worker after fork | 2026-03-26 |
| PyJWT for LiveKit tokens (not LiveKit SDK) | LiveKit Python SDK is async-only — incompatible with sync Django views | 2026-03-26 |
| Gemini 1.5 Flash for AI chatbot | Free tier (1,500 req/day), 1M context, supports English/Hindi/Punjabi, no server needed | 2026-03-26 |
| LiveKit Cloud (not self-hosted) | No server to configure, no UDP ports to expose. Free tier handles capstone demo (5k min/mo). | 2026-03-26 |
| SM-2 for flashcard scheduling | Industry-standard spaced repetition (same as Anki). Self-contained, no external service. | 2026-03-26 |
| ChatRoomMember explicit model | Without it: cannot push notifications, cannot check membership efficiently, cannot show member count | 2026-03-25 |
| Rooms only from TeachingAssignment | Student registration was creating 12 phantom rooms. Rooms should only exist where a teacher teaches. | 2026-03-25 |
| Ably REST HTTP API (not SDK) | Ably Python v3 SDK is async-only → 500 errors in sync Django views | 2026-03-25 |
| django-unfold for admin | Free, zero-config, beautiful. Makes the admin usable for non-technical supervisors. | 2026-03-25 |
| Ably Pub/Sub for competitions | Custom message shapes needed (scores, timers, leaderboard). Raw channel control required. | 2026-03-24 |
| Ably for chat rooms | Subject rooms need per-room subscriptions scoped by membership JWT | 2026-03-24 |
| Single Ably app/key for all real-time | One key, JWT scoping controls capabilities per user per context | 2026-03-24 |
| Vercel for frontend | Best Vite/React SPA deploy. Free. Mumbai edge. Auto-deploy on push. | 2026-03-23 |
| Render for backend | Free tier + keep-alive = no cold starts. Only affordable APAC option. | 2026-03-23 |
| Fly.io abandoned | Blocks Indian accounts with ₹900 verification. | 2026-03-23 |
| Keep-alive in AuthContext | Frontend pings /health/ every 10 min. Prevents Render 15-minute sleep. | 2026-03-23 |
| Fast2SMS for OTP SMS | ₹0.15/SMS, Indian numbers, free ₹50 trial. | 2026-03-23 |
| Gmail SMTP as OTP fallback | When mobile_primary empty or Fast2SMS fails. | 2026-03-23 |
| secrets.randbelow() for OTP | random.randint is not cryptographically secure (Bandit B311). | 2026-03-26 |
| PostgreSQL via Supabase (all envs) | No SQLite anywhere. Supabase = managed Postgres, pgBouncer, Mumbai region. | 2026-03-15 |
| DISABLE_SERVER_SIDE_CURSORS=True | Required for Supabase pgBouncer transaction-mode pooling. | 2026-03-15 |
| Signal-driven enrollment | Keeps each app responsible for its own domain. No cross-app enrollment in views. | 2026-03-15 |
| PointEvent ledger for gamification | Deduplication guard. Re-running a signal never double-awards points. | 2026-03-17 |
| Human-readable URL slugs | Course/assessment URLs use grade+subject, not numeric IDs. Better UX + sharing. | 2026-03-17 |
