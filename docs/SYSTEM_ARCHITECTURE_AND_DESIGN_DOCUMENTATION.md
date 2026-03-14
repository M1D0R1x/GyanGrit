# GyanGrit — System Architecture & Design Documentation

---

## 1. Introduction

GyanGrit is a role-based digital learning platform for rural government schools in Punjab, India. It delivers structured educational content, tracks learner progress, and provides analytics for teachers, principals, and district officials.

The system is built as a modular web application:
- **Backend:** Django with PostgreSQL (production) / SQLite (development)
- **Frontend:** React + Vite + TypeScript
- **Authentication:** Django session-based with single-device enforcement
- **API:** REST under `/api/v1/`

---

## 2. High-Level Architecture

```
Browser (React + Vite)
        ↓  HTTPS + Session Cookie
REST API (/api/v1/)
        ↓
Django Backend (7 modular apps)
        ↓
PostgreSQL (Supabase in production)
```

The frontend and backend are deployed independently. The frontend is a SPA that communicates exclusively through the versioned REST API. Django templates are used only for the admin panel.

---

## 3. Backend Architecture

### 3.1 App Structure

The backend is divided into 7 independent Django apps under `backend/apps/`:

| App | Responsibility |
|---|---|
| `accounts` | Users, authentication, OTP, join codes, device sessions |
| `academics` | Districts, institutions, classrooms, sections, subjects, teaching assignments |
| `accesscontrol` | Role-based permission decorators and queryset scoping |
| `content` | Courses, lessons, lesson progress, teacher analytics |
| `learning` | Enrollments, learning paths, student dashboard |
| `assessments` | Assessments, questions, options, attempts, scoring |
| `roster` | Bulk student pre-registration via Excel upload |

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
`SingleActiveSessionMiddleware` runs on every authenticated request. It compares the current session key against the stored `DeviceSession`. If they differ, the old session is terminated. This implements FR-02 from the SRS.

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
- `get_scoped_object_or_404(user, queryset, **lookup)` — scoped single object fetch

Scoping rules:
- ADMIN / superuser → unrestricted
- OFFICIAL → district scope (via `DISTRICT_SCOPE_MAP`)
- PRINCIPAL / TEACHER / STUDENT → institution scope (via `INSTITUTION_SCOPE_MAP`)

The scope maps use explicit ORM traversal strings (e.g., `"classroom__institution"`) rather than field introspection, to avoid silent data leakage on models with nested FK chains.

---

### 3.5 Content App

**Models:**
- `Course` — belongs to a Subject and grade
- `Lesson` — ordered within a course, supports text + video + HLS
- `LessonProgress` — tracks completion and last position per user per lesson

**Design decisions:**
- Course-level progress is **derived**, not stored. Computed from `LessonProgress` counts at request time.
- `lesson_detail` returns `completed` and `last_position` inline — no separate progress GET endpoint needed by frontend
- `mark_opened()` is called on lesson open to enable resume logic

---

### 3.6 Assessments App

**Models:**
- `Assessment` — belongs to a Course; has `total_marks` (auto-computed from questions)
- `Question` — ordered within an assessment, has mark weight
- `QuestionOption` — one correct option per question (enforced by `clean()`)
- `AssessmentAttempt` — tracks selected options, score, and pass/fail

**Scoring:**
`calculate_score_and_pass()` fetches all selected options in a single query and sums marks for correct ones. The old approach did one query per question (N+1) — now replaced with a set-based query.

`total_marks` is kept up-to-date via `post_save` and `post_delete` signals on `Question`.

**Security:** `is_correct` is never sent to the frontend in any API response.

---

### 3.7 Learning App

**Models:**
- `Enrollment` — user × course, with status (`enrolled`, `completed`, `dropped`)
- `LearningPath` — named collection of courses
- `LearningPathCourse` — ordered course within a path

**Auto-enrollment:** Handled by signals. See Section 5.

---

### 3.8 Roster App

Service-based architecture. No models — uses `StudentRegistrationRecord` from accounts.

- `process_roster_upload()` — parses Excel, validates rows, creates registration records
- `list_registration_records()` — scoped record listing
- `regenerate_student_code()` — generates new code for unregistered student

Returns per-row skip reasons so teachers can diagnose upload failures.

---

## 4. Signal Architecture

Signals handle automatic assignment and enrollment. Each app owns its domain:

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
```

This design means: academics owns subject assignment, learning owns enrollment. No cross-app enrollment logic exists in academics.

See `docs/SIGNAL_CHAIN.md` for the complete diagram.

---

## 5. Frontend Architecture

### 5.1 Technology Stack

- React 18 with TypeScript
- Vite for build and dev server
- React Router v6 for client-side routing
- CSS custom properties (design system in `src/index.css`)
- No UI component library — all components are custom

### 5.2 Design System

All visual tokens are defined as CSS custom properties in `src/index.css`:

- **Colors:** `--bg-base`, `--bg-surface`, `--bg-elevated`, `--text-primary`, `--brand-primary`, etc.
- **Role colors:** `--role-student` (blue), `--role-teacher` (emerald), `--role-principal` (amber), `--role-official` (violet), `--role-admin` (rose)
- **Typography:** `Sora` (display/headings) + `DM Sans` (body)
- **Spacing scale:** `--space-1` through `--space-16`
- **Animations:** `shimmer` (skeleton loading), `fadeInUp` (page entry), `spin` (loaders)

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
│   ├── AuthContext.tsx      — UserProfile state, refresh()
│   ├── authTypes.ts         — Role, UserProfile, AuthState, ROLE_PATHS
│   ├── RequireRole.tsx      — Auth + role guard with loading/403 screens
│   └── RoleBasedRedirect.tsx — Post-login role routing
├── components/
│   ├── LessonItem.tsx       — Accessible lesson row with completion
│   ├── LogoutButton.tsx     — Calls logout endpoint then navigates
│   └── TopBar.tsx           — Sticky nav with user avatar, role badge, logout
├── pages/                   — One file per route
├── services/                — One file per API domain
└── app/
    └── router.tsx           — All routes with Protected() wrapper
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
- `initCsrf()` — seeds CSRF cookie on mount

CSRF token is read from `gyangrit_csrftoken` cookie (renamed from Django's default to avoid collision with the admin panel cookie).

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
| CSRF | Custom cookie name `gyangrit_csrftoken`, verified on all POST/PATCH |
| Single device | `SingleActiveSessionMiddleware` + `DeviceSession` model |
| Role enforcement | `@require_roles()` decorator on all protected views |
| Data scoping | `scope_queryset()` on all list endpoints |
| OTP brute force | 5-attempt limit, 10-minute expiry |
| Correct answers | `is_correct` never sent in any API response |
| Session age | `SESSION_COOKIE_AGE = 600` (10 min), extended on every request |

---

## 8. Settings Structure

```
backend/gyangrit/settings/
├── base.py    — shared config, database URL parsing, middleware stack
├── dev.py     — DEBUG=True, localhost CORS, renamed cookies
└── prod.py    — HTTPS flags, locked CORS, Supabase PostgreSQL
```

Cookie names are renamed in dev.py to prevent collision between the Django admin session and the frontend app session:
```python
SESSION_COOKIE_NAME = "gyangrit_sessionid"
CSRF_COOKIE_NAME = "gyangrit_csrftoken"
```

---

## 9. Database

**Development:** SQLite (local file `db.sqlite3`)

**Production:** PostgreSQL via Supabase connection pooler
- `DATABASE_URL` read from environment
- `DISABLE_SERVER_SIDE_CURSORS = True` required for pgBouncer compatibility
- `sslmode=require` on all production connections

---

## 10. Deployment Notes

See `docs/DEPLOYMENT.md` for full setup instructions.

Quick summary:
- Backend: `DJANGO_SETTINGS_MODULE=gyangrit.settings.prod`
- Frontend: `npm run build` → serve `dist/` via CDN or static host
- Database: Supabase PostgreSQL (managed)
- Environment: `SECRET_KEY`, `DATABASE_URL` in environment variables — never in code

---

## 11. Design Principles

- **Separation of concerns** — each app owns its domain completely
- **Single source of truth** — progress is derived, not duplicated
- **Explicit scoping** — data visibility is enforced at the queryset level, not assumed
- **Defensive validation** — `clean()` methods on all models with business rules
- **Signal-driven automation** — enrollment and assignment happen via signals, not in views
- **No silent failures** — every error is logged with context; bare `except` clauses are prohibited
- **Production-safe code** — no `print()`, no hardcoded secrets, no partial patches
