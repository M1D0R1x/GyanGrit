# GyanGrit — API & Frontend Endpoint Documentation

> **Status: Current as of March 2026**
> All 10 backend apps are fully implemented. This document reflects the actual
> production-ready state of the system.

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
- `otp_code` is only included when `DEBUG=True`. Never present in production.
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

### 4.2 Course Slug Resolution
**GET** `/api/v1/courses/by-slug/?grade=10&subject=punjabi`

Resolves a human-readable URL slug back to a course object. Used by `LessonsPage` when navigating to `/courses/:grade/:subject`.

Subject is the slug form of the subject name (lowercase, hyphenated). Returns 404 if no matching course, 400 if params missing, 403 if no access.

Response shape is identical to a row in `GET /courses/`.

---

### 4.3 Courses
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

Returns curriculum lessons merged with teacher-added section lessons, ordered correctly.

```json
[
  {
    "id": 1,
    "title": "Introduction to Algebra",
    "order": 1,
    "completed": false,
    "source": "curriculum"
  },
  {
    "id": 201,
    "title": "Extra Practice Problems",
    "order": 2,
    "completed": false,
    "source": "section"
  }
]
```

`completed` is derived from `LessonProgress` for the current user.
`source` is `"curriculum"` for admin-created lessons and `"section"` for teacher-added lessons.

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
  "pdf_url": null,
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
- Triggers gamification signal on first completion (lesson points, streak update, badge checks)

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

### 4.7 Section Lessons (Teacher-Added Content)

TEACHER, PRINCIPAL, and ADMIN can add supplementary lessons to a course. These appear alongside curriculum lessons in the lesson list.

| Endpoint | Method | Roles | Description |
|---|---|---|---|
| `/api/v1/lessons/section/{course_id}/` | GET | All authenticated | List section lessons for a course |
| `/api/v1/lessons/section/{course_id}/` | POST | TEACHER, PRINCIPAL, ADMIN | Create a section lesson |
| `/api/v1/lessons/section/{lesson_id}/update/` | PATCH | TEACHER, PRINCIPAL, ADMIN | Update a section lesson |
| `/api/v1/lessons/section/{lesson_id}/delete/` | DELETE | TEACHER, PRINCIPAL, ADMIN | Delete a section lesson |

TEACHER and PRINCIPAL are scoped — they can only manage lessons for courses within their institution.

Create request:
```json
{
  "title": "Extra Practice Problems",
  "content": "Supplementary text...",
  "video_url": null,
  "order": 3
}
```

---

### 4.8 Teacher Analytics

All analytics endpoints are scoped by role automatically. TEACHER sees their subjects, PRINCIPAL sees their institution, OFFICIAL sees their district, ADMIN sees all.

| Endpoint | Description |
|---|---|
| **GET** `/api/v1/teacher/analytics/courses/` | Course completion rates |
| **GET** `/api/v1/teacher/analytics/lessons/` | Lesson engagement stats |
| **GET** `/api/v1/teacher/analytics/classes/` | Class-level assessment stats (numerically sorted by class name) |
| **GET** `/api/v1/teacher/analytics/assessments/` | Assessment pass rates with `course_id` |
| **GET** `/api/v1/teacher/analytics/classes/{class_id}/students/` | Student list with stats |
| **GET** `/api/v1/teacher/analytics/classes/{class_id}/students/{student_id}/` | Individual student assessment history |

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

Assessment analytics response:
```json
[
  {
    "assessment_id": 1,
    "course_id": 1,
    "title": "Chapter 1 Quiz",
    "course": "Mathematics Class 8",
    "subject": "Mathematics",
    "total_attempts": 24,
    "unique_students": 18,
    "average_score": 14.5,
    "pass_count": 16,
    "fail_count": 8,
    "pass_rate": 66.67
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

Returns published assessments for a course. Student role only.

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

### 5.2 Assessment Detail (Student)
**GET** `/api/v1/assessments/{assessment_id}/`

`is_correct` is intentionally absent from all options. Never expose answers to client.

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

---

### 5.3 Assessment Detail (Admin/Builder)
**GET** `/api/v1/assessments/{assessment_id}/admin/`

Returns `is_correct` on each option. Used exclusively by the assessment builder UI.
Requires ADMIN, TEACHER, or PRINCIPAL role. TEACHER and PRINCIPAL are subject-scoped.

```json
{
  "id": 1,
  "title": "Chapter 1 Quiz",
  "is_published": true,
  "total_marks": 20,
  "pass_marks": 12,
  "questions": [
    {
      "id": 1,
      "text": "What is 2x when x = 5?",
      "marks": 2,
      "order": 1,
      "options": [
        { "id": 1, "text": "8",  "is_correct": false },
        { "id": 2, "text": "10", "is_correct": true  },
        { "id": 3, "text": "12", "is_correct": false },
        { "id": 4, "text": "25", "is_correct": false }
      ]
    }
  ]
}
```

---

### 5.4 Assessment CRUD

| Endpoint | Method | Roles | Description |
|---|---|---|---|
| `/api/v1/assessments/course/{course_id}/create/` | POST | ADMIN, TEACHER, PRINCIPAL | Create assessment |
| `/api/v1/assessments/{assessment_id}/update/` | PATCH | ADMIN, TEACHER, PRINCIPAL | Update assessment |
| `/api/v1/assessments/{assessment_id}/delete/` | DELETE | ADMIN, TEACHER, PRINCIPAL | Delete assessment |

TEACHER and PRINCIPAL require subject-level access to the course.

Create request:
```json
{
  "title": "Chapter 2 Quiz",
  "description": "Covers linear equations",
  "pass_marks": 12,
  "is_published": false
}
```

---

### 5.5 Question CRUD

| Endpoint | Method | Roles | Description |
|---|---|---|---|
| `/api/v1/assessments/{assessment_id}/questions/create/` | POST | ADMIN, TEACHER, PRINCIPAL | Add question |
| `/api/v1/assessments/questions/{question_id}/update/` | PATCH | ADMIN, TEACHER, PRINCIPAL | Update question |
| `/api/v1/assessments/questions/{question_id}/delete/` | DELETE | ADMIN, TEACHER, PRINCIPAL | Delete question |

Question create/update request:
```json
{
  "text": "What is 3x when x = 4?",
  "marks": 2,
  "order": 2,
  "options": [
    { "text": "8",  "is_correct": false },
    { "text": "12", "is_correct": true  },
    { "text": "16", "is_correct": false },
    { "text": "7",  "is_correct": false }
  ]
}
```

Validation rules:
- At least 2 options required
- Exactly one `is_correct: true` option required
- `Assessment.total_marks` is auto-recalculated via signal after every question save/delete

---

### 5.6 Start Assessment
**POST** `/api/v1/assessments/{assessment_id}/start/`

Creates or returns existing active attempt. Idempotent.

```json
{
  "attempt_id": 5,
  "assessment_id": 1,
  "started_at": "2026-03-15T10:30:00+05:30"
}
```

---

### 5.7 Submit Assessment
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

Side effect: triggers gamification signal (attempt points, pass points, perfect score bonus, streak update, badge checks).

---

### 5.8 My Attempts
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

### 5.9 My Assessment History
**GET** `/api/v1/assessments/my-history/`

STUDENT → their own full attempt history across all assessments.
ADMIN → any student's history via `?user_id=` param; returns empty list if no param.
Other roles → 403.

```json
[
  {
    "id": 5,
    "score": 14,
    "passed": true,
    "submitted_at": "2026-03-15T10:45:00+05:30",
    "assessment_id": 1,
    "assessment_title": "Chapter 1 Quiz",
    "total_marks": 20,
    "pass_marks": 12,
    "subject": "Mathematics",
    "grade": 8,
    "course_title": "Mathematics Class 8"
  }
]
```

---

### 5.10 My Assessments
**GET** `/api/v1/assessments/my/`

Scoped by role. STUDENT gets attempt stats; other roles get metadata only.

```json
[
  {
    "id": 1,
    "title": "Chapter 1 Quiz",
    "description": "Tests algebraic fundamentals",
    "total_marks": 20,
    "pass_marks": 12,
    "course_title": "Mathematics Class 8",
    "subject": "Mathematics",
    "grade": 8,
    "attempt_count": 2,
    "best_score": 16,
    "passed": true
  }
]
```

For non-STUDENT roles, `attempt_count`, `best_score` are `null` and `passed` is `false`.

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

Progress response:
```json
{
  "path_id": 1,
  "total_courses": 5,
  "completed_courses": 2,
  "percentage": 40
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

## 8. Gamification App

Base path: `/api/v1/gamification/`

All gamification endpoints require STUDENT role unless noted.
Points are awarded automatically via Django signals — no frontend POST needed.

### Point Values

| Action | Points |
|---|---|
| Lesson completed | +10 |
| Assessment attempted | +5 |
| Assessment passed | +25 |
| Perfect score (100%) | +50 bonus |
| 3-day streak | +15 bonus |
| 7-day streak | +50 bonus |

Points are awarded exactly once per event. The `PointEvent` ledger prevents duplicates.

### Badge Codes

| Code | Condition |
|---|---|
| `first_lesson` | Complete first lesson |
| `lesson_10` | Complete 10 lessons |
| `lesson_50` | Complete 50 lessons |
| `first_pass` | Pass first assessment |
| `perfect_score` | Achieve 100% on any assessment |
| `streak_3` | Reach 3-day streak |
| `streak_7` | Reach 7-day streak |
| `points_100` | Accumulate 100 points |
| `points_500` | Accumulate 500 points |

---

### 8.1 My Summary
**GET** `/api/v1/gamification/me/`

STUDENT role only.

```json
{
  "total_points": 185,
  "current_streak": 4,
  "longest_streak": 7,
  "badge_count": 5,
  "class_rank": 3,
  "badges": [
    {
      "code": "first_lesson",
      "label": "First Lesson",
      "emoji": "📖",
      "earned_at": "2026-03-01T09:00:00+05:30"
    }
  ]
}
```

`class_rank` is the student's current rank within their classroom. `null` if no class assigned.

---

### 8.2 Class Leaderboard
**GET** `/api/v1/gamification/leaderboard/class/`

STUDENT → returns their own class. Top 20 entries, with student's own entry injected if outside top 20.
TEACHER, PRINCIPAL, OFFICIAL, ADMIN → must pass `?class_id=` param.

```json
{
  "class_id": 1,
  "class_name": "8",
  "entries": [
    {
      "rank": 1,
      "user_id": 12,
      "display_name": "gurpreet_s",
      "total_points": 340,
      "is_me": false
    },
    {
      "rank": 3,
      "user_id": 5,
      "display_name": "harpreet_k",
      "total_points": 185,
      "is_me": true
    }
  ]
}
```

The `is_me` flag identifies the requesting student's own entry regardless of rank.

---

### 8.3 School Leaderboard
**GET** `/api/v1/gamification/leaderboard/school/`

STUDENT → their own school.
TEACHER, PRINCIPAL → their institution automatically.
OFFICIAL, ADMIN → must pass `?institution_id=` param.

```json
{
  "institution_name": "Government Senior Secondary School Amritsar",
  "entries": [
    {
      "rank": 1,
      "user_id": 45,
      "display_name": "simran_d",
      "total_points": 620,
      "is_me": false
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

### Student Routes

Note: Course and assessment URLs use human-readable slugs (grade + subject name) instead of numeric IDs.
Example: `/courses/10/punjabi`, `/assessments/8/social-studies/5`

| Route | Component | Purpose |
|---|---|---|
| `/dashboard` | DashboardPage | Subject progress + gamification strip |
| `/courses` | CoursesPage | All enrolled courses |
| `/courses/:grade/:subject` | LessonsPage | Lessons for a course e.g. `/courses/10/punjabi` |
| `/courses/:grade/:subject/assessments` | CourseAssessmentsPage | Assessments for a course |
| `/lessons/:lessonId` | LessonPage | Lesson content + completion |
| `/assessments` | AssessmentsPage | All accessible assessments |
| `/assessments/history` | AssessmentHistoryPage | Full attempt history |
| `/assessments/:grade/:subject/:assessmentId` | AssessmentPage | Assessment detail + start |
| `/assessments/:grade/:subject/:assessmentId/take` | AssessmentTakePage | Active assessment session |
| `/assessments/:grade/:subject/:assessmentId/history` | AssessmentHistoryPage | Per-assessment history |
| `/assessment-result` | AssessmentResultPage | Score + points earned after submit |
| `/learning` | LearningPathsPage | Learning path listing |
| `/learning/:pathId` | LearningPathPage | Path detail with courses |
| `/leaderboard` | LeaderboardPage | Class + school leaderboard |
| `/profile` | ProfilePage | User profile + badge shelf + logout |

### Teacher Routes

| Route | Component | Purpose |
|---|---|---|
| `/teacher` | TeacherDashboardPage | Subjects, classes, courses, assessments |
| `/teacher/classes/:classId` | TeacherClassDetailPage | Student list with stats |
| `/teacher/classes/:classId/students/:studentId` | TeacherStudentDetailPage | Individual student history |
| `/teacher/courses/:courseId/lessons` | AdminLessonEditorPage | Lesson editor (curriculum + section tabs) |
| `/teacher/courses/:courseId/assessments` | AdminAssessmentBuilderPage | Assessment builder |
| `/teacher/users` | UserManagementPage | Manage join codes for students |

### Principal Routes

| Route | Component | Purpose |
|---|---|---|
| `/principal` | PrincipalDashboardPage | Institution overview |
| `/principal/courses/:courseId/lessons` | AdminLessonEditorPage | Lesson editor |
| `/principal/courses/:courseId/assessments` | AdminAssessmentBuilderPage | Assessment builder |
| `/principal/users` | UserManagementPage | Manage join codes |

### Official Routes

| Route | Component | Purpose |
|---|---|---|
| `/official` | OfficialDashboardPage | District-level analytics |
| `/official/users` | UserManagementPage | Manage principal codes |

### Admin Routes

| Route | Component | Purpose |
|---|---|---|
| `/admin-panel` | AdminDashboardPage | Quick nav to all admin tools |
| `/admin/content` | AdminContentPage | Course and lesson management |
| `/admin/content/courses/:courseId/lessons` | AdminLessonEditorPage | Lesson editor |
| `/admin/content/courses/:courseId/assessments` | AdminAssessmentBuilderPage | Assessment builder |
| `/admin/join-codes` | AdminJoinCodesPage | Generate and manage all join codes |
| `/admin/users` | UserManagementPage | Full user management |

### Error Routes

| Route | Component |
|---|---|
| `/403` | ForbiddenPage |
| `/500` | ServerErrorPage |
| `/network-error` | NetworkErrorPage |
| `*` | NotFoundPage |

### Route Guards

Every non-public route is wrapped in `<RequireRole>` which enforces:
1. Authentication — redirects to `/login` if not authenticated
2. Role rank — shows 403 screen if insufficient role

Role hierarchy: `STUDENT(1) < TEACHER(2) < PRINCIPAL(3) < OFFICIAL(4) < ADMIN(5)`

All lazy-loaded routes use a consistent `<PageLoader />` fallback via `<Suspense>`.

---

## 10. Frontend Service Files

| File | Responsibility |
|---|---|
| `api.ts` | Base fetch helpers (`apiGet`, `apiPost`, `apiPatch`, `apiDelete`), CSRF init, session |
| `assessments.ts` | Assessment CRUD, attempt management, admin detail endpoint |
| `content.ts` | Section lesson CRUD (teacher-added lessons) |
| `courseProgress.ts` | Course progress fetching, resume lesson |
| `gamification.ts` | Points summary, class leaderboard, school leaderboard |
| `learningEnrollments.ts` | Enrollment management |
| `learningPaths.ts` | Learning path listing, detail, progress |
| `media.ts` | Cloudflare R2 media upload (presigned URLs) |
| `notifications.ts` | Notification fetching and marking read |
| `progress.ts` | Lesson progress PATCH |
| `teacherAnalytics.ts` | All teacher/analytics endpoints |
