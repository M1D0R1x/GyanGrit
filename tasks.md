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
**Status:** ✅ COMPLETE

### Part A — SectionLessonPage router fix
- [x] Added `/lessons/section/:lessonId` route to router.tsx
      SectionLessonPage.tsx already existed with full implementation — just lacked a route

### Part B — Competition Rooms backend
- [x] `ably>=2.0` added to requirements/base.txt; pip3 install ably done locally
- [x] `apps.competitions` Django app created with full structure
- [x] CompetitionRoom model (title, host, section, assessment FK, status draft/active/finished)
- [x] CompetitionParticipant model (unique_together room+student, score, rank)
- [x] CompetitionAnswer model (is_correct NEVER sent to students — same rule as assessments)
- [x] 7 endpoints implemented:
      GET  /api/v1/competitions/              — list (scoped by role/section)
      POST /api/v1/competitions/create/       — teacher creates
      GET  /api/v1/competitions/<id>/         — detail + participants + questions (active only)
      POST /api/v1/competitions/<id>/join/    — student joins
      POST /api/v1/competitions/<id>/start/   — teacher starts, fires Ably room:started
      POST /api/v1/competitions/<id>/finish/  — teacher ends, fires Ably room:finished + final leaderboard
      POST /api/v1/competitions/<id>/answer/  — student answers, recalculates + broadcasts leaderboard
- [x] POST /api/v1/realtime/token/ — Ably JWT scoped to competition:{room_id} for students,
      competition:* for teachers. Graceful 503 if ABLY_API_KEY not set.
- [x] Migrations applied (competitions/0001_initial.py)
- [x] Registered in INSTALLED_APPS + gyangrit/urls.py
- [x] manage.py check = 0 errors

### Part C — Competition Rooms frontend
- [x] npm install ably (ably@3.1.1)
- [x] `frontend/src/services/competitions.ts` — full typed API service (7 calls + Ably token)
- [x] `frontend/src/pages/CompetitionRoomPage.tsx` — complete page:
      List view: rooms with status badges, teacher create form
      Room detail (student): lobby → answer questions → live leaderboard
      Room detail (teacher): correct answers visible, start/end controls, live leaderboard
      Ably subscribe: room:started, room:scores, room:finished
      Polling fallback every 5s when Ably key not set
- [x] router.tsx: competition routes added for STUDENT, TEACHER, PRINCIPAL, ADMIN
- [x] npx tsc --noEmit = 0 errors

### Pending (need Ably API key)
- [x] ABLY_API_KEY added to Render environment variables
- [ ] Add competition/chat links to NavMenu (SESSION 2026-03-26 — UI polish)

---

## SESSION 2026-03-25 (Part 3) — Chat Rooms Complete Redesign

**Status:** ✅ COMPLETE

### Architecture changes
- Dropped class_general room type — replaced entirely by subject rooms
- Added ChatRoomMember model — explicit membership for push notifications + admin visibility
- Room types: subject (Section × Subject) | staff (per institution) | officials (platform-wide)
- Lazy creation via signals — no upfront room flood
- Admin's list is filterable (institution_id, room_type, search)

### Backend
- [x] ChatRoomMember model (unique_together room+user, indexed)
- [x] bootstrap_chatrooms rewritten — creates 19 rooms, 47 memberships from existing data
- [x] Signal redesign:
      STUDENT joins section → create all subject rooms for that section, enroll them
      TEACHER assigned → create subject room, enroll teacher + existing students of section
      PRINCIPAL → staff room + officials room enrollment
      OFFICIAL → officials room enrollment
- [x] _push_chat_notification() — Ably REST publish to notifications:{user_id} for each member
- [x] list_rooms — membership-based query (no more role-based room construction)
- [x] admin_list_rooms, admin_room_messages — admin management endpoints
- [x] room_members endpoint added
- [x] Ably token endpoint updated: student capability covers all their chat room channels + notifications:{user_id}
- [x] Migrations applied, manage.py check = 0

### Frontend
- [x] ChatRoomPage.tsx — complete rewrite:
      Push notification toasts (Ably notifications:{user_id} channel)
      MonitoringBanner — "This chat is monitored by school administration"
      Sidebar grouped: Officials / Staff / Subject
      Threads work correctly (reply sends via handleSend(content, parentId))
      Students see reply-only notice in subject rooms
      Teachers see post + reply + pin + file attach
      5s polling fallback
- [x] AdminChatManagementPage.tsx — new admin-only page
      Grouped by institution, filterable by type/search
      Split panel: room list + message viewer
      Role-coloured dots per sender
- [x] chat.ts service updated — adminListRooms, adminGetRoomMessages, getRoomMembers
- [x] router.tsx — /admin/chat-management route added
- [x] npx tsc --noEmit = 0 | npm run lint = 0 errors 0 warnings

---

## SESSION 2026-03-25 — Chat Rooms (Ably Chat SDK)

**Date:** 2026-03-25
**Status:** ✅ COMPLETE

### Part A — Chat Rooms backend
- [x] `apps.chatrooms` Django app created
- [x] ChatRoom model: OneToOne with Section (auto-created on first access)
- [x] ChatMessage model: room, sender, content, is_pinned, sent_at
- [x] 6 endpoints:
      GET  /api/v1/chat/rooms/                         — list visible rooms
      GET  /api/v1/chat/rooms/<id>/                    — room detail
      GET  /api/v1/chat/rooms/<id>/history/            — last 50 messages
      POST /api/v1/chat/rooms/<id>/message/            — persist message after Ably send
      POST /api/v1/chat/rooms/<id>/pin/<msg_id>/       — teacher pin/unpin toggle
      GET  /api/v1/chat/rooms/<id>/pinned/             — list pinned messages
- [x] Ably token endpoint extended: channel_type=\chat\ returns [chat]{section_id} capability
      Students: subscribe+publish to their section channel only
      Teachers: subscribe+publish to [chat]* (all sections)
- [x] Migrations applied (chatrooms/0001_initial.py)
- [x] Registered in INSTALLED_APPS + urls.py

### Part B — Chat Rooms frontend
- [x] npm install @ably/chat
- [x] `frontend/src/services/chat.ts` — typed API service
- [x] `frontend/src/pages/ChatRoomPage.tsx` — complete chat UI:
      Message bubbles (own right, others left), role-colored sender badges
      Teacher sidebar showing all section rooms (multi-section support)
      Optimistic message send with real ID replacement on save
      Ably real-time subscribe to message + pin events
      Online presence counter via Ably presence
      Teacher pin/unpin via hover actions
      Pinned message indicator (📌 badge on bubble)
      Scrolls to bottom on new messages
      BottomNav shown for students only
- [x] router.tsx: chat routes added for STUDENT, TEACHER, PRINCIPAL, ADMIN
- [x] npx tsc --noEmit = 0 errors

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
