"""
academics/signals.py

Responsibilities:
- Auto-assign StudentSubject records when a new student is created.
- Auto-assign StudentSubject when a new ClassSubject is added.

Enrollment creation is NOT done here — it is handled by
learning/signals.py via the StudentSubject post_save signal.
This keeps each app responsible for its own domain:
  academics → subject assignment
  learning  → course enrollment
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.models import User
from .models import ClassSubject, StudentSubject

logger = logging.getLogger(__name__)


@receiver(post_save, sender=User)
def auto_assign_subjects(sender, instance, created, **kwargs):
    """
    On new student creation:
    Assign StudentSubject records for each ClassSubject in their classroom.

    Enrollment in courses is triggered automatically downstream via
    learning/signals.py when each StudentSubject is created.

    Guards:
    - Only fires for new STUDENT accounts.
    - Skips if section or classroom is not set.
    - Handles non-numeric classroom names gracefully.
    """
    if instance.role != "STUDENT" or not created:
        return

    if not instance.section or not instance.section.classroom:
        logger.warning(
            "Student id=%s created without a valid section/classroom — "
            "skipping subject auto-assignment.",
            instance.id,
        )
        return

    classroom = instance.section.classroom

    # Validate classroom name is a parseable grade
    try:
        int(classroom.name.strip())
    except (ValueError, AttributeError):
        logger.error(
            "Cannot auto-assign subjects for student id=%s: "
            "classroom name '%s' is not a valid integer grade.",
            instance.id,
            classroom.name,
        )
        return

    class_subjects = ClassSubject.objects.filter(classroom=classroom)
    assigned_count = 0

    for cs in class_subjects:
        _, created_ss = StudentSubject.objects.get_or_create(
            student=instance,
            subject=cs.subject,
            classroom=classroom,
        )
        if created_ss:
            assigned_count += 1
            # Each new StudentSubject triggers learning/signals.py
            # auto_enroll_core_courses automatically via post_save.

    logger.info(
        "Student id=%s (%s): assigned %d subjects. "
        "Enrollment triggered per subject via learning signals.",
        instance.id,
        instance.username,
        assigned_count,
    )


@receiver(post_save, sender=ClassSubject)
def auto_assign_students_for_new_class_subject(sender, instance, **kwargs):
    """
    When a new ClassSubject is added to a classroom,
    retroactively assign it to all existing students in that classroom.

    Each new StudentSubject created here will also trigger
    learning/signals.py to enroll those students in the new subject's
    core courses.
    """
    classroom = instance.classroom
    students = User.objects.filter(
        role="STUDENT",
        section__classroom=classroom,
    )

    assigned = 0
    for student in students:
        _, created = StudentSubject.objects.get_or_create(
            student=student,
            subject=instance.subject,
            classroom=classroom,
        )
        if created:
            assigned += 1

    if assigned:
        logger.info(
            "ClassSubject added: assigned subject '%s' to %d existing "
            "students in classroom '%s'. Enrollment triggered via "
            "learning signals.",
            instance.subject.name,
            assigned,
            classroom.name,
        )