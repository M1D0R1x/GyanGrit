# GyanGrit — System Architecture & Design Documentation

> **Updated: 2026-03-18** — 11 backend apps, 31 frontend pages, all operational.

---

## 1. Introduction

GyanGrit is a role-based digital learning platform for rural government schools in Punjab, India. It delivers structured educational content, tracks learner progress, provides analytics for teachers, principals, and district officials, and motivates students through a gamification layer.

The system is built as a modular web application:
- **Backend:** Django 4.2 with PostgreSQL (Supabase) in all environments
- **Frontend:** React 18 + Vite + TypeScript
- **Authentication:** Django session-based with single-device enforcement
- **API:** REST under `/api/v1/`

---

## 2. High-Level Architecture

```
Browser (React + Vite)
        ↓  HTTPS + Session Cookie + CSRF Token
REST API (/api/v1/)
        ↓
Django Backend (11 modular apps)
        ↓
PostgreSQL (Supabase — all environments)
        ↓
Cloudflare R2 (media storage — video, PDF, attachments)
```

The frontend and backend are deployed independently. The frontend is a SPA that communicates exclusively through the versioned REST API. Django templates are used only for the admin panel.

---

## 3. Backend Architecture

### 3.1 App Structure

The backend is divided into **11 independent Django apps** under `backend/apps/`:

| App | Responsibility |
|---|---|
| `accounts` | Users, authentication, OTP, join codes, device sessions, profile |
| `academics` | Districts, institutions, classrooms, sections, subjects, teaching assignments |
| `accesscontrol` | Role-based permission decorators and queryset scoping (no models, no endpoints) |
| `content` | Courses, lessons, section lessons, lesson progress, teacher analytics |
| `learning` | Enrollments, learning paths, student dashboard |
| `assessments` | Assessments, questions, options, attempts, scoring, assessment builder |
| `roster` | Bulk student pre-registration via Excel upload |
| `gamification` | Points ledger, badges, streaks, class/school leaderboard |
| `notifications` | Broadcasts, per-recipient notifications, read-status, audience targeting |
| `media` | Cloudflare R2 media management (presigned upload/delete URLs, filename sanitization) |
| `gradebook` | Manual marks (oral, practical, project, paper-based) per student/subject/term |

Each app owns its domain completely. Cross-app access goes through model relationships and signals — never through direct view imports.

---

### 3.2 Accounts App

**Models:**
- `User` — extends `AbstractUser` with `role`, `institution`, `section`, `district`, `public_id`
- Contact fields: `email` (required), `mobile_primary` (required), `mobile_secondary` (optional)
- `profile_complete` — set to True once all required contact fields are present
- `JoinCode` — pre-generated codes that lock role, institution, section, and subject on registration
- `OTPVerification` — 6-digit codes for non-student login verification
- `DeviceSession` — stores session key to enforce single-device policy
- `StudentRegistrationRecord` — pre-loaded student records for roster-based self-registration
- `AuditLog` — tracks sensitive operations (code regeneration, etc.)

**Role hierarchy:**
```
ADMIN (5) > OFFICIAL (4) > PRINCIPAL (3) > TEACHER (2) > STUDENT (1)
```

**Login flows:**
- STUDENT / ADMIN: direct session login, no OTP
- TEACHER / PRINCIPAL / OFFICIAL: OTP verification required after credentials check

**Single-device enforcement:**
`SingleActiveSessionMiddleware` runs on every authenticated request. It compares the current session key against the stored `DeviceSession`. If they differ, the existing session is terminated — the user is logged out on their old device silently.

---

### 3.3 Academics App

**Models:** `District`, `Institution`, `ClassRoom`, `Section`, `Subject`, `ClassSubject`, `StudentSubject`, `TeachingAssignment`

**Key design:**
- All 23 Punjab districts are seeded at first migration
- `ClassRoom.name` stores grade as a string (`"8"`) — numeric coercion done at query time via `Cast` to allow future non-numeric grades
- `Section.short_label` (`"Class 8-A"`) is a serializer-computed field — always use this in dropdowns, not `name` (which is just `"A"`)
- `StudentSubject` API response includes `course_id` for the dashboard resume-lesson flow

---

### 3.4 Content App

**Models:** `Course`, `Lesson`, `SectionLesson`, `LessonProgress`

**Key design:**
- `Lesson` supports: video (YouTube/Vimeo/R2 direct), HLS manifest, PDF attachment, Markdown content
- `SectionLesson` — teacher-added supplementary content, separate from admin curriculum
- `LessonProgress.last_opened_at` drives the resume logic. `resume_lesson_id` returned by `/courses/:id/progress/`
- Teacher analytics endpoints: `/teacher/analytics/courses/`, `/teacher/analytics/classes/`, `/teacher/analytics/assessments/`, `/teacher/analytics/classes/:id/students/`

---

### 3.5 Assessments App

**Models:** `Assessment`, `Question`, `QuestionOption`, `AssessmentAttempt`

**Security invariant:** `is_correct` is NEVER returned in student-facing responses. This is enforced at the serializer level — not a convention, a hard rule.

**Scoring:** `AssessmentAttempt.calculate_score_and_pass()` scores in a single query — fetches all selected options for submitted `question_id` keys, filters `is_correct=True`, sums `question.marks`.

**`total_marks`** is auto-computed by a signal whenever a `Question` is created/updated/deleted — never editable.

---

### 3.6 Gamification App

**Models:** `PointEvent`, `StudentPoints`, `StudentBadge`, `StudentStreak`

**Design:** All gamification is signal-driven. No gamification logic lives in views. Signals are wrapped in `try/except` — a gamification failure never blocks a core learning action.

**Deduplication:** Before awarding, a `PointEvent` ledger check prevents double-awarding for the same `(user, reason, lesson_id/assessment_id)`.

**Leaderboard:** Denormalized via `StudentPoints` — never sums the full `PointEvent` table per request.

---

### 3.7 Notifications App

**Models:** `Broadcast`, `Notification`

**Design:**
- `Broadcast` = one outgoing message from a sender
- `Notification` = per-recipient inbox item (created automatically when a broadcast is sent, or by signals on lesson/assessment publish)
- Audience types: `class`, `institution`, `district`, `all` — scoped to the sender's permissions
- Attachments stored on Cloudflare R2

**Signal automation:**
- Lesson published → notifies all enrolled students
- Assessment published → notifies all enrolled students

---

### 3.8 Gradebook App

**Models:** `GradeEntry`

**Purpose:** Manual mark entry for assessments that the digital quiz engine doesn't cover — oral exams, practicals, projects, paper-based mid-terms.

**Design:**
- Unique per `(student, subject, term, category)` — update via PATCH, not re-insert
- `percentage` always computed server-side on save — client value ignored
- Scoped: TEACHER sees only their students; PRINCIPAL sees their institution

---

## 4. Frontend Architecture

### 4.1 Stack

- **React 18** + Vite + TypeScript (strict mode)
- **Routing:** React Router v6 with lazy-loaded pages
- **Auth state:** `AuthContext` — wraps `useAuth()` hook, calls `/api/v1/accounts/me/` on mount
- **API calls:** All through `src/services/api.ts` — `apiGet`, `apiPost`, `apiPatch`, `apiDelete`
- **Styling:** Custom CSS design system in `src/index.css` (CSS custom properties only — no Tailwind, no CSS Modules, no external UI libraries)

### 4.2 Design System

All visual tokens are CSS custom properties defined in `src/index.css` (~1600 lines):

```css
--role-student:   #3b82f6;
--role-teacher:   #10b981;
--role-principal: #f59e0b;
--role-official:  #8b5cf6;
--role-admin:     #ef4444;

--font-display:   "Sora", sans-serif;
--font-body:      "DM Sans", sans-serif;
```

**Rule:** Extend `src/index.css`, never replace it. All new components use the existing variable names.

### 4.3 Page Count

**31 pages** across all roles:

| Category | Pages |
|---|---|
| Auth | LoginPage, RegisterPage, VerifyOtpPage, CompleteProfilePage |
| Student | DashboardPage, CoursesPage, LessonsPage, LessonPage, AssessmentsPage, AssessmentPage, AssessmentTakePage, AssessmentResultPage, AssessmentHistoryPage, CourseAssessmentsPage, LearningPathsPage, LearningPathPage, ProfilePage, LeaderboardPage |
| Teacher | TeacherDashboardPage, TeacherClassDetailPage, TeacherStudentDetailPage, GradebookPage |
| Staff shared | AdminLessonEditorPage, AdminAssessmentBuilderPage, UserManagementPage, AdminJoinCodesPage |
| Dashboards | PrincipalDashboardPage, OfficialDashboardPage, AdminDashboardPage, AdminContentPage |
| Shared | NotificationsPage |
| Errors | NotFoundPage, ForbiddenPage, ServerErrorPage, NetworkErrorPage |

### 4.4 Route Protection

`<RequireRole role="X">` wraps every non-public page. Role rank is checked — insufficient rank shows `ForbiddenPage`. Not authenticated → redirect to `/login`.

### 4.5 Human-Readable URLs

Courses and assessments use slug-based URLs:
- `/courses/8/mathematics` (not `/courses/5`)
- `/assessments/8/mathematics/3`

Numeric IDs are resolved server-side via `/courses/by-slug/?grade=8&subject=mathematics`.

### 4.6 LessonPage Media Handling

The `LessonPage` component handles all media types without external libraries:

| Media type | Detection | Rendering |
|---|---|---|
| YouTube | URL contains `youtube.com` / `youtu.be` | Lazy iframe embed, click-to-play |
| Vimeo | URL contains `vimeo.com` | Lazy iframe embed |
| Direct video / R2 | `.mp4`/`.webm` or `r2.dev` domain | Native `<video>` with Download button |
| HLS | `hls_manifest_url` field | Same `<video>` element |
| PDF | `pdf_url` field | Collapsible inline iframe + Open/Download |
| Markdown | `content` field | Custom lightweight renderer (no external lib) |

### 4.7 TopBar NavMenu (Temporary)

> ⚠️ **To be redesigned post-capstone**

A `NavMenu` component is mounted in `TopBar`, showing all accessible routes for the current role in a dropdown. This was added for supervisor demo navigation. See `src/components/NavMenu.tsx`.

**TODOs before production:**
- Replace with sidebar drawer for staff roles
- Remove from student view (already has `BottomNav`)
- Remove "⚠️ Demo nav" warning once replaced

---

## 5. Signal Architecture

See `docs/SIGNAL_CHAIN.md` for the full signal graph. Summary:

| Signal | Trigger | Effect |
|---|---|---|
| `post_save` on `ClassSubject` | New subject added to classroom | Retroactively assign to all existing students |
| `post_save` on `StudentSubject` | New student-subject assignment | Auto-enroll in all `is_core=True` courses for that subject+grade |
| `post_save` on `LessonProgress` | `completed` set to True | Award points, check badges, update streak |
| `post_save` on `AssessmentAttempt` | `submitted_at` set | Award points, check badges |
| `post_save` on `Lesson` | `is_published` set to True | Create `Notification` for all enrolled students |
| `post_save` on `Assessment` | `is_published` set to True | Create `Notification` for all enrolled students |

---

## 6. Data Scoping Architecture

Data visibility is enforced at two layers:

**Layer 1 — View decorators** (`accesscontrol/permissions.py`)
Answers: "Can this user access this endpoint?"

**Layer 2 — Queryset scoping** (`accesscontrol/scoped_service.py`)
Answers: "What data can this user see?"

The scope maps define ORM traversal paths for every model:

```python
INSTITUTION_SCOPE_MAP = {
    "Course": "subject__classrooms__classroom__institution",
    "Lesson": "course__subject__classrooms__classroom__institution",
    "Section": "classroom__institution",
    # ...
}
```

Any model not in the map is treated as globally readable (e.g. `Subject`, `District`).

---

## 7. Security

| Concern | Implementation |
|---|---|
| Authentication | Django session cookies (HttpOnly), named `gyangrit_sessionid` |
| CSRF | Custom cookie `gyangrit_csrftoken`, verified on all POST/PATCH/DELETE |
| Single device | `SingleActiveSessionMiddleware` + `DeviceSession` model |
| Role enforcement | `@require_roles()` decorator on all protected views |
| Data scoping | `scope_queryset()` on all list endpoints |
| OTP brute force | 5-attempt limit, 10-minute expiry |
| Correct answers | `is_correct` NEVER sent in any student-facing API response |
| Session age | `SESSION_COOKIE_AGE = 3600` (1 hour), extended on every request |
| Gamification | Point deduplication via `PointEvent` ledger — double-awarding is impossible |
| Attachment security | `os.path.basename()` + null-byte strip + 100-char cap server-side |
| Gradebook access | Only the creating teacher or principal can update/delete a `GradeEntry` |

---

## 8. Settings Structure

```
backend/gyangrit/settings/
├── base.py    — shared config, database URL parsing, middleware stack
├── dev.py     — DEBUG=True, localhost CORS, renamed cookies, 1hr session
└── prod.py    — HTTPS flags, locked CORS, Supabase PostgreSQL, WhiteNoise
```

Cookie names are renamed to prevent collision with the Django admin session:
```python
SESSION_COOKIE_NAME = "gyangrit_sessionid"
CSRF_COOKIE_NAME    = "gyangrit_csrftoken"
```

---

## 9. Database

**All environments:** PostgreSQL via Supabase.

`DATABASE_URL` is always read from environment variables — never hardcoded.

Production-specific requirements:
- `DISABLE_SERVER_SIDE_CURSORS = True` — required for pgBouncer transaction-mode pooling
- `sslmode=require` on all connections
- Standard `psycopg2` + Django ORM only — no Supabase-specific client libraries

### Migration State (as of 2026-03-18)

| App | Migrations |
|---|---|
| accounts | 0001–0004 |
| academics | 0001 |
| assessments | 0001 |
| content | 0001 |
| gamification | 0001 |
| gradebook | 0001–0002 |
| learning | 0001 |
| media | 0001 |
| notifications | 0001–0002 |
| roster | 0001 |

---

## 10. Deployment Notes

See `docs/DEPLOYMENT.md` for full setup instructions.

Quick summary:
- Backend: `DJANGO_SETTINGS_MODULE=gyangrit.settings.prod`, served via `gunicorn`
- Frontend: `npm run build` → serve `dist/` via CDN or static host (Vercel/Netlify/Cloudflare Pages)
- Database: Supabase PostgreSQL (managed)
- Static files: WhiteNoise middleware (`collectstatic` required before deploy)
- Media: Cloudflare R2 bucket with presigned URLs — no direct browser access to bucket

---

## 11. Design Principles

- **Separation of concerns** — each app owns its domain completely
- **Single source of truth** — progress is derived, not duplicated; gamification points are ledger-based
- **Explicit scoping** — data visibility is enforced at the queryset level, not assumed
- **Defensive validation** — `clean()` methods on all models with business rules
- **Signal-driven automation** — enrollment, assignment, and gamification happen via signals, not in views
- **No silent failures** — every error is logged; bare `except` clauses are prohibited
- **Production-safe code** — no `print()`, no hardcoded secrets
- **Non-blocking gamification** — all gamification signals are wrapped in `try/except`
- **Human-readable URLs** — course and assessment URLs use grade+subject slugs, not numeric IDs
- **Rural-context aware** — low bandwidth (lazy video loading, PDF fallback), low-literacy UX (clear labels, icons), sibling edge cases handled at model level
