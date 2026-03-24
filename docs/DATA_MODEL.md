# GyanGrit — Data Model Reference

This document describes every model in the system, its fields, relationships,
and the design decisions behind non-obvious choices.

---

## Entity Relationship Overview

```
District
  └── Institution (school)
        └── ClassRoom (grade: 6–10)
              ├── Section (A, B, ...)
              │     └── User (STUDENT) ──────────────────────┐
              └── ClassSubject                               │
                    │                                        │
                    ▼                                        │
                Subject ◄── StudentSubject ◄────────────────┘
                    │             │
                    ▼             ▼
                  Course      Enrollment
                    │
                    ├── Lesson
                    │     └── LessonProgress (per user)
                    │           │
                    │           └──► PointEvent (gamification)
                    │
                    ├── SectionLesson (teacher-added)
                    │
                    └── Assessment
                          ├── Question
                          │     └── QuestionOption
                          └── AssessmentAttempt (per user)
                                │
                                └──► PointEvent (gamification)

User (STUDENT) ── StudentPoints (gamification total)
User (STUDENT) ── StudentBadge (gamification badges)
User (STUDENT) ── StudentStreak (gamification streak)

User (TEACHER) ── TeachingAssignment ── Subject + Section

JoinCode ──────────────────────────────► User (on registration)
StudentRegistrationRecord ─────────────► User (student self-register)
DeviceSession ──────────────────────────► User (single-session enforcement)
OTPVerification ────────────────────────► User (non-student login)
AuditLog ───────────────────────────────► User (actor)

LearningPath ── LearningPathCourse ── Course

Notification ──────────────────────────► User (recipient)
```

---

## 1. Accounts App

### User
Extends Django's `AbstractUser`.

| Field | Type | Notes |
|---|---|---|
| `username` | CharField | Login identifier |
| `role` | CharField | `STUDENT`, `TEACHER`, `PRINCIPAL`, `OFFICIAL`, `ADMIN` |
| `institution` | FK → Institution | Null for OFFICIAL and ADMIN |
| `section` | FK → Section | Only for STUDENT |
| `public_id` | CharField | Human-readable ID e.g. `S-2026-a1b2c3d4`. Auto-generated on save. |
| `district` | CharField | Denormalised string from `institution.district.name`. Always synced on save. |

**Why denormalise `district`?**
Avoids a join on every user lookup. District filtering is used heavily in analytics queries. The field is always kept in sync by `User.save()` — when `institution` changes, `district` updates automatically.

---

### JoinCode
Pre-generated invitation codes that control who can register and as what role.

| Field | Type | Notes |
|---|---|---|
| `code` | CharField | 16-char hex token. Auto-generated on save. |
| `role` | CharField | Locks the registrant's role |
| `institution` | FK → Institution | Required for TEACHER, PRINCIPAL, STUDENT |
| `section` | FK → Section | Required for STUDENT |
| `district` | FK → District | Required for OFFICIAL |
| `subject` | FK → Subject | Required for TEACHER — triggers TeachingAssignment creation |
| `is_used` | BooleanField | Set to True after first successful registration |
| `expires_at` | DateTimeField | Default: 3 days from creation |

**Why join codes instead of admin-created accounts?**
Principals can generate codes for their teachers. Teachers can generate codes for their sections. No admin bottleneck. The code encodes all registration context — role, institution, section, subject — so the frontend can show preview information before the user commits.

---

### OTPVerification
Stores pending OTP challenges for TEACHER / PRINCIPAL / OFFICIAL login.

| Field | Type | Notes |
|---|---|---|
| `user` | FK → User | One-to-many: old records are deleted before creating new |
| `otp_code` | CharField | 6-digit string |
| `attempt_count` | IntegerField | Max 5 before lockout |
| `is_expired()` | method | True if > 10 minutes since `created_at` |

---

### DeviceSession
Enforces single-device login policy.

| Field | Type | Notes |
|---|---|---|
| `user` | OneToOneField → User | One session per user |
| `device_fingerprint` | CharField | Stores Django session key |
| `last_login` | DateTimeField | Auto-updated |

`SingleActiveSessionMiddleware` compares `device_fingerprint` with the current `request.session.session_key` on every authenticated request. Mismatch → logout.

**Critical:** `device_fingerprint` is set after `request.session.save()` is called. If set before, `session_key` is `None` and enforcement silently fails.

---

### StudentRegistrationRecord
Pre-loaded student records created by teachers via roster upload.

| Field | Type | Notes |
|---|---|---|
| `student_uuid` | UUIDField | Stable identifier before account creation |
| `registration_code` | CharField | 16-char hex. Used by student to self-register. |
| `name` | CharField | Student's real name |
| `dob` | DateField | Date of birth — verified during self-registration |
| `section` | FK → Section | Pre-assigned section |
| `is_registered` | BooleanField | True after account created |
| `linked_user` | OneToOneField → User | Set after registration |

---

### AuditLog
Append-only log of sensitive operations.

| Field | Type | Notes |
|---|---|---|
| `actor` | FK → User | Who performed the action |
| `action` | CharField | e.g. `REGENERATE_STUDENT_CODE` |
| `target_model` | CharField | e.g. `StudentRegistrationRecord` |
| `target_id` | CharField | PK of affected record |

---

## 2. Academics App

### District
| Field | Type | Notes |
|---|---|---|
| `name` | CharField | Unique. All 23 Punjab districts seeded on first migrate. |

---

### Institution
| Field | Type | Notes |
|---|---|---|
| `name` | CharField | |
| `district` | FK → District | PROTECT on delete |
| `is_government` | BooleanField | Default True |

Unique constraint: `(name, district)`.

---

### ClassRoom
Represents a grade level within a school. Name is the grade number as a string: `"6"`, `"7"`, ..., `"10"`.

| Field | Type | Notes |
|---|---|---|
| `name` | CharField | Grade number e.g. `"8"` |
| `institution` | FK → Institution | |

**Why store grade as a string?**
Allows future non-numeric grades (e.g. `"LKG"`) without a migration. The signal chain uses `int(classroom.name.strip())` with a guard for non-numeric values. Analytics sort uses `Cast("name", IntegerField())` to sort `6, 7, 8, 9, 10` correctly rather than lexicographically.

---

### Section
A section within a classroom (e.g. Class 8 Section A).

| Field | Type | Notes |
|---|---|---|
| `name` | CharField | e.g. `"A"`, `"B"` |
| `classroom` | FK → ClassRoom | |

---

### Subject
Global subject catalog. Not institution-scoped.

| Field | Type | Notes |
|---|---|---|
| `name` | CharField | Unique. e.g. `"Mathematics"`, `"Physics"` |

**Why global?**
All government schools teach the same subjects. Subject scoping happens via `ClassSubject` and `StudentSubject`.

---

### ClassSubject
Junction table: which subjects are taught in which classroom.

| Field | Type | Notes |
|---|---|---|
| `classroom` | FK → ClassRoom | |
| `subject` | FK → Subject | |

Unique constraint: `(classroom, subject)`.

When a new `ClassSubject` is created, `academics/signals.py` retroactively assigns it to all existing students in that classroom.

---

### StudentSubject
Which subjects a student is enrolled in.

| Field | Type | Notes |
|---|---|---|
| `student` | FK → User | |
| `subject` | FK → Subject | |
| `classroom` | FK → ClassRoom | Required for grade-based course matching |

Unique constraint: `(student, subject)`.

When a new `StudentSubject` is created, `learning/signals.py` auto-enrolls the student in all `is_core=True` courses for that subject and grade.

---

### TeachingAssignment
Which teacher teaches which subject in which section.

| Field | Type | Notes |
|---|---|---|
| `teacher` | FK → User | `limit_choices_to={"role": "TEACHER"}` |
| `subject` | FK → Subject | |
| `section` | FK → Section | |

Unique constraint: `(teacher, subject, section)`.

`clean()` validates that teacher and section belong to the same institution.

---

## 3. Content App

### Course
A unit of curriculum. Belongs to a subject and grade level.

| Field | Type | Notes |
|---|---|---|
| `subject` | FK → Subject | |
| `grade` | IntegerField | 6–10 |
| `title` | CharField | |
| `description` | TextField | |
| `is_core` | BooleanField | Core courses are auto-enrolled via signals |

---

### Lesson
An ordered content unit within a course.

| Field | Type | Notes |
|---|---|---|
| `course` | FK → Course | |
| `title` | CharField | |
| `order` | PositiveIntegerField | Unique within course |
| `content` | TextField | Text/markdown content |
| `video_url` | URLField | Direct video fallback |
| `hls_manifest_url` | URLField | Adaptive streaming manifest (HLS) |
| `thumbnail_url` | URLField | Preview image |
| `pdf_url` | URLField | PDF attachment |
| `is_published` | BooleanField | Unpublished lessons are invisible to students |

Unique constraint: `(course, order)`.

---

### SectionLesson
Teacher-added supplementary lessons within a course.

| Field | Type | Notes |
|---|---|---|
| `course` | FK → Course | |
| `added_by` | FK → User | The TEACHER or PRINCIPAL who created it |
| `title` | CharField | |
| `content` | TextField | |
| `video_url` | URLField | Optional |
| `order` | PositiveIntegerField | Display order within the course |
| `created_at` | DateTimeField | |

**Why separate from Lesson?**
Keeps curriculum content (admin-managed) cleanly separate from teacher-added content. Teachers can add context and practice material without touching the central curriculum. The lesson list endpoint merges both and marks source as `"curriculum"` or `"section"`.

---

### LessonProgress
Per-user tracking of lesson engagement. Created automatically on first lesson open.

| Field | Type | Notes |
|---|---|---|
| `lesson` | FK → Lesson | |
| `user` | FK → User | |
| `completed` | BooleanField | Set via PATCH |
| `last_position` | IntegerField | Video position in seconds |
| `last_opened_at` | DateTimeField | Updated on every lesson open — drives resume logic |

Unique constraint: `(lesson, user)`.

When `completed` is first set to `True`, a gamification signal fires to award points and check badges.

---

## 4. Assessments App

### Assessment
A quiz attached to a course.

| Field | Type | Notes |
|---|---|---|
| `course` | FK → Course | |
| `title` | CharField | |
| `total_marks` | PositiveIntegerField | Auto-computed from questions via signal. `editable=False`. |
| `pass_marks` | PositiveIntegerField | Set by teacher |
| `is_published` | BooleanField | Unpublished assessments invisible to students |

`total_marks` is never set manually. Recomputed by `assessments/signals.py` whenever a `Question` is saved or deleted.

---

### Question
A single question within an assessment.

| Field | Type | Notes |
|---|---|---|
| `assessment` | FK → Assessment | |
| `text` | TextField | |
| `marks` | PositiveIntegerField | Weight of this question |
| `order` | PositiveIntegerField | Display order |

Unique constraint: `(assessment, order)`.

---

### QuestionOption
One of up to 4 options for a question. Exactly one must be correct.

| Field | Type | Notes |
|---|---|---|
| `question` | FK → Question | |
| `text` | CharField | |
| `is_correct` | BooleanField | `clean()` enforces only one correct option per question |

**Security:** `is_correct` is never included in the student-facing API response (`/assessments/:id/`). It is only returned in the builder endpoint (`/assessments/:id/admin/`) for ADMIN, TEACHER, and PRINCIPAL.

---

### AssessmentAttempt
One attempt by a student at an assessment.

| Field | Type | Notes |
|---|---|---|
| `user` | FK → User | |
| `assessment` | FK → Assessment | |
| `started_at` | DateTimeField | |
| `submitted_at` | DateTimeField | Null until submitted |
| `selected_options` | JSONField | `{question_id: option_id}` e.g. `{"1": 3, "2": 7}` |
| `score` | PositiveIntegerField | Computed on submit |
| `passed` | BooleanField | `score >= assessment.pass_marks` |

**Scoring design:** `calculate_score_and_pass()` fetches all selected options matching submitted IDs in a single query, filters for `is_correct=True`, and sums their question marks. No N+1.

When `submitted_at` is first set, a gamification signal fires to award points.

---

## 5. Learning App

### Enrollment
A student's enrollment in a course.

| Field | Type | Notes |
|---|---|---|
| `user` | FK → User | |
| `course` | FK → Course | |
| `status` | CharField | `enrolled`, `completed`, `dropped` |
| `enrolled_at` | DateTimeField | |
| `completed_at` | DateTimeField | Set by `mark_completed()` |

Unique constraint: `(user, course)`.

Created automatically via `learning/signals.py` when a `StudentSubject` is created.

---

### LearningPath
A named, ordered collection of courses.

| Field | Type | Notes |
|---|---|---|
| `name` | CharField | |
| `description` | TextField | |

---

### LearningPathCourse
Ordered course within a learning path.

| Field | Type | Notes |
|---|---|---|
| `learning_path` | FK → LearningPath | |
| `course` | FK → Course | |
| `order` | PositiveIntegerField | |

Unique constraints: `(learning_path, course)` and `(learning_path, order)`.

---

## 6. Gamification App

### PointEvent
Immutable ledger of every point award. Never updated — only inserted.

| Field | Type | Notes |
|---|---|---|
| `user` | FK → User | |
| `points` | PositiveSmallIntegerField | Amount awarded |
| `reason` | CharField | Choice: `lesson_complete`, `assessment_attempt`, `assessment_pass`, `perfect_score`, `streak_3`, `streak_7` |
| `lesson_id` | IntegerField | Nullable — context for lesson events |
| `assessment_id` | IntegerField | Nullable — context for assessment events |
| `created_at` | DateTimeField | Indexed |

**Why a ledger instead of just a counter?**
The ledger is also the deduplication guard. Before awarding, signals check if a `PointEvent` already exists for the same `(user, reason, lesson_id/assessment_id)`. Re-completing a lesson or re-running a signal never causes double-awarding.

---

### StudentPoints
Denormalized running total — updated atomically by signals.

| Field | Type | Notes |
|---|---|---|
| `user` | OneToOneField → User | |
| `total_points` | PositiveIntegerField | Indexed for leaderboard ordering |
| `updated_at` | DateTimeField | Auto-updated |

**Why denormalize?**
Summing `PointEvent.points` per user on every leaderboard query would not scale across hundreds of students. The cached total solves this. Updated with `select_for_update` to prevent race conditions.

---

### StudentBadge
A badge earned by a student. Created once, never updated.

| Field | Type | Notes |
|---|---|---|
| `user` | FK → User | |
| `badge_code` | CharField | Choice: `first_lesson`, `lesson_10`, `lesson_50`, `first_pass`, `perfect_score`, `streak_3`, `streak_7`, `points_100`, `points_500` |
| `earned_at` | DateTimeField | |

Unique constraint: `(user, badge_code)`. `get_or_create` used on award — no duplicates possible.

---

### StudentStreak
Tracks the student's daily activity streak.

| Field | Type | Notes |
|---|---|---|
| `user` | OneToOneField → User | |
| `current_streak` | PositiveSmallIntegerField | Resets to 1 on gap day |
| `longest_streak` | PositiveSmallIntegerField | Never decreases |
| `last_activity_date` | DateField | Date (not datetime) to avoid timezone double-counting |

**Streak logic:**
- If `last_activity_date == today` → no change (already counted today)
- If `last_activity_date == yesterday` → `current_streak += 1`
- Otherwise → `current_streak = 1` (gap resets streak)
- `longest_streak = max(longest_streak, current_streak)` after every update

---

## 7. Notifications App

### Notification

| Field | Type | Notes |
|---|---|---|
| `recipient` | FK → User | |
| `message` | TextField | |
| `notification_type` | CharField | e.g. `announcement`, `assessment_published`, `system` |
| `is_read` | BooleanField | Default False |
| `created_at` | DateTimeField | Indexed |

---

## 8. Key Constraints Summary

| Constraint | Where Enforced |
|---|---|
| One session per user | `DeviceSession` OneToOneField + middleware |
| One correct option per question | `QuestionOption.clean()` |
| Teacher must be in same institution as section | `TeachingAssignment.clean()` |
| Section must match institution on User | `User.clean()` |
| JoinCode role requirements (institution, section, etc.) | `JoinCode.clean()` |
| Student cannot re-enroll in same course | `Enrollment` unique constraint |
| Lesson order unique within course | `Lesson` unique constraint |
| Assessment attempt cannot be submitted twice | `AssessmentAttempt.submit()` guard |
| Gamification point not awarded twice per event | `PointEvent` ledger check before every award |
| Badge not awarded twice per student | `StudentBadge` unique constraint + `get_or_create` |
| Streak not double-counted in same day | `StudentStreak.last_activity_date` date comparison |
