# GyanGrit — Learning Loop

This document defines the complete learning lifecycle in GyanGrit.
It covers both the student-facing content loop and the assessment loop
that sits on top of it.

---

## Overview

The learning loop is a closed, repeatable cycle:

```
Dashboard → Course → Lesson → Complete → Dashboard
                    ↓
             Assessment Loop
                    ↓
         Start → Answer → Submit → Result → History
```

---

## Part 1: Content Loop

### 1.1 Entry Point — Student Dashboard

**Route:** `/dashboard`

The dashboard is the decision hub. It shows all subjects the student is enrolled in, with per-subject progress derived from lesson completions.

Each subject card shows:
- Subject name
- Lessons completed / total lessons
- Progress bar and percentage

The dashboard does not consume content. It surfaces state and navigates to courses.

**API:** `GET /api/v1/academics/subjects/`

---

### 1.2 Course Scope — Courses Page

**Route:** `/courses`

Lists all courses available to the student, scoped by their subject enrollments. Each card shows grade, subject, and description.

**API:** `GET /api/v1/courses/`

---

### 1.3 Lesson Structure — Lessons Page

**Route:** `/courses/:courseId`

Shows the ordered list of lessons in a course. Each lesson shows its completion state. A progress bar at the top shows overall course completion.

Clicking a lesson navigates to the lesson page.
The "Mark complete" button on each item updates progress without opening the lesson.

**API:** `GET /api/v1/courses/{course_id}/lessons/`

---

### 1.4 Learning Action — Lesson Page

**Route:** `/lessons/:lessonId`

This is the only page where learning content is consumed.

On open:
- Backend records `last_opened_at` in `LessonProgress`
- `completed` and `last_position` are returned inline — no second API call needed

On completion:
- Student clicks "Mark as complete"
- `PATCH /api/v1/lessons/{lesson_id}/progress/` with `{ "completed": true }`
- UI updates immediately

Content types supported:
- Text/markdown (`content` field)
- Video URL (`video_url` field — fallback)
- HLS adaptive streaming (`hls_manifest_url` — for bandwidth-adaptive playback)

---

### 1.5 Resume Logic

Resume selection is computed server-side. The frontend never guesses.

Priority order:
1. Most recently opened incomplete lesson (`last_opened_at` descending)
2. First incomplete lesson by order
3. `null` — course is fully complete

**API:** `GET /api/v1/courses/{course_id}/progress/`

---

### 1.6 Loop Closure

After a lesson is completed, the student returns to the lessons page or dashboard. Progress reflects immediately. The loop restarts.

---

## Part 2: Assessment Loop

Assessments sit on top of the content loop. They are attached to courses and available after lesson content.

### 2.1 Assessment Entry

**Route:** `/courses/:courseId/assessments`

Lists all published assessments for a course. Each shows total marks and pass marks.

**API:** `GET /api/v1/assessments/course/{course_id}/`

---

### 2.2 Taking an Assessment

**Route:** `/assessments/:assessmentId`

On mount, two calls happen in parallel:
1. `getAssessment()` — fetches questions and options (without correct answers)
2. `startAssessment()` — creates an attempt or returns existing active one

The student selects one option per question via radio buttons. A sticky progress bar shows how many questions have been answered.

On submit:
- Validation: all questions must be answered
- `POST /api/v1/assessments/{assessment_id}/submit/` with `{ attempt_id, selected_options }`
- `selected_options` is a map of question_id → option_id
- Navigates to result page

---

### 2.3 Result Page

**Route:** `/assessment-result`

Receives result data via React Router state (no extra API call).

Shows:
- Score as a percentage
- Raw score vs pass mark vs total marks
- Pass/Fail status

---

### 2.4 Attempt History

**Route:** `/assessments/:assessmentId/history`

Shows all past submitted attempts for an assessment, ordered newest first.

**API:** `GET /api/v1/assessments/{assessment_id}/my-attempts/`

---

## Part 3: Learning Paths

Learning paths are curated sequences of courses. They sit above the content loop as a navigation layer.

### 3.1 Path Listing

**Route:** `/learning`

Shows all available learning paths with:
- Name and description
- Progress bar (completed courses / total courses)

**API:** `GET /api/v1/learning/paths/` + `GET /api/v1/learning/paths/{id}/progress/`

---

### 3.2 Path Detail

**Route:** `/learning/:pathId`

Shows ordered courses in a path. Each course links to its lessons page.

**API:** `GET /api/v1/learning/paths/{id}/` + `/progress/`

---

## Part 4: Auto-Enrollment

Students do not manually enroll in courses. Enrollment is automatic.

When a new student account is created:
1. `academics/signals.py` fires on `User` post_save
2. Creates `StudentSubject` records for all subjects in their classroom
3. Each `StudentSubject` creation triggers `learning/signals.py`
4. `learning/signals.py` enrolls the student in all `is_core=True` courses matching their subject and grade

This means by the time a student logs in for the first time, their courses, subjects, and progress tracking are already set up.

See `docs/SIGNAL_CHAIN.md` for the full signal architecture.

---

## Design Principles

- **Server-side state** — resume logic, progress, and completion are never computed on the frontend
- **Derived progress** — course progress is computed at request time, never stored as a separate field
- **Idempotent updates** — PATCH progress is safe to call multiple times
- **Scoped data** — all endpoints return only data the requesting role is permitted to see
- **Single session** — the middleware enforces one active session per user; concurrent sessions are terminated
