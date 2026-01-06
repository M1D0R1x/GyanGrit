# GyanGrit – Backend & Frontend Endpoint Documentation

> **Status**
> - Content app: **Frozen**
> - Learning app: **Frozen**
> - Accounts app: **Versioned scaffold ready**
>
> This document is the **single source of truth** for the current backend + frontend contract.
> It reflects exactly what is implemented and stable.

---

## 1. Global API Versioning

All backend APIs are versioned under:

`/api/v1/`

Rules:
- Frontend **must never hardcode** base URLs
- All calls go through `api.ts`
- Future versions (`/v2`, `/v3`) will coexist

---

## 2. Content App (Frozen)

Base path: `/api/v1/`

### 2.1 Health Check

**GET** `/api/v1/health/`

Response:

{
  "status": "ok",
  "service": "gyangrit-backend"
}


Purpose:
Backend liveness check

### 2.2 Courses

List all courses  
**GET** `/api/v1/courses/`

Response:

```json
[
  {
    "id": 1,
    "title": "CS",
    "description": "Computer Science basics"
  }
]
```

Used by:
Courses page
Student dashboard

### 2.3 Course Lessons

**GET** `/api/v1/courses/{course_id}/lessons/`

Response:

[
  {
    "id": 1,
    "title": "Introduction",
    "order": 1,
    "completed": false
  }
]


Notes:
- completed is derived from LessonProgress
- No frontend-side logic

Used by:
Lessons page

### 2.4 Lesson Detail

**GET** `/api/v1/lessons/{lesson_id}/`

Side effects:
- Updates last_opened_at
- Enables resume logic

Response:

```json
{
  "id": 1,
  "title": "Introduction",
  "content": "Lesson content here"
}
```

Used by:
Lesson page

### 2.5 Lesson Progress

Get progress  
**GET** `/api/v1/lessons/{lesson_id}/progress/`

Response:

```json
{
  "lesson_id": 1,
  "completed": false,
  "last_position": 0
}
```

Update progress  
**PATCH** `/api/v1/lessons/{lesson_id}/progress/`

Request body:

```json
{
  "completed": true
}
```

Response:

```json
{
  "lesson_id": 1,
  "completed": true,
  "last_position": 0
}
```

Rules:
- Only existing fields updated
- Idempotent
- Safe to retry

Used by:
“Mark as completed” UI

### 2.6 Course Progress (Dashboard Resume Logic)

**GET** `/api/v1/courses/{course_id}/progress/`

Response:

```json
{
  "course_id": 1,
  "completed": 2,
  "total": 5,
  "percentage": 40,
  "resume_lesson_id": 3
}
```

Resume priority:
- Most recently opened incomplete lesson
- First not-completed lesson
- null if course completed

Used by:
Student dashboard

### 2.7 Teacher Analytics

Course-level analytics  
**GET** `/api/v1/teacher/analytics/courses/`

Response:

```json
[
  {
    "course_id": 1,
    "title": "CS",
    "total_lessons": 10,
    "completed_lessons": 6,
    "percentage": 60
  }
]
```

Lesson-level analytics  
**GET** `/api/v1/teacher/analytics/lessons/`

Response:

```json
{
  "lesson_id": 1,
  "lesson_title": "Intro",
  "course_title": "CS",
  "completed_count": 12,
  "total_attempts": 20,
  "avg_time_spent": 140
}
```

---

## 3. Learning App (Frozen)

Base path: `/api/v1/learning/`

### 3.1 Enrollments

List enrollments  
**GET** `/api/v1/learning/enrollments/`

Response:

```json
[
  {
    "id": 1,
    "course__id": 2,
    "course__title": "Chemistry",
    "status": "enrolled",
    "enrolled_at": "2026-01-01T10:00:00Z",
    "completed_at": null
  }
]
```

Enroll into a course  
**POST** `/api/v1/learning/enroll/`

Request:

```json
{
  "course_id": 2
}
```

Response:

```json
{
  "enrollment_id": 1,
  "course_id": 2,
  "status": "enrolled"
}
```

Update enrollment  
**PATCH** `/api/v1/learning/enrollments/{enrollment_id}/`

Request:

```json
{
  "status": "completed"
}
```

### 3.2 Learning Paths

List learning paths  
**GET** `/api/v1/learning/paths/`

Learning path detail  
**GET** `/api/v1/learning/paths/{path_id}/`

Response:

```json
{
  "id": 1,
  "name": "Class 10 Science",
  "description": "",
  "courses": [
    {
      "course_id": 1,
      "title": "Physics",
      "order": 1
    }
  ]
}
```

Learning path progress  
**GET** `/api/v1/learning/paths/{path_id}/progress/`

Response:

```json
{
  "path_id": 1,
  "total_courses": 5,
  "completed_courses": 2,
  "percentage": 40
}
```

Enroll into learning path  
**POST** `/api/v1/learning/paths/{path_id}/enroll/`

Response:

```json
{
  "path_id": 1,
  "enrolled_courses": 5
}
```

---

## 4. Accounts App (Versioned, Scaffolded)

Base path: `/api/v1/accounts/`

Authentication
**POST** `/api/v1/accounts/register/`
**POST** `/api/v1/accounts/login/`
**GET**  `/api/v1/accounts/me/`

Notes:
- Currently scaffold only
- Will be wired later without breaking APIs

---

## 5. Frontend Routes (React Router)

### Student

| Route                | Component       | Purpose           |
|----------------------|-----------------|-------------------|
| `/`                  | DashboardPage   | Resume learning   |
| `/courses`           | CoursesPage     | Course list       |
| `/courses/:courseId` | LessonsPage     | Lessons           |
| `/lessons/:lessonId` | LessonPage      | Lesson content    |

### Teacher

| Route      | Component            | Purpose   |
|------------|----------------------|-----------|
| `/teacher` | TeacherDashboardPage | Analytics |

---

## 6. Frontend API Rules (MANDATORY)

- All calls go through `api.ts`
- Paths are relative
- Never hardcode base URLs

Correct:

```ts
apiGet("/courses/")
```

Incorrect:

```ts
fetch("http://localhost:8000/api/v1/...")
```

---

## 7. Stability Guarantees

- Content app frozen
- Learning app frozen
- Response shapes stable
- Auth & roles will be layered later
- No frontend refactors required later

---

## 8. Next Phase (Capstone Work)

- Accounts auth wiring
- Role-based UI gating
- UI polish
- Diagrams & final report

# End of document
