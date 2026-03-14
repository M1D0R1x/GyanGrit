# GyanGrit — API & Frontend Endpoint Documentation

> **Status: Current as of March 2026**
> All 7 backend apps are fully implemented. This document reflects the actual
> production-ready state of the system, not a scaffold.

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
  "id": 1,
  "public_id": "S-2026-a1b2c3d4",
  "username": "student1",
  "role": "STUDENT",
  "institution": "Government Senior Secondary School Amritsar",
  "section": "A"
}
```

Notes:
- Role is locked by the join code — not chosen by the user
- For TEACHER role, automatically creates `TeachingAssignment` records for grades 6–10
- Join code is marked as used after successful registration

---

### 2.3 Student Self-Register (Public)
**POST** `/api/v1/accounts/student-register/`

Used when a teacher has pre-loaded a student via roster upload.

Request:
```json
{
  "registration_code": "abc123def456",
  "username": "student2",
  "password": "securepass",
  "dob": "2010-05-15"
}
```

Response:
```json
{
  "id": 2,
  "public_id": "S-2026-e5f6g7h8",
  "username": "student2",
  "section": "A",
  "institution": "Government Senior Secondary School Amritsar"
}
```

---

### 2.4 Login (Public)
**POST** `/api/v1/accounts/login/`

Request:
```json
{
  "username": "teacher1",
  "password": "securepass"
}
```

Response (STUDENT or ADMIN — direct login):
```json
{
  "otp_required": false,
  "id": 3,
  "username": "teacher1",
  "role": "STUDENT"
}
```

Response (TEACHER / PRINCIPAL / OFFICIAL — OTP required):
```json
{
  "otp_required": true,
  "id": 3,
  "username": "teacher1",
  "role": "TEACHER",
  "otp_code": "123456"
}
```

Notes:
- `otp_code` is only included in DEBUG mode. Remove before production.
- After successful login, a `DeviceSession` is created to enforce single-device policy.

---

### 2.5 Verify OTP (Public)
**POST** `/api/v1/accounts/verify-otp/`

Request:
```json
{
  "username": "teacher1",
  "otp": "123456"
}
```

Response:
```json
{
  "success": true,
  "role": "TEACHER"
}
```

Notes:
- Maximum 5 attempts before lockout
- OTP expires after 10 minutes
- Creates `DeviceSession` on success

---

### 2.6 Logout
**POST** `/api/v1/accounts/logout/`

Clears Django session and deletes `DeviceSession` record.

Response:
```json
{ "success": true }
```

---

### 2.7 Me (Current User)
**GET** `/api/v1/accounts/me/`

Returns full profile of the currently authenticated user.

Response:
```json
{
  "authenticated": true,
  "id": 1,
  "public_id": "T-2026-a1b2c3d4",
  "username": "teacher1",
  "role": "TEACHER",
  "institution": "Government Senior Secondary School Amritsar",
  "institution_id": 5,
  "section": null,
  "section_id": null,
  "district": "Amritsar"
}
```

Response (unauthenticated):
```json
{ "authenticated": false }
```

---

### 2.8 Validate Join Code (Public)
**POST** `/api/v1/accounts/validate-join-code/`

Used by the register page to preview role before submission.

Request:
```json
{ "join_code": "abc123def456" }
```

Response:
```json
{
  "valid": true,
  "role": "TEACHER",
  "institution": "Government Senior Secondary School Amritsar",
  "section": null,
  "district": "Amritsar",
  "subject": "Mathematics"
}
```

---

### 2.9 Scoped User Lists (Role-restricted)

| Endpoint | Allowed Roles | Returns |
|---|---|---|
| **GET** `/api/v1/accounts/users/` | ADMIN, OFFICIAL, PRINCIPAL | `[{id, username, role}]` |
| **GET** `/api/v1/accounts/teachers/` | ADMIN, OFFICIAL, PRINCIPAL | `[{id, username}]` |
| **GET** `/api/v1/accounts/sections/` | ADMIN, OFFICIAL, PRINCIPAL, TEACHER | `[{id, name}]` |
| **GET** `/api/v1/accounts/subjects/` | ADMIN, OFFICIAL, PRINCIPAL, TEACHER | `[{id, name}]` |
| **GET** `/api/v1/accounts/institutions/` | ADMIN, OFFICIAL, PRINCIPAL | `[{id, name, district__name}]` |

All list endpoints are automatically scoped by role:
- ADMIN → all records
- OFFICIAL → district scope
- PRINCIPAL → institution scope
- TEACHER → institution scope

---

## 3. Academics App

Base path: `/api/v1/academics/`

### 3.1 Public Endpoints (No Auth)

**GET** `/api/v1/academics/districts/?q=amritsar`

Used during registration to populate district dropdown.

Response: `[{id, name}]`

---

**GET** `/api/v1/academics/schools/?district_id=1&q=govt`

Used during registration to populate school dropdown.

Response: `[{id, name, district__name, is_government}]`

---

### 3.2 Academic Structure (Auth Required)

| Endpoint | Description | Roles |
|---|---|---|
| **GET** `/api/v1/academics/institutions/` | Scoped institution list | ADMIN, OFFICIAL, PRINCIPAL |
| **GET** `/api/v1/academics/classes/` | ClassRooms in scope | All authenticated |
| **GET** `/api/v1/academics/sections/?classroom_id=1` | Sections in scope | All authenticated |
| **GET** `/api/v1/academics/subjects/` | Subjects with progress for STUDENT | All authenticated |

### 3.3 Subject Response (STUDENT role)

When called by a STUDENT, `/api/v1/academics/subjects/` returns progress data:

```json
[
  {
    "id": 1,
    "name": "Mathematics",
    "total_lessons": 20,
    "completed_lessons": 8,
    "progress": 40
  }
]
```

---

### 3.4 Teaching Assignments

| Endpoint | Description | Roles |
|---|---|---|
| **GET** `/api/v1/academics/teaching-assignments/` | All assignments in scope | ADMIN, OFFICIAL, PRINCIPAL |
| **GET** `/api/v1/academics/my-assignments/` | Current teacher's assignments | TEACHER only |

My assignments response:
```json
[
  {
    "subject_id": 1,
    "subject_name": "Mathematics",
    "section_id": 3,
    "section_name": "A",
    "class_name": "8"
  }
]
```

---

## 4. Content App

Base path: `/api/v1/` (mounted at root for historical reasons)

### 4.1 Health Check
**GET** `/api/v1/health/`

```json
{
  "status": "ok",
  "service": "gyangrit-backend",
  "timestamp": "2026-03-15T10:30:00+05:30"
}
```

---

### 4.2 Courses
**GET** `/api/v1/courses/`

Response is scoped by role. Students see only enrolled subjects' courses.

```json
[
  {
    "id": 1,
    "title": "Mathematics Class 8",
    "description": "Core mathematics curriculum",
    "grade": 8,
    "is_core": true,
    "subject__name": "Mathematics"
  }
]
```

---

### 4.3 Course Lessons
**GET** `/api/v1/courses/{course_id}/lessons/`

```json
[
  {
    "id": 1,
    "title": "Introduction to Algebra",
    "order": 1,
    "completed": false
  }
]
```

`completed` is derived from `LessonProgress` for the current user.

---

### 4.4 Lesson Detail
**GET** `/api/v1/lessons/{lesson_id}/`

Side effect: updates `last_opened_at` in `LessonProgress`.

```json
{
  "id": 1,
  "title": "Introduction to Algebra",
  "content": "Lesson text content...",
  "video_url": null,
  "hls_manifest_url": null,
  "thumbnail_url": null,
  "completed": false,
  "last_position": 0
}
```

Note: `completed` and `last_position` are returned inline. No separate progress GET needed.

---

### 4.5 Lesson Progress
**PATCH** `/api/v1/lessons/{lesson_id}/progress/`

Request:
```json
{ "completed": true, "last_position": 240 }
```

Response:
```json
{ "lesson_id": 1, "completed": true, "last_position": 240 }
```

Rules:
- Only provided fields are updated
- Idempotent — safe to retry

---

### 4.6 Course Progress
**GET** `/api/v1/courses/{course_id}/progress/`

```json
{
  "course_id": 1,
  "completed": 3,
  "total": 10,
  "percentage": 30,
  "resume_lesson_id": 4
}
```

Resume priority:
1. Most recently opened incomplete lesson
2. First uncompleted lesson by order
3. `null` if course complete

---

### 4.7 Teacher Analytics

All analytics endpoints are scoped by role automatically.

| Endpoint | Description |
|---|---|
| **GET** `/api/v1/teacher/analytics/courses/` | Course completion rates |
| **GET** `/api/v1/teacher/analytics/lessons/` | Lesson engagement stats |
| **GET** `/api/v1/teacher/analytics/classes/` | Class-level assessment stats |
| **GET** `/api/v1/teacher/analytics/assessments/` | Assessment pass rates |
| **GET** `/api/v1/teacher/analytics/classes/{class_id}/students/` | Student list with stats |
| **GET** `/api/v1/teacher/analytics/classes/{class_id}/students/{student_id}/` | Individual student detail |

Course analytics response:
```json
[
  {
    "course_id": 1,
    "title": "Mathematics Class 8",
    "subject": "Mathematics",
    "grade": 8,
    "total_lessons": 10,
    "completed_lessons": 6,
    "percentage": 60
  }
]
```

Class analytics response:
```json
[
  {
    "class_id": 1,
    "class_name": "8",
    "institution": "Government Senior Secondary School Amritsar",
    "total_students": 32,
    "total_attempts": 96,
    "average_score": 14.5,
    "pass_rate": 72.9
  }
]
```

---

## 5. Assessments App

Base path: `/api/v1/assessments/`

### 5.1 Course Assessments
**GET** `/api/v1/assessments/course/{course_id}/`

Returns published assessments for a course.

```json
[
  {
    "id": 1,
    "title": "Chapter 1 Quiz",
    "description": "Tests algebraic fundamentals",
    "total_marks": 20,
    "pass_marks": 12
  }
]
```

---

### 5.2 Assessment Detail
**GET** `/api/v1/assessments/{assessment_id}/`

```json
{
  "id": 1,
  "title": "Chapter 1 Quiz",
  "description": "Tests algebraic fundamentals",
  "total_marks": 20,
  "pass_marks": 12,
  "questions": [
    {
      "id": 1,
      "text": "What is 2x when x = 5?",
      "marks": 2,
      "order": 1,
      "options": [
        { "id": 1, "text": "8" },
        { "id": 2, "text": "10" },
        { "id": 3, "text": "12" },
        { "id": 4, "text": "25" }
      ]
    }
  ]
}
```

Note: `is_correct` is intentionally absent from options. Never expose answers to client.

---

### 5.3 Start Assessment
**POST** `/api/v1/assessments/{assessment_id}/start/`

Creates or returns existing active attempt.

```json
{
  "attempt_id": 5,
  "assessment_id": 1,
  "started_at": "2026-03-15T10:30:00+05:30"
}
```

---

### 5.4 Submit Assessment
**POST** `/api/v1/assessments/{assessment_id}/submit/`

Request:
```json
{
  "attempt_id": 5,
  "selected_options": {
    "1": 2,
    "2": 7,
    "3": 11
  }
}
```

Keys are question IDs (strings), values are selected option IDs (integers).

Response:
```json
{
  "attempt_id": 5,
  "score": 14,
  "passed": true,
  "total_marks": 20,
  "pass_marks": 12
}
```

---

### 5.5 My Attempts
**GET** `/api/v1/assessments/{assessment_id}/my-attempts/`

```json
[
  {
    "id": 5,
    "score": 14,
    "passed": true,
    "started_at": "2026-03-15T10:30:00+05:30",
    "submitted_at": "2026-03-15T10:45:00+05:30"
  }
]
```

---

### 5.6 Assessment Analytics

Same endpoints as content app analytics — see Section 4.7.

---

## 6. Learning App

Base path: `/api/v1/learning/`

### 6.1 Enrollments

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/learning/enrollments/` | GET | List enrolled courses |
| `/api/v1/learning/enroll/` | POST | Enroll in a course |
| `/api/v1/learning/enrollments/{id}/` | PATCH | Update status |

Enrollment list response:
```json
[
  {
    "id": 1,
    "course__id": 2,
    "course__title": "Chemistry Class 9",
    "status": "enrolled",
    "enrolled_at": "2026-01-01T10:00:00Z",
    "completed_at": null
  }
]
```

Add `?include_dropped=true` to include dropped enrollments.

Status values: `enrolled` | `completed` | `dropped`

---

### 6.2 Learning Paths

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/learning/paths/` | GET | List all paths |
| `/api/v1/learning/paths/{id}/` | GET | Path with ordered courses |
| `/api/v1/learning/paths/{id}/progress/` | GET | Completion percentage |
| `/api/v1/learning/paths/{id}/enroll/` | POST | Enroll in all path courses |

Path detail response:
```json
{
  "id": 1,
  "name": "Class 9 Science Track",
  "description": "Complete science curriculum for Class 9",
  "courses": [
    {
      "course_id": 1,
      "title": "Physics Class 9",
      "grade": 9,
      "subject": "Physics",
      "order": 1
    }
  ]
}
```

---

### 6.3 Student Dashboard
**GET** `/api/v1/learning/student/dashboard/`

Optimised endpoint — returns all enrolled courses with progress in a single call.

```json
{
  "courses": [
    {
      "id": 1,
      "title": "Mathematics Class 8",
      "subject": "Mathematics",
      "grade": 8,
      "status": "enrolled",
      "total_lessons": 10,
      "completed_lessons": 4,
      "progress": 40
    }
  ]
}
```

---

## 7. Roster App

Base path: `/api/v1/roster/`

All endpoints require TEACHER or PRINCIPAL role.

### 7.1 Upload Roster
**POST** `/api/v1/roster/upload/`

Multipart form upload. File must be `.xlsx` or `.xls`, max 5MB.

Expected columns: `Name | DOB (YYYY-MM-DD) | Section_ID`

Response:
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
    {
      "row": 5,
      "name": "Invalid Row",
      "reason": "Invalid date format: '15/05/2010'. Expected YYYY-MM-DD."
    }
  ]
}
```

---

### 7.2 List Registration Records
**GET** `/api/v1/roster/records/?section_id=3&page=1&limit=20`

Response:
```json
{
  "success": true,
  "count": 35,
  "total_pages": 2,
  "current_page": 1,
  "records": [
    {
      "id": 1,
      "name": "Gurpreet Singh",
      "student_uuid": "uuid-here",
      "registration_code": "abc123def456",
      "is_registered": false,
      "section__name": "A",
      "section__classroom__name": "8",
      "section__classroom__institution__name": "Government Senior Secondary School Amritsar"
    }
  ]
}
```

---

### 7.3 Regenerate Code
**POST** `/api/v1/roster/regenerate-code/`

Request:
```json
{ "record_id": 1 }
```

Response:
```json
{
  "success": true,
  "student_uuid": "uuid-here",
  "new_registration_code": "newcode789",
  "name": "Gurpreet Singh"
}
```

---

## 8. Frontend Routes

### Public Routes

| Route | Component | Purpose |
|---|---|---|
| `/login` | LoginPage | Email/password login |
| `/register` | RegisterPage | Join-code-based registration |
| `/verify-otp` | VerifyOtpPage | OTP verification for non-student roles |

### Student Routes

| Route | Component | Purpose |
|---|---|---|
| `/dashboard` | DashboardPage | Subject progress overview |
| `/courses` | CoursesPage | All enrolled courses |
| `/courses/:courseId` | LessonsPage | Lessons with completion status |
| `/lessons/:lessonId` | LessonPage | Lesson content + completion |
| `/learning` | LearningPathsPage | Learning path listing |
| `/learning/:pathId` | LearningPathPage | Path detail with courses |
| `/profile` | ProfilePage | User profile + logout |
| `/courses/:courseId/assessments` | CourseAssessmentsPage | Assessments for a course |
| `/assessments/:assessmentId` | AssessmentPage | Take assessment |
| `/assessment-result` | AssessmentResultPage | Score after submission |
| `/assessments/:assessmentId/history` | AssessmentHistoryPage | Past attempts |

### Teacher Routes

| Route | Component | Purpose |
|---|---|---|
| `/teacher` | TeacherDashboardPage | Subjects, classes, courses, assessments |
| `/teacher/classes/:classId` | TeacherClassDetailPage | Student list with stats |
| `/teacher/classes/:classId/students/:studentId` | TeacherStudentDetailPage | Individual student history |

### Other Role Routes

| Route | Component | Role |
|---|---|---|
| `/principal` | PrincipalDashboardPage | PRINCIPAL |
| `/official` | OfficialDashboardPage | OFFICIAL |
| `/admin-panel` | AdminDashboardPage | ADMIN |

### Route Guards

Every non-public route is wrapped in `<RequireRole>` which enforces:
1. Authentication — redirects to `/login` if not authenticated
2. Role rank — shows 403 screen if insufficient role

Role hierarchy: `STUDENT(1) < TEACHER(2) < PRINCIPAL(3) < OFFICIAL(4) < ADMIN(5)`

---

## 9. Frontend Service Files

| File | Responsibility |
|---|---|
| `api.ts` | Base fetch helpers, CSRF, session |
| `assessments.ts` | Assessment CRUD and attempt management |
| `courseProgress.ts` | Course progress fetching |
| `learningEnrollments.ts` | Enrollment management |
| `learningPaths.ts` | Learning path fetching |
| `progress.ts` | Lesson progress PATCH |
| `teacherAnalytics.ts` | All teacher/analytics endpoints |
