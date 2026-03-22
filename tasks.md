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

### Bug Fixes
- [x] teacher_course_analytics — TEACHER was getting ALL 60 courses via scope_queryset()
      Root cause: scope_queryset follows institution path, not subject assignment path.
      Fix: TEACHER now filters by subject_id__in from teaching_assignments (same as assessments)
- [x] AdminAssessmentBuilderPage — back button hardcoded to /admin/content/...
      Fix: useLocation prefix detection → correct path for TEACHER/PRINCIPAL/ADMIN
- [x] NavMenu — dead-end "Notes" group items cleaned up, footer explanation added
- [x] PrincipalDashboardPage — class card navigated to /teacher/classes/:id (wrong namespace)
      Fix: now uses /principal/classes/:id
- [x] TeacherClassDetailPage — back nav + gradebook link hardcoded to /teacher prefix
      Fix: useLocation detects /principal and /official prefixes
- [x] TeacherStudentDetailPage — back nav hardcoded to /teacher prefix
      Fix: useLocation prefix detection
- [x] router.tsx — /profile was STUDENT-only; moved to shared routes (all roles)
- [x] router.tsx — added missing PRINCIPAL class detail routes:
      /principal/classes/:classId
      /principal/classes/:classId/students/:studentId

### New Files Created
- [x] tasks.md (this file)
- [x] docs/BACKEND_DEPLOYMENT_RENDER.md
- [x] docs/FRONTEND_DEPLOYMENT_VERCEL.md
- [x] backend/.env.example
- [x] backend/build.sh (Render build script)
- [x] frontend/vercel.json

---

## UPCOMING — Next Session

### 🔴 P0 — Verify & Test
- [ ] Reload teacher dashboard — confirm course list now shows only assigned subjects
- [ ] Open /teacher/courses/:id/assessments — confirm back button goes to /teacher/courses/:id/lessons
- [ ] Open /principal/classes/:id — confirm Gradebook button works
- [ ] E2E: gradebook — add mark → percentage computed → shows in expandable row
- [ ] E2E: notification send — teacher sends to class → student sees in inbox

### 🟡 P1 — Pending Bug Check
- [ ] SectionLessonPage — if this page exists, check for hardcoded /teacher prefix
- [ ] RosterPage section dropdown — check for same s.name bug fixed in UserManagementPage

### 🟠 P2 — Planned Features
- [ ] Competition rooms — 3rd party integration (Ably recommended)
      See SYSTEM_ARCHITECTURE.md for architecture decision
      New app: backend/apps/competitions/
      Frontend: CompetitionRoomPage.tsx
- [ ] Chat rooms — 3rd party integration (Ably recommended)
      New app: backend/apps/chatrooms/
      Frontend: ChatRoomPage.tsx
- [ ] Ably integration setup:
      - Sign up at ably.com → get API key
      - Install: pip install ably (backend token vending endpoint)
      - Install: npm install ably (frontend channel subscribe)
      - Backend: POST /api/v1/realtime/token/ → returns Ably JWT for the user
      - Frontend: useAbly() hook wrapping Ably.Realtime client

### 🔵 P3 — Post-Capstone
- [ ] NavMenu → replace with sidebar drawer for staff roles
- [ ] Deploy backend to Render (see docs/BACKEND_DEPLOYMENT_RENDER.md)
- [ ] Deploy frontend to Vercel (see docs/FRONTEND_DEPLOYMENT_VERCEL.md)
- [ ] PWA / offline sync (separate app, post-capstone)
- [ ] AI chatbot (post-capstone)

---

## Architecture Decisions Log

| Decision | Rationale | Date |
|---|---|---|
| Ably for real-time (not raw WebSockets) | Render hobby plan has no persistent WebSocket support. Ably handles reconnection, presence, history. Free tier sufficient for capstone. | 2026-03-22 |
| Vercel for frontend | Best-in-class for Vite/React SPAs. Free tier generous. Auto-deploy from GitHub push. Custom domain support. | 2026-03-22 |
| Render for backend | Free tier supports Django + Gunicorn. PostgreSQL add-on available. ENV vars native. Easy deploy from GitHub. | 2026-03-22 |
| No AI / PWA for now | Out of scope for capstone. Park post-submission. | 2026-03-22 |
