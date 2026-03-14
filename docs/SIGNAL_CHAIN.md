# GyanGrit — Signal Chain Documentation

This document describes the Django signal architecture that drives
automatic subject assignment and course enrollment.

---

## Why Signals?

When a new student registers, three things must happen automatically:
1. Assign subjects based on their classroom's curriculum
2. Enroll them in core courses for each subject
3. Keep this working correctly when new subjects are added to existing classrooms

Using signals keeps each app responsible for its own domain.
No cross-app enrollment logic lives in `views.py` or `accounts`.

---

## Signal Registry

| Signal | Sender | Handler | File |
|---|---|---|---|
| `post_save` | `User` | `auto_assign_subjects` | `academics/signals.py` |
| `post_save` | `ClassSubject` | `auto_assign_students_for_new_class_subject` | `academics/signals.py` |
| `post_save` | `StudentSubject` | `auto_enroll_core_courses` | `learning/signals.py` |
| `post_save` | `Question` | `update_total_marks_on_save` | `assessments/signals.py` |
| `post_delete` | `Question` | `update_total_marks_on_delete` | `assessments/signals.py` |

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
```

---

## Guards and Safety

Every signal handler has guards against:

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

---

## Logging

All signal handlers log their results using Python's `logging` module:

```
INFO: Student id=5 (student1): assigned 12 subjects. Enrollment triggered per subject via learning signals.
INFO: auto_enroll_core_courses: enrolled student id=5 in 3 core courses for subject 'Mathematics' grade 8.
INFO: ClassSubject added: assigned subject 'Physics' to 28 existing students in classroom '9'.
INFO: Assessment 'Chapter 1 Quiz' total_marks updated to 20.
```

No `print()` statements exist in signal handlers.

---

## What Signals Do NOT Handle

- Teacher `TeachingAssignment` creation — handled in `accounts/services.py:assign_teacher_to_classes()`, called from both `views.py` and `admin.py`
- Join code validation — handled in `accounts/views.py`
- OTP creation — handled in `accounts/views.py`
- Session creation — handled in `accounts/views.py:_create_device_session()`
