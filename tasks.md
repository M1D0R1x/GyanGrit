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

## SESSION 2026-03-23 — Fly.io Migration, OTP, Latency, Deployment Fixes

- [x] Vercel TS error fixed: AdminLessonEditorPage uploadFile arg order
      (setProgress was passed as displayName string slot → now undefined, setProgress)
- [x] health endpoint: removed @login_required (was redirecting to /accounts/login/)
- [x] prod.py: defensive _parse_hosts() and _parse_origins() — strips https:// and trailing slashes
      (prevents CORS errors when user accidentally types full URL in env var)
- [x] whitenoise added to requirements/base.txt (was prod-only, broke local dev server)
- [x] Decided to switch backend from Render (Singapore) → Fly.io (Mumbai)
      Reason: Render has no Mumbai region. Fly.io has bom (Mumbai) operational.
      DB is in Mumbai (Supabase). Backend + DB in same city = <5ms DB latency vs 30-40ms.
- [x] backend/Dockerfile created — Fly.io uses this for container builds
- [x] backend/fly.toml created — bom region, always-on, health check on /api/v1/health/
- [x] docs/BACKEND_DEPLOYMENT_FLYIO.md — complete Fly.io deploy guide
- [x] Fast2SMS OTP confirmed already implemented in services.py
      Just needs FAST2SMS_API_KEY set in Fly.io secrets — no code changes needed
- [x] todo + tasks.md updated

### Pending from this session (not yet done)
- [ ] Actually run: fly deploy (follow docs/BACKEND_DEPLOYMENT_FLYIO.md)
- [ ] Set FAST2SMS_API_KEY in Fly.io secrets
- [ ] Update Vercel VITE_API_URL to fly.dev URL
- [ ] Delete Render service after Fly.io confirmed working

---

## UPCOMING — Next Session

### 🔴 P0 — Deploy & Verify
- [ ] fly deploy → confirm https://gyangrit-backend.fly.dev/api/v1/health/ works
- [ ] Update VITE_API_URL in Vercel → redeploy frontend
- [ ] Test full login flow on production (student + teacher OTP)
- [ ] Test OTP SMS arrives via Fast2SMS (teacher login)
- [ ] Smoke test all 5 roles on production URLs

### 🟡 P1 — E2E Verify (local)
- [ ] Gradebook: add mark 18/25 → 72% shown
- [ ] Notification send: teacher → student receives
- [ ] Teacher dashboard: only assigned subjects shown

### 🟠 P2 — Features
- [ ] Ably Pub/Sub setup for competition rooms
- [ ] Ably Chat setup for chat rooms

### 🔵 P3 — Post-Capstone
- [ ] NavMenu → sidebar drawer
- [ ] PWA / offline sync
- [ ] AI chatbot

---

## Architecture Decisions Log

| Decision | Rationale | Date |
|---|---|---|
| Ably for real-time (not raw WebSockets) | Render/Fly free tier has no persistent WebSocket support. Ably handles reconnection, presence, history. Free tier sufficient for capstone. | 2026-03-22 |
| Ably product split: Pub/Sub for competitions, Chat for chat rooms | Competition rooms need custom message shape (scores, timers). Chat rooms benefit from built-in typing indicators, history, presence. Same API key. | 2026-03-22 |
| Vercel for frontend | Best-in-class for Vite/React SPAs. Free tier generous. Auto-deploy on push. Mumbai edge node. | 2026-03-22 |
| Fly.io for backend (replacing Render) | Fly.io has Mumbai (bom) region. Render has no Mumbai. DB is in Mumbai. Co-locating backend + DB eliminates 30-40ms Singapore→Mumbai roundtrip per query. Login goes from ~3s → <500ms. | 2026-03-23 |
| Fast2SMS for OTP SMS | Indian SMS gateway, ₹0.15/SMS, 10-digit mobile normalisation built in. Free trial ₹50 (~330 OTPs). Already fully implemented in services.py. | 2026-03-23 |
| No AI / PWA for now | Out of scope for capstone. Post-submission. | 2026-03-22 |
