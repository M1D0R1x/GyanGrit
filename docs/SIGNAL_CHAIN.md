# GyanGrit — Signal Chain Documentation

This document describes the Django signal architecture that drives
automatic subject assignment, course enrollment, assessment scoring,
and gamification events.

---

## Why Signals?

Using signals keeps each app responsible for its own domain:
- `academics` owns subject assignment
- `learning` owns course enrollment
- `assessments` owns score calculation
- `gamification` owns points and badges

No cross-app enrollment or gamification logic lives in `views.py`.

---

## Signal Registry

| Signal | Sender | Handler | File |
|---|---|---|---|
| `post_save` | `User` | `auto_assign_subjects` | `academics/signals.py` |
| `post_save` | `ClassSubject` | `auto_assign_students_for_new_class_subject` | `academics/signals.py` |
| `post_save` | `StudentSubject` | `auto_enroll_core_courses` | `learning/signals.py` |
| `post_save` | `Question` | `update_total_marks_on_save` | `assessments/signals.py` |
| `post_delete` | `Question` | `update_total_marks_on_delete` | `assessments/signals.py` |
| `post_save` | `LessonProgress` | `on_lesson_progress_save` | `gamification/signals.py` |
| `post_save` | `AssessmentAttempt` | `on_assessment_attempt_save` | `gamification/signals.py` |

---

## Chain 1: New Student Registration

Triggered when: A new `User` with `role="STUDENT"` is created.

```
User.post_save (created=True, role="STUDENT")
│
└─► academics/signals.py: auto_assign_subjects()
    │
    │  Reads: ClassSubject records for student's classroom
    │  Creates: StudentSubject records (one per subject)
    │  Guard: skips if section/classroom missing or grade not numeric
    │
    └─► [For each new StudentSubject created]
        │
        └─► learning/signals.py: auto_enroll_core_courses()
            │
            │  Reads: Course records where subject matches AND grade matches
            │         AND is_core=True
            │  Creates: Enrollment records with status="enrolled"
            │  Guard: only fires if StudentSubject was newly created (created=True)
            │
            └─► Student is now enrolled and ready to learn on first login
```

**Result after chain completes:**
- `N` StudentSubject records (where N = number of subjects in classroom)
- `M` Enrollment records (where M = number of is_core courses matching grade)
- Student dashboard will show courses immediately on first login

---

## Chain 2: New Subject Added to Classroom

Triggered when: An admin adds a new `ClassSubject` to an existing classroom.

```
ClassSubject.post_save
│
└─► academics/signals.py: auto_assign_students_for_new_class_subject()
    │
    │  Reads: All existing STUDENT users in that classroom
    │  Creates: StudentSubject for each student that doesn't already have it
    │
    └─► [For each new StudentSubject created]
        │
        └─► learning/signals.py: auto_enroll_core_courses()
            │
            └─► Existing students enrolled in new subject's courses
```

**Result:** All existing students in the classroom are retroactively enrolled
in the new subject's core courses. No manual action required.

---

## Chain 3: Assessment Total Marks

Triggered when: A `Question` is saved or deleted.

```
Question.post_save / Question.post_delete
│
└─► assessments/signals.py: update_total_marks_on_save/delete()
    │
    └─► assessment.recalculate_total_marks()
        │
        └─► Sums all Question.marks for this assessment
            Updates Assessment.total_marks via queryset update()
            (not save() to avoid triggering full_clean)
```

**Result:** `Assessment.total_marks` is always consistent with the actual
sum of question marks. Never needs manual update.

---

## Chain 4: Lesson Completion → Gamification

Triggered when: A `LessonProgress` record is saved with `completed=True`.

```
LessonProgress.post_save
│
│  Guard 1: instance.completed must be True
│  Guard 2: PointEvent must not already exist for
│           (user, reason=lesson_complete, lesson_id)
│  Guard 3: user.role must be "STUDENT"
│
└─► gamification/signals.py: on_lesson_progress_save()
    │
    │  Within transaction.atomic():
    │
    ├─► _award_points(user, "lesson_complete", lesson_id=...)
    │       Creates PointEvent (+10 pts)
    │       Updates StudentPoints.total_points atomically (select_for_update)
    │
    ├─► _update_streak(user)
    │       Gets/creates StudentStreak (select_for_update)
    │       If last_activity_date == today → no change
    │       If last_activity_date == yesterday → streak += 1
    │       Else → streak = 1 (reset)
    │       Updates longest_streak = max(longest, current)
    │       Returns current_streak value
    │
    ├─► _check_streak_bonuses(user, current_streak)
    │       If current_streak == 3 → +15 pts + badge "streak_3"
    │       If current_streak == 7 → +50 pts + badge "streak_7"
    │
    ├─► _check_lesson_badges(user)
    │       Counts LessonProgress.filter(user, completed=True)
    │       completed >= 1  → badge "first_lesson"
    │       completed >= 10 → badge "lesson_10"
    │       completed >= 50 → badge "lesson_50"
    │
    └─► _check_points_badges(user)
            total_points >= 100 → badge "points_100"
            total_points >= 500 → badge "points_500"
```

**Safety:** Entire handler is wrapped in `try/except Exception`. A gamification failure
**never blocks lesson completion or prevents the PATCH from returning a 200 response.**

---

## Chain 5: Assessment Submission → Gamification

Triggered when: An `AssessmentAttempt` is saved with `submitted_at` newly set.

```
AssessmentAttempt.post_save
│
│  Guard 1: instance.submitted_at must not be None
│  Guard 2: PointEvent must not already exist for
│           (user, reason=assessment_attempt, assessment_id=attempt.id)
│  Guard 3: user.role must be "STUDENT"
│
└─► gamification/signals.py: on_assessment_attempt_save()
    │
    │  Within transaction.atomic():
    │
    ├─► _award_points(user, "assessment_attempt", assessment_id=attempt.id)
    │       Always fires: +5 pts for attempting
    │
    ├─► if instance.passed:
    │       _award_points(user, "assessment_pass", assessment_id=attempt.id)
    │           +25 pts
    │
    ├─► if instance.score == instance.assessment.total_marks (perfect score):
    │       _award_points(user, "perfect_score", assessment_id=attempt.id)
    │           +50 pts bonus
    │       _award_badge(user, "perfect_score")
    │
    ├─► _update_streak(user)   [same logic as Chain 4]
    │
    ├─► _check_streak_bonuses(user, current_streak)
    │
    ├─► _check_assessment_badges(user)
    │       If any AssessmentAttempt(user, passed=True) exists → badge "first_pass"
    │
    └─► _check_points_badges(user)
```

**Safety:** Entire handler is wrapped in `try/except Exception`. A gamification failure
**never blocks assessment submission or changes the submit response.**

---

## Signal Registration

Signals are registered in each app's `AppConfig.ready()`:

```python
# academics/apps.py
def ready(self):
    from . import signals  # noqa

# learning/apps.py
def ready(self):
    import apps.learning.signals  # noqa

# assessments/apps.py
def ready(self):
    import apps.assessments.signals  # noqa

# gamification/apps.py
def ready(self):
    import apps.gamification.signals  # noqa
```

---

## Guards and Safety

### Enrollment chain guards

**Non-numeric classroom names:**
```python
try:
    grade = int(classroom.name.strip())
except (ValueError, AttributeError):
    logger.error("Cannot parse grade from classroom name '%s'", classroom.name)
    return
```

**Missing section/classroom:**
```python
if not instance.section or not instance.section.classroom:
    logger.warning("Student created without section/classroom")
    return
```

**Duplicate prevention:**
All creation calls use `get_or_create`. Re-running signals never creates duplicates.

**Update suppression:**
```python
if not created:
    return  # Only fire on creation, not updates
```

### Gamification chain guards

**Double-award prevention (PointEvent ledger check):**
```python
if PointEvent.objects.filter(
    user=user,
    reason=reason,
    lesson_id=lesson_id,   # or assessment_id for assessment events
).exists():
    return  # Already awarded — skip silently
```

**Non-student guard:**
```python
if user.role != "STUDENT":
    return
```

**Non-blocking wrapper:**
```python
try:
    # all gamification logic
except Exception:
    logger.exception("Gamification signal failed for user=%s", user.id)
    # Never re-raises — core flow continues normally
```

**Atomic updates:**
```python
with transaction.atomic():
    summary, _ = StudentPoints.objects.select_for_update().get_or_create(user=user)
    summary.total_points += points
    summary.save(update_fields=["total_points", "updated_at"])
```

---

## Logging

All signal handlers log their results using Python's `logging` module:

```
INFO: Student id=5 (student1): assigned 12 subjects.
INFO: auto_enroll_core_courses: enrolled student id=5 in 3 core courses for subject 'Mathematics' grade 8.
INFO: ClassSubject added: assigned subject 'Physics' to 28 existing students in classroom '9'.
INFO: Assessment 'Chapter 1 Quiz' total_marks updated to 20.
INFO: Gamification: user=5 +10 pts reason=lesson_complete total=45
INFO: Gamification: user=5 earned badge=first_lesson
INFO: Gamification: user=5 +25 pts reason=assessment_pass total=80
```

No `print()` statements exist anywhere in signal handlers.

---

## What Signals Do NOT Handle

- Teacher `TeachingAssignment` creation — handled in `accounts/services.py:assign_teacher_to_classes()`, called from both `views.py` and `admin.py`
- Join code validation — handled in `accounts/views.py`
- OTP creation — handled in `accounts/views.py`
- Session creation — handled in `accounts/views.py:_create_device_session()`
- Notification delivery — handled explicitly in views when teachers/system create notifications
