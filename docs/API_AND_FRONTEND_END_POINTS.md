# GyanGrit – Backend & Frontend Endpoint Documentation

> **Status:** Content app frozen
>
> This document describes all **backend API endpoints** and their **frontend usage** as implemented.
> It reflects the current stable architecture and should be treated as the source of truth.

---

## 1. Backend API Endpoints (Django – `/api/v1/`)

All backend APIs are **versioned** under:

```
/api/v1/
```

This allows future iterations (`/v2`, `/v3`) without breaking the frontend.

---

### 1.1 Health Check

**Endpoint**

```
GET /api/v1/health/
```

**Purpose**

* Verify backend availability
* Used for debugging / monitoring

**Response**

```json
{
  "status": "ok",
  "service": "gyangrit-backend"
}
```

---

### 1.2 Courses

#### List all courses

**Endpoint**

```
GET /api/v1/courses/
```

**Response**

```json
[
  {
    "id": 1,
    "title": "CS",
    "description": "Computer Science basics"
  }
]
```

**Frontend usage**

* Courses page
* Dashboard course listing

---

### 1.3 Course Lessons

#### Get lessons for a course (with completion state)

**Endpoint**

```
GET /api/v1/courses/{course_id}/lessons/
```

**Response**

```json
[
  {
    "id": 1,
    "title": "Introduction",
    "order": 1,
    "completed": false
  }
]
```

**Notes**

* `completed` is derived from `LessonProgress`
* No frontend-side computation required

**Frontend usage**

* Lessons page

---

### 1.4 Lesson Detail

#### Get lesson content

**Endpoint**

```
GET /api/v1/lessons/{lesson_id}/
```

**Side effects**

* Updates `last_opened_at` in `LessonProgress`
* Enables resume logic

**Response**

```json
{
  "id": 1,
  "title": "Introduction",
  "content": "Lesson content here"
}
```

**Frontend usage**

* Lesson page

---

### 1.5 Lesson Progress

#### Get lesson progress

**Endpoint**

```
GET /api/v1/lessons/{lesson_id}/progress/
```

**Response**

```json
{
  "lesson_id": 1,
  "completed": false,
  "last_position": 0
}
```

---

#### Update lesson progress

**Endpoint**

```
PATCH /api/v1/lessons/{lesson_id}/progress/
```

**Request body**

```json
{
  "completed": true
}
```

**Response**

```json
{
  "lesson_id": 1,
  "completed": true,
  "last_position": 0
}
```

**Rules**

* Only fields that exist are updated
* Safe to call multiple times

**Frontend usage**

* Mark lesson as completed

---

### 1.6 Course Progress (Dashboard Resume Logic)

#### Get aggregated course progress

**Endpoint**

```
GET /api/v1/courses/{course_id}/progress/
```

**Response**

```json
{
  "course_id": 1,
  "completed": 2,
  "total": 5,
  "percentage": 40,
  "resume_lesson_id": 3
}
```

**Resume logic priority**

1. Most recently opened incomplete lesson
2. First not-yet-completed lesson
3. `null` if course completed

**Frontend usage**

* Student dashboard

---

### 1.7 Teacher Analytics

#### Course-level analytics

**Endpoint**

```
GET /api/v1/teacher/analytics/courses/
```

**Response**

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

---

#### Lesson-level analytics

**Endpoint**

```
GET /api/v1/teacher/analytics/lessons/
```

**Response**

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

## 2. Frontend Endpoints (React Router)

All frontend routes are client-side routes handled by React Router.

---

### 2.1 Student Routes

| Route                | Component       | Purpose                       |
| -------------------- | --------------- | ----------------------------- |
| `/`                  | `DashboardPage` | Student dashboard with resume |
| `/courses`           | `CoursesPage`   | List all courses              |
| `/courses/:courseId` | `LessonsPage`   | Lessons in a course           |
| `/lessons/:lessonId` | `LessonPage`    | Lesson content                |

---

### 2.2 Teacher Routes

| Route      | Component              | Purpose           |
| ---------- | ---------------------- | ----------------- |
| `/teacher` | `TeacherDashboardPage` | Teacher analytics |

---

## 3. Frontend API Access Rules (IMPORTANT)

**All API calls MUST:**

* Go through `api.ts`
* Be relative to `/api/v1`
* Never hardcode base URLs

Example:

```ts
apiGet("/courses/")
```

**Never do:**

```ts
fetch("http://localhost:8000/api/v1/...")
```

---

## 4. Stability Guarantees

* Content app APIs are **frozen**
* Response shapes will not change
* User scoping will be added internally later
* Frontend does not need refactors when auth is added

---

## 5. Next Apps (Not Implemented Yet)

* `accounts` – user profiles & roles
* `learning` – enrollments, learning paths

These will **consume** the content APIs, not modify them.

---

**End of document**
