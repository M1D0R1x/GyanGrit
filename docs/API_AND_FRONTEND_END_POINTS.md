# GyanGrit — API & Frontend Endpoint Documentation

> **Status: Updated 2026-03-18**
> All 11 backend apps are fully implemented. This document reflects the actual
> production-ready state of the system.
> Latest additions: Gradebook app (section 8b), Broadcast model (section 7 notifications),
> updated frontend routes (section 9), updated service files (section 10).

---

## 1. Global Rules

### API Versioning
All endpoints are under `/api/v1/`. Future versions will coexist without breaking this contract.

### Frontend API Rules (mandatory)
- All calls go through `src/services/api.ts`
- Paths are relative — never hardcode base URLs
- Session cookies sent with every request (`credentials: "include"`)
- CSRF token read from `gyangrit_csrftoken` cookie and sent as `X-CSRFToken` header

```ts
// Correct
apiGet("/courses/")

// Wrong — never do this
fetch("http://127.0.0.1:8000/api/v1/courses/")
```

### Authentication
All endpoints except those listed as **Public** require an active session cookie.
Unauthenticated requests return `401`. Insufficient role returns `403`.

---

## 2. Accounts App

Base path: `/api/v1/accounts/`

### 2.1 CSRF Seed (Public)
**GET** `/api/v1/accounts/csrf/`

Must be called on app mount before any POST. Seeds the `gyangrit_csrftoken` cookie.
Called automatically by `AuthContext` via `initCsrf()`.

---

### 2.2 Register (Public)
**POST** `/api/v1/accounts/register/`

Request:
```json
{
  "username": "student1",
  "password": "securepass",
  "join_code": "abc123def456"
}
```

Response:
```json
{
  "success": true,
  "role": "STUDENT",
  "requires_otp": false,
  "redirect_to": "/complete-profile"
}
```

Non-student roles always set `requires_otp: true`. The frontend redirects to `/verify-otp`.

---

### 2.3 Login (Public)
**POST** `/api/v1/accounts/login/`

Request:
```json
{
  "username": "teacher1",
  "password": "securepass"
}
```

Response:
```json
{
  "success": true,
  "role": "TEACHER",
  "requires_otp": true,
  "otp_code": "123456"
}
```

`otp_code` is only present when `DEBUG=True`. Never in production.
On success, a session cookie is set.

---

### 2.4 Verify OTP (Public)
**POST** `/api/v1/accounts/verify-otp/`

Request:
```json
{
  "otp_code": "123456"
}
```

Response: `{ "success": true, "redirect_to": "/teacher" }`

Attempts are counted. After 5 wrong attempts, the OTP is invalidated and the user must login again.

---

### 2.5 Logout
**POST** `/api/v1/accounts/logout/`

Clears session and DeviceSession record.

---

### 2.6 Me (Authenticated)
**GET** `/api/v1/accounts/me/`

Response when authenticated:
```json
{
  "authenticated": true,
  "id": 5,
  "public_id": "S-2026-a1b2c3d4",
  "username": "gurpreet_s",
  "role": "STUDENT",
  "first_name": "Gurpreet",
  "middle_name": "",
  "last_name": "Singh",
  "display_name": "Gurpreet Singh",
  "email": "gurpreet@example.com",
  "mobile_primary": "9876543210",
  "mobile_secondary": "",
  "profile_complete": true,
  "institution": "Government Senior Secondary School Amritsar",
  "institution_id": 1,
  "section": "8-A",
  "section_id": 3,
  "district": "Amritsar"
}
```

Response when not authenticated: `{ "authenticated": false }`

---

### 2.7 Update Profile
**PATCH** `/api/v1/accounts/profile/`

Request (all fields optional):
```json
{
  "first_name": "Gurpreet",
  "middle_name": "",
  "last_name": "Singh",
  "email": "gurpreet@example.com",
  "mobile_primary": "9876543210",
  "mobile_secondary": ""
}
```

When all required fields (`first_name`, `last_name`, `email`, `mobile_primary`) are present,
`profile_complete` is auto-set to `true`.

---

### 2.8 System Stats (ADMIN only)
**GET** `/api/v1/accounts/system-stats/`

```json
{
  "users": { "total": 1450, "students": 1300, "teachers": 120, "principals": 25, "officials": 5 },
  "courses": 42,
  "lessons": 380,
  "assessments": 95,
  "attempts": 4200
}
```

---

### 2.9 Teachers List (PRINCIPAL, OFFICIAL, ADMIN)
**GET** `/api/v1/accounts/teachers/`

Returns teachers scoped to the requester's institution or district.

```json
[
  { "id": 10, "username": "raminder_t" },
  { "id": 11, "username": "kuldeep_t" }
]
```

---

### 2.10 Users List (TEACHER, PRINCIPAL, OFFICIAL, ADMIN)
**GET** `/api/v1/accounts/users/`

TEACHER → returns only STUDENT users in their institution.
PRINCIPAL → institution-scoped all roles.
OFFICIAL → district-scoped.
ADMIN → all users.

Used by `UserManagementPage`.

---

### 2.11 Student Self-Register (Public)
**POST** `/api/v1/accounts/student-register/`

```json
{
  "registration_code": "abc123",
  "username": "gurpreet_s",
  "password": "securepass",
  "dob": "2010-05-15"
}
```

DOB is validated against the `StudentRegistrationRecord`. Mismatch → 400.

---

## 3. Academics App

Base path: `/api/v1/academics/`

### 3.1 Districts (Public)
**GET** `/api/v1/academics/districts/`

All 23 Punjab districts. Used in registration + join code forms.

### 3.2 Institutions
**GET** `/api/v1/academics/institutions/?district_id=5`

Filterable by `district_id`. Used in join code creation forms.

### 3.3 Classrooms
**GET** `/api/v1/academics/classrooms/?institution_id=1`

### 3.4 Sections
**GET** `/api/v1/academics/sections/?classroom__institution_id=1`

Returns:
```json
[
  {
    "id": 3,
    "name": "A",
    "classroom_id": 1,
    "grade": "8",
    "short_label": "Class 8-A",
    "label": "Class 8-A — Government Senior Secondary School Amritsar"
  }
]
```

**Important:** Use `short_label` in dropdowns, not `name` (which is just "A").

### 3.5 Subjects (Authenticated)
**GET** `/api/v1/academics/subjects/`

For STUDENT: returns their enrolled subjects with progress + `course_id` for resume logic.
For staff roles: returns the global subject catalog.

```json
[
  {
    "id": 2,
    "name": "Mathematics",
    "total_lessons": 20,
    "completed_lessons": 8,
    "progress": 40,
    "course_id": 5
  }
]
```

`course_id` is the primary course for this subject+grade. Used by DashboardPage
to fetch `resume_lesson_id` from `/courses/:id/progress/`.

---

## 4. Content App

Base path: `/api/v1/`

### 4.1 List Courses
**GET** `/api/v1/courses/`

Optional filters: `?subject_id=`, `?grade=`, `?is_core=true`

```json
[
  {
    "id": 5,
    "subject": "Mathematics",
    "grade": 8,
    "title": "Mathematics Class 8",
    "description": "...",
    "is_core": true,
    "slug": "mathematics",
    "total_lessons": 20
  }
]
```

### 4.2 Course by Slug
**GET** `/api/v1/courses/by-slug/?grade=8&subject=mathematics`

Resolves slug to course ID. Used by `LessonsPage` to handle human-readable URLs.

### 4.3 Create Course (ADMIN only)
**POST** `/api/v1/courses/`

```json
{
  "subject_id": 2,
  "grade": 8,
  "title": "Mathematics Class 8",
  "description": "...",
  "is_core": true
}
```

### 4.4 Course Lessons (Authenticated)
**GET** `/api/v1/courses/:id/lessons/`

Returns merged list of curriculum lessons + teacher-added section lessons.
Each item is tagged with `"source": "curriculum"` or `"source": "section"`.

Includes `completed` field per lesson for the requesting user.

### 4.5 Lesson Detail (Authenticated)
**GET** `/api/v1/lessons/:id/`

```json
{
  "id": 12,
  "title": "Algebra Basics",
  "order": 3,
  "content": "# Introduction\n...",
  "video_url": "https://youtube.com/...",
  "hls_manifest_url": null,
  "video_thumbnail_url": "...",
  "video_duration": "12:30",
  "pdf_url": "https://r2.cloudflarestorage.com/...",
  "is_published": true,
  "completed": false,
  "notes": [
    { "id": 1, "content": "Focus on factorisation", "author__username": "raminder_t" }
  ]
}
```

### 4.6 Create/Update Lesson (TEACHER, PRINCIPAL, ADMIN)
**POST** `/api/v1/courses/:id/lessons/` — create curriculum lesson

**PATCH** `/api/v1/lessons/:id/` — update

**POST** `/api/v1/courses/:id/section-lessons/` — create teacher-added lesson

### 4.7 Lesson Progress
**PATCH** `/api/v1/lessons/:id/progress/`

```json
{ "completed": true, "last_position": 720 }
```

Triggers gamification signals when `completed` is first set to `true`.

### 4.8 Course Progress
**GET** `/api/v1/courses/:id/progress/`

```json
{
  "course_id": 5,
  "total_lessons": 20,
  "completed_lessons": 8,
  "percentage": 40,
  "resume_lesson_id": 12
}
```

`resume_lesson_id` is the first lesson where `completed=False`, sorted by `order`.
`null` if all lessons complete.

### 4.9 Teacher Analytics

All endpoints require TEACHER role (or higher). TEACHER sees only their assigned subjects.
PRINCIPAL/OFFICIAL/ADMIN see institution- or district-scoped data.

**GET** `/api/v1/teacher/analytics/courses/`
```json
[
  {
    "course_id": 5,
    "title": "Mathematics Class 8",
    "subject": "Mathematics",
    "grade": 8,
    "total_lessons": 20,
    "completed_lessons": 8,
    "percentage": 40
  }
]
```

**GET** `/api/v1/teacher/analytics/classes/`
```json
[
  {
    "class_id": 1,
    "class_name": "Class 8-A",
    "institution": "Government Senior Secondary School Amritsar",
    "total_students": 35,
    "total_attempts": 120,
    "pass_rate": 72
  }
]
```

**GET** `/api/v1/teacher/analytics/classes/:id/students/`
```json
[
  {
    "id": 5,
    "username": "gurpreet_s",
    "display_name": "Gurpreet Singh",
    "total_lessons": 20,
    "completed_lessons": 8
  }
]
```

**GET** `/api/v1/teacher/analytics/assessments/`
```json
[
  {
    "assessment_id": 3,
    "title": "Chapter 1 Quiz",
    "course": "Mathematics Class 8",
    "subject": "Mathematics",
    "total_attempts": 28,
    "unique_students": 20,
    "average_score": 18,
    "pass_count": 14,
    "fail_count": 6,
    "pass_rate": 70
  }
]
```

---

## 5. Assessments App

Base path: `/api/v1/assessments/`

### 5.1 List Assessments
**GET** `/api/v1/assessments/`

For STUDENT: returns assessments with attempt history fields (`attempt_count`, `best_score`, `passed`).
For TEACHER+: returns raw list for management.

### 5.2 My Assessments
**GET** `/api/v1/assessments/my/`

STUDENT only. Returns assessments with attempt context. Used by `DashboardPage` and `AssessmentsPage`.

```json
[
  {
    "id": 3,
    "title": "Chapter 1 Quiz",
    "course_id": 5,
    "subject": "Mathematics",
    "grade": 8,
    "total_marks": 25,
    "pass_marks": 15,
    "is_published": true,
    "attempt_count": 2,
    "best_score": 20,
    "passed": true
  }
]
```

### 5.3 Assessment Detail (Student)
**GET** `/api/v1/assessments/:id/`

Returns questions with options. `is_correct` is **never** included. Options are shuffled on each request.

### 5.4 Assessment Detail (Admin/Builder)
**GET** `/api/v1/assessments/:id/admin/`

TEACHER, PRINCIPAL, ADMIN only. Includes `is_correct` for builder UI.

### 5.5 Create Assessment
**POST** `/api/v1/assessments/`

```json
{
  "course_id": 5,
  "title": "Chapter 1 Quiz",
  "pass_marks": 15
}
```

### 5.6 Submit Attempt
**POST** `/api/v1/assessments/:id/attempt/`

```json
{
  "selected_options": { "1": 3, "2": 7, "3": 12 }
}
```

Response includes `score`, `passed`, and points/badge metadata.

### 5.7 Attempt History
**GET** `/api/v1/assessments/history/`
**GET** `/api/v1/assessments/:id/history/`

---

## 6. Learning App

Base path: `/api/v1/learning/`

### 6.1 List Enrollments
**GET** `/api/v1/learning/enrollments/`

### 6.2 Enroll
**POST** `/api/v1/learning/enrollments/`

```json
{ "course_id": 5 }
```

### 6.3 Learning Paths
**GET** `/api/v1/learning/paths/`
**GET** `/api/v1/learning/paths/:id/`
**GET** `/api/v1/learning/paths/:id/progress/`

### 6.4 Student Dashboard
**GET** `/api/v1/learning/student/dashboard/`

Optimised — returns all enrolled courses with progress in a single call.

---

## 7. Roster App

Base path: `/api/v1/roster/`

TEACHER or PRINCIPAL role required.

### 7.1 Upload Roster
**POST** `/api/v1/roster/upload/`

Multipart `.xlsx` or `.xls`, max 5MB.
Columns: `Name | DOB (YYYY-MM-DD) | Section_ID`

```json
{
  "success": true,
  "created_count": 28,
  "skipped_count": 2,
  "students": [
    {
      "name": "Gurpreet Singh",
      "registration_code": "abc123def456",
      "uuid": "uuid-here",
      "section": "8 A - Government Senior Secondary School Amritsar"
    }
  ],
  "skipped": [
    { "row": 5, "name": "Invalid Row", "reason": "Invalid date format." }
  ]
}
```

### 7.2 List Registration Records
**GET** `/api/v1/roster/records/?section_id=3`

### 7.3 Regenerate Code
**POST** `/api/v1/roster/regenerate-code/`

```json
{ "record_id": 1 }
```

---

## 7b. Notifications App

Base path: `/api/v1/notifications/`

### 7b.1 My Notifications (Inbox)
**GET** `/api/v1/notifications/me/`

```json
{
  "unread": 3,
  "notifications": [
    {
      "id": 12,
      "message": "New lesson published: Algebra Basics",
      "notification_type": "lesson_published",
      "is_read": false,
      "created_at": "2026-03-18T10:30:00+05:30",
      "sender": "System",
      "attachment_url": null,
      "attachment_name": null,
      "link": null
    }
  ]
}
```

### 7b.2 Mark Read
**POST** `/api/v1/notifications/mark-read/`

```json
{ "notification_ids": [12, 13] }
```

### 7b.3 Mark All Read
**POST** `/api/v1/notifications/mark-all-read/`

### 7b.4 Broadcasts (Sent messages)
**GET** `/api/v1/notifications/broadcasts/`

Returns the sender's own sent broadcasts. TEACHER, PRINCIPAL, OFFICIAL, ADMIN.

### 7b.5 Send Broadcast
**POST** `/api/v1/notifications/broadcasts/`

```json
{
  "subject": "Class cancelled tomorrow",
  "body": "Due to heavy rain...",
  "audience_type": "class",
  "class_id": 3
}
```

Creates `Notification` objects for all matching recipients automatically.

### 7b.6 Broadcast Audience Options
**GET** `/api/v1/notifications/audience-options/`

Returns what audience types the requester can target, plus their class/institution lists.

```json
{
  "allowed_audience_types": ["class", "institution"],
  "classrooms": [{ "id": 3, "name": "Class 8-A" }],
  "institutions": [{ "id": 1, "name": "GSSS Amritsar" }]
}
```

---

## 8. Gamification App

Base path: `/api/v1/gamification/`

All endpoints require STUDENT role unless noted.

### Point Values

| Action | Points |
|---|---|
| Lesson completed | +10 |
| Assessment attempted | +5 |
| Assessment passed | +25 |
| Perfect score (100%) | +50 bonus |
| 3-day streak | +15 bonus |
| 7-day streak | +50 bonus |

### 8.1 My Summary
**GET** `/api/v1/gamification/me/`

```json
{
  "total_points": 185,
  "current_streak": 4,
  "longest_streak": 7,
  "badge_count": 5,
  "class_rank": 3,
  "badges": [
    { "code": "first_lesson", "label": "First Lesson", "emoji": "📖", "earned_at": "..." }
  ]
}
```

### 8.2 Class Leaderboard
**GET** `/api/v1/gamification/leaderboard/class/`

STUDENT → their own class (top 20, own entry injected if outside top 20).
Staff → must pass `?class_id=`.

### 8.3 School Leaderboard
**GET** `/api/v1/gamification/leaderboard/school/`

---

## 8b. Gradebook App

Base path: `/api/v1/gradebook/`

TEACHER or PRINCIPAL role required for all endpoints.

**Purpose:** Manual marks for oral, practical, project, and paper-based assessments that the digital quiz engine doesn't cover.

### 8b.1 Grade Choices
**GET** `/api/v1/gradebook/choices/`

Returns term and category options for form dropdowns.

```json
{
  "terms": [
    { "value": "term_1", "label": "Term 1" },
    { "value": "term_2", "label": "Term 2" },
    { "value": "term_3", "label": "Term 3" },
    { "value": "annual",  "label": "Annual" }
  ],
  "categories": [
    { "value": "unit_test",  "label": "Unit Test" },
    { "value": "mid_term",   "label": "Mid Term" },
    { "value": "final",      "label": "Final Exam" },
    { "value": "project",    "label": "Project" },
    { "value": "oral",       "label": "Oral" },
    { "value": "practical",  "label": "Practical" }
  ]
}
```

### 8b.2 Create Entry
**POST** `/api/v1/gradebook/entry/`

```json
{
  "student_id": 5,
  "subject_id": 2,
  "term": "term_1",
  "category": "unit_test",
  "marks": 18,
  "total_marks": 25,
  "notes": "Good performance"
}
```

Response: full `GradeEntry` object (see 8b.5).
`percentage` is always computed server-side — never trust client value.

Unique constraint: `(student, subject, term, category)`. Creating a duplicate returns 400 with a clear error.

### 8b.3 Update Entry
**PATCH** `/api/v1/gradebook/entry/:id/`

```json
{
  "marks": 20,
  "total_marks": 25,
  "notes": "Revised after recheck"
}
```

Only the teacher who created the entry (or PRINCIPAL) can update it.

### 8b.4 Delete Entry
**DELETE** `/api/v1/gradebook/entry/:id/delete/`

Returns `{ "success": true }`.

### 8b.5 Student Grades
**GET** `/api/v1/gradebook/student/:id/`

All grades for one student, optionally filtered by `?term=` or `?subject_id=`.

```json
[
  {
    "id": 8,
    "student_id": 5,
    "subject": "Mathematics",
    "subject_id": 2,
    "term": "term_1",
    "category": "unit_test",
    "marks": 18.0,
    "total_marks": 25.0,
    "percentage": 72.0,
    "notes": "Good performance",
    "created_at": "2026-03-18T11:00:00+05:30"
  }
]
```

### 8b.6 Class Grades
**GET** `/api/v1/gradebook/class/:id/`

All grades grouped by student for a full classroom. Same optional filters as 8b.5.

```json
{
  "class_id": 1,
  "class_name": "Class 8-A",
  "students": [
    {
      "student_id": 5,
      "student": "Gurpreet Singh",
      "username": "gurpreet_s",
      "entries": [
        {
          "id": 8,
          "subject": "Mathematics",
          "subject_id": 2,
          "term": "term_1",
          "category": "unit_test",
          "marks": 18.0,
          "total_marks": 25.0,
          "percentage": 72.0,
          "notes": "Good performance"
        }
      ]
    }
  ]
}
```

---

## 9. Frontend Routes

### Public Routes

| Route | Component | Purpose |
|---|---|---|
| `/login` | LoginPage | Username/password login |
| `/register` | RegisterPage | Join-code-based registration |
| `/verify-otp` | VerifyOtpPage | OTP verification for non-student roles |
| `/complete-profile` | CompleteProfilePage | Post-registration profile completion |

### Shared Routes (all authenticated roles)

| Route | Component | Purpose |
|---|---|---|
| `/notifications` | NotificationsPage | Inbox, send, broadcast history |
| `/profile` | ProfilePage | Profile edit, badges, gamification |

### Student Routes

Course and assessment URLs use human-readable slugs:
`/courses/10/punjabi`, `/assessments/8/social-studies/5`

| Route | Component | Purpose |
|---|---|---|
| `/dashboard` | DashboardPage | Subject progress + assessments + gamification strip + Continue/Start resume |
| `/courses` | CoursesPage | All enrolled courses |
| `/courses/:grade/:subject` | LessonsPage | Course lesson list |
| `/courses/:grade/:subject/assessments` | CourseAssessmentsPage | Assessments for a course |
| `/lessons/:lessonId` | LessonPage | Video, PDF, Markdown, notes, mark-complete |
| `/assessments` | AssessmentsPage | All assessments with score rings |
| `/assessments/history` | AssessmentHistoryPage | Global attempt history |
| `/assessments/:grade/:subject/:assessmentId` | AssessmentPage | Instructions + start |
| `/assessments/:grade/:subject/:assessmentId/take` | AssessmentTakePage | Timer, dot nav, auto-submit |
| `/assessments/:grade/:subject/:assessmentId/history` | AssessmentHistoryPage | Per-assessment history |
| `/assessment-result` | AssessmentResultPage | Score + points banner |
| `/learning` | LearningPathsPage | Learning paths listing |
| `/learning/:pathId` | LearningPathPage | Path detail |
| `/leaderboard` | LeaderboardPage | Class + school |

### Teacher Routes

| Route | Component | Purpose |
|---|---|---|
| `/teacher` | TeacherDashboardPage | Classes, courses, assessments analytics |
| `/teacher/classes/:classId` | TeacherClassDetailPage | Student lesson progress + Gradebook button |
| `/teacher/classes/:classId/gradebook` | GradebookPage | Manual mark entry/edit/delete |
| `/teacher/classes/:classId/students/:studentId` | TeacherStudentDetailPage | Individual student attempt history |
| `/teacher/courses/:courseId/lessons` | AdminLessonEditorPage | Lesson editor (curriculum + section tabs) |
| `/teacher/courses/:courseId/assessments` | AdminAssessmentBuilderPage | Assessment builder |
| `/teacher/users` | UserManagementPage | Join codes + student management |

### Principal Routes

| Route | Component | Purpose |
|---|---|---|
| `/principal` | PrincipalDashboardPage | Classes, courses, assessments, teachers |
| `/principal/classes/:classId/gradebook` | GradebookPage | Manual marks view/edit |
| `/principal/courses/:courseId/lessons` | AdminLessonEditorPage | Lesson editor |
| `/principal/courses/:courseId/assessments` | AdminAssessmentBuilderPage | Assessment builder |
| `/principal/users` | UserManagementPage | Join codes for teachers |

### Official Routes

| Route | Component | Purpose |
|---|---|---|
| `/official` | OfficialDashboardPage | District analytics, school filter |
| `/official/users` | UserManagementPage | Principal codes |

### Admin Routes

| Route | Component | Purpose |
|---|---|---|
| `/admin-panel` | AdminDashboardPage | System stats + quick nav |
| `/admin/content` | AdminContentPage | Course creation + management |
| `/admin/content/courses/:courseId/lessons` | AdminLessonEditorPage | Lesson editor |
| `/admin/content/courses/:courseId/assessments` | AdminAssessmentBuilderPage | Assessment builder |
| `/admin/join-codes` | AdminJoinCodesPage | All join codes |
| `/admin/users` | UserManagementPage | Full user management |

### Error Routes

| Route | Component |
|---|---|
| `/403` | ForbiddenPage |
| `/500` | ServerErrorPage |
| `/network-error` | NetworkErrorPage |
| `*` | NotFoundPage |

### Route Guards

Every non-public route uses `<RequireRole>`. Role hierarchy enforced:
`STUDENT(1) < TEACHER(2) < PRINCIPAL(3) < OFFICIAL(4) < ADMIN(5)`

All lazy-loaded pages use `<Suspense fallback={<PageLoader />}>`.

---

## 10. Frontend Service Files

| File | Responsibility |
|---|---|
| `api.ts` | Base fetch helpers (`apiGet`, `apiPost`, `apiPatch`, `apiDelete`), CSRF init, session |
| `assessments.ts` | Assessment CRUD, attempt management, admin detail, `AssessmentWithStatus` type |
| `content.ts` | Section lesson CRUD, `getLessonDetail`, `getCourseBySlug` |
| `courseProgress.ts` | Course progress fetching, `resume_lesson_id` |
| `gamification.ts` | Points summary, class leaderboard, school leaderboard |
| `gradebook.ts` | NEW — `GradeEntry` CRUD, choices, class/student views |
| `learningEnrollments.ts` | Enrollment management |
| `learningPaths.ts` | Learning path listing, detail, progress |
| `media.ts` | Cloudflare R2 presigned upload, `extractYouTubeId`, `extractVimeoId` |
| `notifications.ts` | Inbox fetch, mark read, broadcast send, audience options |
| `progress.ts` | Lesson progress PATCH |
| `teacherAnalytics.ts` | Analytics — classes, courses, assessments, class students |

---

## 11. TopBar NavMenu (Demo)

> **⚠️ Temporary feature — to be redesigned post-capstone**

A `NavMenu` component is mounted in `TopBar` (left of the notification bell).
It renders a role-aware dropdown showing all accessible routes for the current user.

Purpose: allow supervisors and demo reviewers to navigate the full system quickly.

**TODO:** Replace with:
- A sidebar drawer for staff roles (TEACHER, PRINCIPAL, OFFICIAL, ADMIN)
- Students already have `BottomNav` — remove the nav menu redundancy on mobile
- Remove the "⚠️ Demo nav" banner from the panel once replaced
