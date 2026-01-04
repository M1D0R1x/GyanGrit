# GyanGrit — Learning Loop (Alpha)

This document defines the **core learning loop** of the GyanGrit platform.
Everything else in the system builds on top of this loop.

---

## 1. Entry Point — Student Dashboard

**Route:** `/`

Purpose:
- Acts as the decision hub for learners
- Shows all available courses
- Displays progress per course
- Presents exactly one next action per course

Possible states per course:
- ▶ Resume (if an incomplete lesson exists)
- Start course (if untouched)
- ✅ Completed (if all lessons done)

No content is consumed here.
Only intent is decided.

---

## 2. Course Scope — Lessons Page

**Route:** `/courses/:courseId`

Purpose:
- Show the structure of a course before consumption
- Display ordered lessons
- Indicate completion status per lesson

Displayed per lesson:
- Order number
- Title
- Completion indicator (✅)

Optional (alpha only):
- Manual “Mark complete” action for testing

This page provides orientation, not learning.

---

## 3. Learning Action — Lesson Page

**Route:** `/lessons/:lessonId`

Purpose:
- Deliver lesson content
- Allow explicit completion
- Update resume metadata

On lesson open:
- Backend updates `last_opened_at`
- Enables resume logic

On lesson completion:
- `completed = true` stored in LessonProgress

This is the only page where learning happens.

---

## 4. Resume Logic (Continuity)

Resume selection logic:
1. Most recently opened incomplete lesson
2. Else, first uncompleted lesson by order
3. Else, course marked completed

This logic is computed server-side and returned via:
`GET /api/v1/courses/:courseId/progress/`

Frontend never guesses resume state.

---

## 5. Loop Closure

After lesson completion:
- User returns to dashboard or lessons
- Progress reflects immediately
- Loop restarts

This creates a closed, repeatable learning cycle.

---

## Design Constraints (Intentional)

- No authentication yet (single anonymous learner)
- No time tracking accuracy guarantees
- No auto-advance between lessons
- No background completion logic

These are deferred by design to preserve loop stability.

---

## Why This Matters

This loop:
- Separates intent from action
- Preserves continuity
- Enables analytics
- Scales to real users without redesign

It is the foundation of GyanGrit as a SaaS platform.
