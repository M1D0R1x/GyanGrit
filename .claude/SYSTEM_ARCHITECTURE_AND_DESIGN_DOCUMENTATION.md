# GyanGrit — System Architecture & Design Documentation

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
Django Backend (9 modular apps)
        ↓
PostgreSQL (Supabase — all environments)
```

The frontend and backend are deployed independently. The frontend is a SPA that communicates exclusively through the versioned REST API. Django templates are used only for the admin panel.

---

## 3. Backend Architecture

### 3.1 App Structure

The backend is divided into 9 independent Django apps under `backend/apps/`:

| App | Responsibility |
|---|---|
| `accounts` | Users, authentication, OTP, join codes, device sessions |
| `academics` | Districts, institutions, classrooms, sections, subjects, teaching assignments |
| `accesscontrol` | Role-based permission decorators and queryset scoping |
| `content` | Courses, lessons, section lessons, lesson progress, teacher analytics |
| `learning` | Enrollments, learning paths, student dashboard |
| `assessments` | Assessments, questions, options, attempts, scoring, assessment builder |
| `roster` | Bulk student pre-registration via Excel upload |
| `gamification` | Points, badges, streaks, leaderboard |
| `notifications` | In-app notification delivery and read-status tracking |
| `media` | Cloudflare R2 media management (presigned upload/delete URLs) |

Each app owns its domain completely. Cross-app access goes through model relationships and signals — never through direct view imports.

---

### 3.2 Accounts App

**Models:**
- `User` — extends `AbstractUser` with `role`, `institution`, `section`, `district`, `public_id`
- `JoinCode` — pre-generated codes that lock role and institution on registration
- `OTPVerification` — 6-digit codes for non-student login verification
- `DeviceSession` — stores session key to enforce single-device policy
- `StudentRegistrationRecord` — pre-loaded student records for self-registration
- `AuditLog` — tracks sensitive operations

**Role hierarchy:**
```
ADMIN (5) > OFFICIAL (4) > PRINCIPAL (3) > TEACHER (2) > STUDENT (1)
```

**Login flows:**
- STUDENT / ADMIN: direct session login, no OTP
- TEACHER / PRINCIPAL / OFFICIAL: OTP verification required after credentials

**Single-device enforcement:**
`SingleActiveSessionMiddleware` runs on every authenticated request. It compares the current session key against the stored `DeviceSession`. If they differ, the old session is terminated.

---

### 3.3 Academics App

**Models:**
- `District` → `Institution` → `ClassRoom` → `Section` (hierarchy)
- `Subject` (global — not institution-scoped)
- `ClassSubject` — which subjects are taught in which classroom
- `StudentSubject` — which subjects a student is enrolled in
- `TeachingAssignment` — teacher × subject × section

**Seeding:**
All 23 Punjab districts, ~46 government schools, and 12 subjects are seeded automatically via a `post_migrate` signal in `AcademicsConfig.ready()`.

The `seed_punjab` management command creates classrooms and sections on top of the seeded base data.

---

### 3.4 AccessControl App

Two components:

**`permissions.py`** — view-level decorators:
- `@require_auth` — blocks unauthenticated requests (401)
- `@require_roles(["TEACHER", "ADMIN"])` — blocks insufficient roles (403)

**`scoped_service.py`** — queryset-level data scoping:
- `scope_queryset(user, queryset)` — filters queryset to user's visible scope
- `get_scoped_object_or_403(user, queryset, **lookup)` — scoped single object fetch

Scoping rules:
- ADMIN / superuser → unrestricted
- OFFICIAL → district scope (via `DISTRICT_SCOPE_MAP`)
- PRINCIPAL / TEACHER / STUDENT → institution scope (via `INSTITUTION_SCOPE_MAP`)

The scope maps use explicit ORM traversal strings (e.g., `"classroom__institution"`) rather than field introspection, to avoid silent data leakage on models with nested FK chains.

---

### 3.5 Content App

**Models:**
- `Course` — belongs to a Subject and grade
- `Lesson` — ordered within a course, supports text + video + HLS + PDF
- `LessonProgress` — tracks completion and last position per user per lesson
- `SectionLesson` — teacher-added supplementary lessons, linked to a course and section

**Design decisions:**
- Course-level progress is **derived**, not stored. Computed from `LessonProgress` counts at request time.
- `lesson_detail` returns `completed` and `last_position` inline — no separate progress GET endpoint needed by frontend.
- `mark_opened()` is called on lesson open to enable resume logic.
- `SectionLesson` allows TEACHER and PRINCIPAL to add content within their scope without touching the curriculum. Displayed merged with curriculum lessons in the lesson list.

---

### 3.6 Assessments App

**Models:**
- `Assessment` — belongs to a Course; has `total_marks` (auto-computed from questions)
- `Question` — ordered within an assessment, has mark weight
- `QuestionOption` — one correct option per question (enforced by `clean()`)
- `AssessmentAttempt` — tracks selected options, score, and pass/fail

**Scoring:**
`calculate_score_and_pass()` fetches all selected options in a single query and sums marks for correct ones. This is a set-based query — no N+1.

`total_marks` is kept up-to-date via `post_save` and `post_delete` signals on `Question`.

**Security:** `is_correct` is never sent to the frontend in any student-facing API response. The builder endpoint (`/admin/`) returns it exclusively for TEACHER, PRINCIPAL, and ADMIN.

**Role access:** TEACHER and PRINCIPAL can create and manage assessments for courses within their subject scope.

---

### 3.7 Learning App

**Models:**
- `Enrollment` — user × course, with status (`enrolled`, `completed`, `dropped`)
- `LearningPath` — named collection of courses
- `LearningPathCourse` — ordered course within a path

**Auto-enrollment:** Handled by signals. See Section 4.

---

### 3.8 Roster App

Service-based architecture. No models — uses `StudentRegistrationRecord` from accounts.

- `process_roster_upload()` — parses Excel, validates rows, creates registration records
- `list_registration_records()` — scoped record listing
- `regenerate_student_code()` — generates new code for unregistered student

Returns per-row skip reasons so teachers can diagnose upload failures.

---

### 3.9 Gamification App

**Models:**
- `PointEvent` — immutable append-only ledger of every point award. Never updated — only inserted.
- `StudentPoints` — denormalized running total per student. Updated atomically by signals using `select_for_update`.
- `StudentBadge` — earned badge per student. Unique per `(user, badge_code)`.
- `StudentStreak` — daily activity streak tracking (`current_streak`, `longest_streak`, `last_activity_date`).

**Design decisions:**
- `PointEvent` is a ledger, not a counter. This gives a full audit trail and prevents double-awarding. Before awarding, signals check if a `PointEvent` already exists for the same `(user, reason, lesson_id/assessment_id)` combination.
- `StudentPoints.total_points` is a denormalized cache. Updated atomically with `select_for_update` to prevent race conditions on the same row.
- All signal handlers are wrapped in `try/except` — a gamification failure **never blocks lesson completion or assessment submission**.
- Streak uses `date` (not `datetime`) to prevent timezone-related double-counting within a single day.

**Points awarded:**
| Reason | Points |
|---|---|
| `lesson_complete` | 10 |
| `assessment_attempt` | 5 |
| `assessment_pass` | 25 |
| `perfect_score` | 50 |
| `streak_3` | 15 |
| `streak_7` | 50 |

**Badges:** `first_lesson`, `lesson_10`, `lesson_50`, `first_pass`, `perfect_score`, `streak_3`, `streak_7`, `points_100`, `points_500`.

---

### 3.10 Notifications App

**Models:**
- `Notification` — `recipient` (FK → User), `message`, `notification_type`, `is_read`, `created_at`.

Notifications are created by teachers (for their class), principals (for their school), and automatically by system events. Delivered via polling — no WebSocket required at this scale.

---

### 3.11 Media App

Handles Cloudflare R2 presigned upload and delete URLs. No database models — purely a pass-through service between the frontend and R2.

- `r2.py` — generates presigned PUT and DELETE URLs using `boto3` with an R2-compatible endpoint.

---

## 4. Signal Architecture

Signals handle automatic assignment, enrollment, and gamification. Each app owns its domain:

```
User.post_save (new STUDENT)
    → academics/signals.py: auto_assign_subjects()
        creates StudentSubject for each ClassSubject in classroom
            → learning/signals.py: auto_enroll_core_courses()
                creates Enrollment for each is_core=True Course

ClassSubject.post_save (new subject added to classroom)
    → academics/signals.py: auto_assign_students_for_new_class_subject()
        creates StudentSubject for existing students
            → learning/signals.py: auto_enroll_core_courses()
                creates Enrollment for each is_core=True Course

Question.post_save / Question.post_delete
    → assessments/signals.py: update_total_marks_on_save/delete()
        calls assessment.recalculate_total_marks()

LessonProgress.post_save (completed = True, first time)
    → gamification/signals.py: on_lesson_progress_save()
        awards +10 pts, updates streak, checks streak bonuses, checks badges

AssessmentAttempt.post_save (submitted_at just set)
    → gamification/signals.py: on_assessment_attempt_save()
        awards +5 attempt, +25 pass (if passed), +50 perfect (if 100%)
        updates streak, checks streak bonuses, checks badges
```

See `docs/SIGNAL_CHAIN.md` for the complete diagram including guards and deduplication logic.

---

## 5. Frontend Architecture

### 5.1 Technology Stack

- React 18 with TypeScript
- Vite for build and dev server
- React Router v6 for client-side routing
- CSS custom properties (design system in `src/index.css`)
- No UI component library — all components are custom

### 5.2 Design System

All visual tokens are defined as CSS custom properties in `src/index.css` (~1600 lines):

- **Colors:** `--bg-base`, `--bg-surface`, `--bg-elevated`, `--text-primary`, `--brand-primary`, etc.
- **Role colors:** `--role-student` (blue), `--role-teacher` (emerald), `--role-principal` (amber), `--role-official` (violet), `--role-admin` (rose)
- **Typography:** `Sora` (display/headings) + `DM Sans` (body)
- **Spacing scale:** `--space-1` through `--space-16`
- **Animations:** `shimmer` (skeleton loading), `fadeInUp` (page entry), `spin` (loaders)

The design system is extended, never replaced. No Tailwind, no styled-components, no CSS modules.

### 5.3 Authentication Flow

```
App mount
    → initCsrf() — seeds gyangrit_csrftoken cookie
    → apiGet("/accounts/me/") — checks session
    → AuthContext stores UserProfile (id, username, role, institution, section, district, ...)

Route access
    → RequireRole checks auth.loading, auth.authenticated, roleRank
    → Redirects to /login or shows 403 screen
    → RoleBasedRedirect routes authenticated users to role-appropriate dashboard
```

`AuthContext` stores the full `UserProfile` object. Pages read `auth.user.institution`, `auth.user.district` etc directly — no extra API calls needed per page.

### 5.4 Component Architecture

```
src/
├── auth/
│   ├── AuthContext.tsx       — UserProfile state, refresh()
│   ├── authTypes.ts          — Role, UserProfile, AuthState, ROLE_PATHS
│   ├── RequireRole.tsx       — Auth + role guard with loading/403 screens
│   └── RoleBasedRedirect.tsx — Post-login role routing
├── components/
│   ├── BottomNav.tsx         — Mobile bottom navigation (student-only, 5 tabs)
│   ├── LessonItem.tsx        — Accessible lesson row with completion state
│   ├── Logo.tsx              — GyanGrit wordmark
│   ├── LogoutButton.tsx      — Calls logout endpoint then navigates
│   ├── NotificationPanel.tsx — Slide-in notification panel
│   └── TopBar.tsx            — Sticky nav with user avatar, role badge, logout
├── pages/                    — One file per route (30 pages)
├── services/                 — One file per API domain (11 files)
└── app/
    └── router.tsx            — All routes with Protected() wrapper + lazy loading
```

### 5.5 Route Protection

All non-public routes use the `Protected` wrapper:

```tsx
function Protected({ role, children }) {
  return (
    <RequireRole role={role}>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </RequireRole>
  );
}
```

This combines auth enforcement + lazy loading + consistent loading UI in one place.

### 5.6 API Layer

All API calls go through `src/services/api.ts`:
- `apiGet<T>(path)` — GET with session cookie
- `apiPost<T>(path, body)` — POST with CSRF token
- `apiPatch<T>(path, body)` — PATCH with CSRF token
- `apiDelete<T>(path)` — DELETE with CSRF token
- `initCsrf()` — seeds CSRF cookie on mount

CSRF token is read from `gyangrit_csrftoken` cookie (renamed from Django's default to avoid collision with the admin panel cookie).

### 5.7 Bottom Navigation (Student-only)

Students have a 5-tab bottom navigation bar on mobile:

| Tab | Route | Icon |
|---|---|---|
| Home | `/dashboard` | House |
| Courses | `/courses` (also active for `/lessons`, `/learning`) | Book |
| Tests | `/assessments` (also active for `/assessment-result`) | Checkmark |
| Ranks | `/leaderboard` | Bar chart |
| Profile | `/profile` | Person |

Hidden on screens wider than 640px (`@media (min-width: 641px)`). Pages using BottomNav add `has-bottom-nav` to `<main>` to add bottom padding.

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
| Authentication | Django session cookies (HttpOnly) |
| CSRF | Custom cookie name `gyangrit_csrftoken`, verified on all POST/PATCH/DELETE |
| Single device | `SingleActiveSessionMiddleware` + `DeviceSession` model |
| Role enforcement | `@require_roles()` decorator on all protected views |
| Data scoping | `scope_queryset()` on all list endpoints |
| OTP brute force | 5-attempt limit, 10-minute expiry |
| Correct answers | `is_correct` never sent in any student-facing API response |
| Session age | `SESSION_COOKIE_AGE = 3600` (1 hour), extended on every request |
| Gamification | Point deduplication via `PointEvent` ledger — double-awarding is impossible |

---

## 8. Settings Structure

```
backend/gyangrit/settings/
├── base.py    — shared config, database URL parsing, middleware stack
├── dev.py     — DEBUG=True, localhost CORS, renamed cookies, 1hr session
└── prod.py    — HTTPS flags, locked CORS, Supabase PostgreSQL, WhiteNoise
```

Cookie names are renamed to prevent collision between the Django admin session and the GyanGrit frontend session:
```python
SESSION_COOKIE_NAME = "gyangrit_sessionid"
CSRF_COOKIE_NAME    = "gyangrit_csrftoken"
```

---

## 9. Database

**All environments:** PostgreSQL via Supabase.

`DATABASE_URL` is always read from environment variables — never hardcoded.

Production-specific requirements:
- `DISABLE_SERVER_SIDE_CURSORS = True` — required for pgBouncer transaction-mode pooling (Supabase pooler)
- `sslmode=require` on all connections
- Standard `psycopg2` + Django ORM only — no Supabase-specific client libraries

---

## 10. Deployment Notes

See `docs/DEPLOYMENT.md` for full setup instructions.

Quick summary:
- Backend: `DJANGO_SETTINGS_MODULE=gyangrit.settings.prod`, served via `gunicorn`
- Frontend: `npm run build` → serve `dist/` via CDN or static host (Vercel/Netlify/Cloudflare Pages)
- Database: Supabase PostgreSQL (managed)
- Static files: WhiteNoise middleware (`collectstatic` required before deploy)
- Environment: `SECRET_KEY`, `DATABASE_URL` in environment variables — never in code

---

## 11. Design Principles

- **Separation of concerns** — each app owns its domain completely
- **Single source of truth** — progress is derived, not duplicated; gamification points are ledger-based
- **Explicit scoping** — data visibility is enforced at the queryset level, not assumed
- **Defensive validation** — `clean()` methods on all models with business rules
- **Signal-driven automation** — enrollment, assignment, and gamification happen via signals, not in views
- **No silent failures** — every error is logged with context; bare `except` clauses are prohibited
- **Production-safe code** — no `print()`, no hardcoded secrets, no partial patches
- **Non-blocking gamification** — all gamification signals are wrapped in `try/except` to never block core learning flows
