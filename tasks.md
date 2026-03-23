# GyanGrit — Task Tracker

> Session-by-session task log. Mark [x] when done. Never delete old entries.
> todo file is for bug reports only. This file drives all planned work.

---

## SESSION 2026-03-15 — Core Auth, Academics, Content, Assessments

- [x] Custom User model (STUDENT/TEACHER/PRINCIPAL/OFFICIAL/ADMIN)
- [x] JoinCode-based registration (role locked by code)
- [x] OTP verification for TEACHER/PRINCIPAL/OFFICIAL
- [x] Single-device session enforcement (SingleActiveSessionMiddleware + DeviceSession)
- [x] Student self-registration via StudentRegistrationRecord
- [x] Public ID generation (S-2026-a1b2c3d4 format)
- [x] 23 Punjab districts seeded
- [x] Institution → ClassRoom → Section hierarchy
- [x] Subject, ClassSubject, StudentSubject, TeachingAssignment
- [x] Signal-driven auto-enrollment (new student → subjects → courses)
- [x] Course + Lesson + SectionLesson models
- [x] LessonProgress tracking
- [x] Assessment → Question → QuestionOption (is_correct never sent to students)
- [x] AssessmentAttempt with single-query scoring
- [x] Enrollment + LearningPath + LearningPathCourse
- [x] Roster Excel bulk upload (per-row error reporting)
- [x] Media app: Cloudflare R2 presigned URLs

---

## SESSION 2026-03-17 — Gamification, Notifications, Slugs, Frontend Polish

- [x] PointEvent ledger (deduplication guard)
- [x] StudentPoints (denormalized total, select_for_update)
- [x] 9 badge types, StudentBadge, StudentStreak
- [x] Class + School leaderboard
- [x] DashboardPage gamification strip
- [x] Notification + Broadcast models
- [x] 8 notification endpoints + audience scoping
- [x] signals.py: auto-notify on lesson/assessment publish
- [x] R2 file attachments for broadcasts
- [x] NotificationsPage: inbox, send form, broadcast history, Markdown render
- [x] Human-readable URL slugs for courses + assessments
- [x] course_by_slug endpoint
- [x] All affected pages migrated to slug routes

---

## SESSION 2026-03-18 — Gradebook, Dashboard Polish, Analytics Fixes

- [x] Gradebook app: GradeEntry model (term/category/marks/total_marks/percentage)
- [x] 6 gradebook endpoints (choices, CRUD, class view, student view)
- [x] GradebookPage (expandable student rows, add/edit/delete marks, filters)
- [x] TeacherClassDetailPage: "Gradebook →" button
- [x] PrincipalDashboardPage: real data wired
- [x] OfficialDashboardPage: real data wired
- [x] DashboardPage: assessments section + score rings + resume button
- [x] LessonPage: YouTube/Vimeo embed, R2 video, PDF inline viewer, Markdown
- [x] TeacherDashboardPage: all analytics fields aligned
- [x] UserManagementPage: section dropdown fixed (uses short_label)
- [x] NotificationsPage: "View all" wired in TopBar panel
- [x] NavMenu component: role-aware supervisor demo nav
- [x] TopBar: NavMenu wired in
- [x] DATA_MODEL.md, API_AND_FRONTEND_END_POINTS.md, SYSTEM_ARCHITECTURE.md — full sync

---

## SESSION 2026-03-22 — Bug Fixes, Principal/Official Routes, Deployment Prep

- [x] teacher_course_analytics — TEACHER scoped to assigned subjects (not all 60)
- [x] AdminAssessmentBuilderPage — back nav useLocation prefix detection
- [x] NavMenu — dead-end items fixed, footer explanation added
- [x] PrincipalDashboardPage — class cards use /principal/classes/:id
- [x] TeacherClassDetailPage + TeacherStudentDetailPage — useLocation prefix
- [x] router.tsx — /profile + /notifications shared; principal class routes added
- [x] prod.py — complete rewrite (env-based, SameSite=None, HSTS, logging)
- [x] base.py — WhiteNoise in MIDDLEWARE; cookie names in base
- [x] requirements/prod.txt — dj-database-url + whitenoise[brotli]
- [x] backend/.env.example — full env var template (gitignored)
- [x] backend/build.sh — Render build script
- [x] frontend/vercel.json — SPA rewrites
- [x] tasks.md, docs/BACKEND_DEPLOYMENT_RENDER.md, docs/FRONTEND_DEPLOYMENT_VERCEL.md

---

## SESSION 2026-03-23 — Deployment Fixes, Keep-alive, OTP, SMTP

- [x] Vercel TS build error fixed: AdminLessonEditorPage uploadFile arg order
- [x] health endpoint: @login_required removed (was redirecting to /accounts/login/)
- [x] prod.py: defensive _parse_hosts() and _parse_origins() — strips trailing slashes
- [x] whitenoise added to requirements/base.txt (was prod-only, broke local dev)
- [x] Keep-alive ping added to AuthContext.tsx — pings /health/ every 10 min in prod
- [x] Fast2SMS OTP fully wired: services.py complete, views.py calls send_otp()
- [x] Gmail SMTP added to base.py (EMAIL_HOST=smtp.gmail.com, port 587 TLS)
- [x] dev.py: EMAIL_BACKEND=console (OTP prints to terminal, no real emails in dev)
- [x] Fly.io files removed (Dockerfile, fly.toml, BACKEND_DEPLOYMENT_FLYIO.md)
      Reason: Fly.io blocks Indian accounts with ₹900 verification. Staying on Render.
- [x] Fast2SMS API key + Gmail credentials added to Render env vars

---

## SESSION 2026-03-24 — SectionLessonPage Router Fix + Competition Rooms (Ably Pub/Sub)

**Date:** 2026-03-24
**Goal:** Wire SectionLessonPage into router, then build Competition Rooms end-to-end.

### Part A — SectionLessonPage router fix (30 min)
- [ ] Add `/lessons/section/:lessonId` route to router.tsx
      Page exists at `frontend/src/pages/SectionLessonPage.tsx` but has no route
      Check if LessonPage already handles section lessons — if so, delete SectionLessonPage

### Part B — Competition Rooms backend (Django app)
- [ ] `pip install ably` → add to requirements/base.txt
- [ ] Add ABLY_API_KEY to Render env vars (sign up at ably.com first)
- [ ] Create `backend/apps/competitions/` Django app with full structure
- [ ] CompetitionRoom model: room_id, title, host (teacher), section, status, scheduled_at, questions (FK Assessment), created_at
- [ ] CompetitionParticipant model: room, student, score, rank, joined_at
- [ ] 5 backend endpoints:
      GET  /api/v1/competitions/                   → list rooms (scoped by role)
      POST /api/v1/competitions/create/            → teacher creates room
      POST /api/v1/competitions/<id>/join/         → student joins
      GET  /api/v1/competitions/<id>/              → room detail + participants
      POST /api/v1/competitions/<id>/submit/       → student submits answer
- [ ] POST /api/v1/realtime/token/ → Ably JWT endpoint (new `realtime` app)
      Token scoped to room channel: `competition:{room_id}`
      Student can only get token for rooms they're enrolled in
- [ ] Migrations
- [ ] Wire into gyangrit/urls.py

### Part C — Competition Rooms frontend
- [ ] npm install ably
- [ ] New service: `frontend/src/services/competitions.ts`
- [ ] New page: `frontend/src/pages/CompetitionRoomPage.tsx`
      Teacher view: create room, start/stop, live leaderboard
      Student view: join room, answer questions, live score updates
- [ ] Add routes to router.tsx:
      /competitions                    (STUDENT — list + join)
      /teacher/competitions            (TEACHER — manage rooms)
      /competitions/:roomId            (STUDENT — active room)
      /teacher/competitions/:roomId    (TEACHER — control panel)
- [ ] Add to NavMenu for TEACHER + STUDENT

---

## SESSION 2026-03-25 — Chat Rooms (Ably Chat SDK)

**Date:** 2026-03-25
**Goal:** Build class-based chat rooms using Ably Chat SDK.

### Part A — Chat Rooms backend
- [ ] Create `backend/apps/chatrooms/` Django app
- [ ] ChatRoom model: section (FK), is_active, created_at
      (One room per section — automatically exists for all sections)
- [ ] ChatMessage model: room, sender, content, sent_at
      (Log messages to DB for history — Ably handles live delivery)
- [ ] 3 backend endpoints:
      GET  /api/v1/chat/rooms/              → list rooms for the user's section/class
      GET  /api/v1/chat/rooms/<id>/history/ → last 50 messages from DB
      POST /api/v1/chat/rooms/<id>/message/ → save message to DB (called after Ably publish)
- [ ] Ably JWT for chat scoped to: `chat:{section_id}`
      Add chat channel support to existing realtime token endpoint
- [ ] Migrations + wire into urls.py

### Part B — Chat Rooms frontend
- [ ] npm install @ably/chat
- [ ] New service: `frontend/src/services/chat.ts`
- [ ] New page: `frontend/src/pages/ChatRoomPage.tsx`
      Shows message history, real-time new messages via Ably Chat
      Typing indicators, online presence
      Teacher can pin messages + moderate
- [ ] Add routes to router.tsx:
      /chat              (STUDENT — their section's chat room)
      /teacher/chat      (TEACHER — their section's chat room)
- [ ] Add to NavMenu for TEACHER + STUDENT

---

## SESSION 2026-03-26 — NavMenu Redesign (Post-Capstone Polish)

**Date:** Post-capstone
**Goal:** Replace temporary supervisor demo NavMenu with proper sidebar/drawer nav.

- [ ] Remove NavMenu.tsx ⚠️ warning banner
- [ ] Build SidebarDrawer component for staff roles (TEACHER/PRINCIPAL/OFFICIAL/ADMIN)
      Slides in from left, role-colored header, grouped sections
      Persists open/closed state in localStorage
- [ ] Student view: remove NavMenu entirely (BottomNav is sufficient)
- [ ] Wire SidebarDrawer into TopBar replacing current NavMenu button

---

## Architecture Decisions Log

| Decision | Rationale | Date |
|---|---|---|
| Ably Pub/Sub for competition rooms | Custom message shape needed (scores, timers, question sync). Raw channel control required. | 2026-03-22 |
| Ably Chat for chat rooms | Built-in typing indicators, history, presence. No need to build from scratch. | 2026-03-22 |
| Same Ably app/key for both | One app, one key, JWT scoping controls channel access per user. | 2026-03-22 |
| Vercel for frontend | Best Vite/React SPA deploy. Free tier. Mumbai edge. Auto-deploy on push. | 2026-03-22 |
| Render for backend | Free tier + keep-alive ping = no cold starts. Only APAC affordable option. | 2026-03-23 |
| Fly.io abandoned | Blocked new Indian accounts with ₹900 verification. | 2026-03-23 |
| Keep-alive in AuthContext | Frontend pings /health/ every 10 min in prod. Eliminates Render cold start. | 2026-03-23 |
| Fast2SMS for OTP SMS | ₹0.15/SMS, Indian numbers, free ₹50 trial. Fully implemented. | 2026-03-23 |
| Gmail SMTP as OTP fallback | When no mobile_primary or Fast2SMS fails — email fallback. | 2026-03-23 |
| No AI/PWA for capstone | Out of scope for submission timeline. Post-capstone. | 2026-03-22 |
