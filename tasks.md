# GyanGrit — Task Tracker

> Session-by-session task log. Mark off with [x] when done.
> Add new sessions at the bottom. Never delete old entries — they are the history.

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

## SESSION 2026-03-23 — Deployment Fixes, Keep-alive, OTP, Cleanup

- [x] Vercel TS error fixed: AdminLessonEditorPage uploadFile arg order
      (setProgress was passed as displayName string slot → now undefined, setProgress)
- [x] health endpoint: removed @login_required (was redirecting to /accounts/login/)
- [x] prod.py: defensive _parse_hosts() and _parse_origins()
      Strips https:// and trailing slashes from env vars — prevents CORS errors
- [x] whitenoise added to requirements/base.txt (was prod-only, broke local dev)
- [x] Keep-alive ping added to AuthContext.tsx
      Pings /api/v1/health/ every 10 min in production — prevents Render cold starts
      Only runs when import.meta.env.PROD is true — silent in dev
- [x] Fast2SMS OTP: confirmed fully implemented in services.py + wired in views.py
      No code changes needed — just set FAST2SMS_API_KEY in Render env vars
- [x] Fly.io abandoned — blocked new Indian accounts with ₹900 verification
      Removed: backend/Dockerfile, backend/fly.toml, docs/BACKEND_DEPLOYMENT_FLYIO.md
      Kept: backend/railway.json (Railway fallback if needed later)
      Decision: stay on Render Singapore — keep-alive eliminates cold start problem
- [x] todo + tasks.md cleaned up — all Fly.io references removed

### Still pending
- [ ] Add FAST2SMS_API_KEY to Render env vars → OTP SMS will work immediately
- [ ] Smoke test all 5 roles on https://gyan-grit.vercel.app
- [ ] E2E: gradebook marks (18/25 → 72%)
- [ ] E2E: notification send (teacher → student receives)

---

## UPCOMING — Next Session

### 🔴 P0 — Immediate
- [ ] Add FAST2SMS_API_KEY to Render dashboard env vars
- [ ] Smoke test all 5 roles end-to-end on production

### 🟡 P1 — E2E Verify
- [ ] Gradebook: 18/25 → 72% shown in expandable row
- [ ] Notification send E2E
- [ ] OTP SMS received on mobile after FAST2SMS_API_KEY set

### 🟠 P2 — Competition Rooms + Chat Rooms (Ably)
- [ ] Sign up ably.com → API key → ABLY_API_KEY in Render env
- [ ] pip install ably → requirements/base.txt
- [ ] New Django app: backend/apps/competitions/ (Pub/Sub)
- [ ] New Django app: backend/apps/chatrooms/ (Ably Chat)
- [ ] POST /api/v1/realtime/token/ → Ably JWT endpoint
- [ ] npm install ably && npm install @ably/chat
- [ ] CompetitionRoomPage.tsx + ChatRoomPage.tsx

### 🔵 P3 — Post-Capstone
- [ ] NavMenu → sidebar drawer for staff roles
- [ ] PWA / offline sync
- [ ] AI chatbot

---

## Architecture Decisions Log

| Decision | Rationale | Date |
|---|---|---|
| Ably for real-time (Pub/Sub + Chat) | No persistent WebSocket on Render/Railway free tier. Ably handles reconnect, presence, history. Same API key for both products. | 2026-03-22 |
| Vercel for frontend | Best-in-class Vite/React SPA deploy. Free tier. Mumbai edge. Auto-deploy on push. | 2026-03-22 |
| Render for backend | Free tier + keep-alive ping = no cold starts. Singapore is the only APAC option across all affordable platforms. | 2026-03-23 |
| Fly.io abandoned | Blocked new Indian accounts with ₹900 verification fee. Not worth it. | 2026-03-23 |
| Keep-alive in AuthContext | Frontend pings /health/ every 10 min in prod. Eliminates Render free tier cold start without needing paid plan. | 2026-03-23 |
| Fast2SMS for OTP SMS | ₹0.15/SMS, Indian numbers, free ₹50 trial. Fully implemented. Just needs API key in env. | 2026-03-23 |
| No AI / PWA for now | Out of scope for capstone. Post-submission. | 2026-03-22 |
