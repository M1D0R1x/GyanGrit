"""
learning/signals.py

Single source of truth for course enrollment automation.

When a StudentSubject record is created (either on new student
registration via academics/signals.py, or when a new ClassSubject
is added to a classroom), this signal auto-enrolls the student
in all core courses matching their subject and grade.

This keeps enrollment logic in the learning app where it belongs,
and academics/signals.py only handles StudentSubject creation.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.academics.models import StudentSubject
from apps.content.models import Course
from .models import Enrollment

logger = logging.getLogger(__name__)


@receiver(post_save, sender=StudentSubject)
def auto_enroll_core_courses(sender, instance, created, **kwargs):
    """
    Auto-enroll student in all core courses for their subject+grade
    when a StudentSubject record is created.

    Fires when:
    1. A new student registers (academics signal creates StudentSubject,
       which triggers this signal for each one).
    2. A new ClassSubject is added to a classroom (academics signal
       creates StudentSubject for existing students in that class).

    Guards:
    - Only fires on creation, not updates.
    - Skips if classroom name is not a valid integer grade.
    - Uses get_or_create to safely handle re-entrant calls.
    """
    if not created:
        return

    try:
        grade = int(instance.classroom.name.strip())
    except (ValueError, TypeError, AttributeError):
        logger.warning(
            "auto_enroll_core_courses: cannot parse grade from classroom "
            "name '%s' for student id=%s — skipping enrollment.",
            getattr(instance.classroom, "name", None),
            instance.student_id,
        )
        return

    courses = Course.objects.filter(
        subject=instance.subject,
        grade=grade,
        is_core=True,
    )

    enrolled_count = 0
    for course in courses:
        _, created_enrollment = Enrollment.objects.get_or_create(
            user=instance.student,
            course=course,
            defaults={"status": "enrolled"},
        )
        if created_enrollment:
            enrolled_count += 1

    if enrolled_count:
        logger.info(
            "auto_enroll_core_courses: enrolled student id=%s in %d "
            "core courses for subject '%s' grade %d.",
            instance.student_id,
            enrolled_count,
            instance.subject.name,
            grade,
        )