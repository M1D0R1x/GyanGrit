import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.models import User
from apps.content.models import Course
from apps.learning.models import Enrollment
from .models import ClassSubject, StudentSubject

logger = logging.getLogger(__name__)


@receiver(post_save, sender=User)
def auto_assign_subjects_and_courses(sender, instance, created, **kwargs):
    """
    On new student creation:
    1. Assign StudentSubject records for each ClassSubject in their classroom.
    2. Enroll in all courses matching their grade.

    Guards:
    - Only fires for new STUDENT accounts.
    - Skips if section or classroom is not set.
    - Handles non-numeric classroom names gracefully.
    """
    if instance.role != "STUDENT" or not created:
        return

    if not instance.section or not instance.section.classroom:
        logger.warning(
            "Student %s created without a valid section/classroom — "
            "skipping subject and course auto-assignment.",
            instance.id,
        )
        return

    classroom = instance.section.classroom

    try:
        student_grade = int(classroom.name.strip())
    except (ValueError, AttributeError):
        logger.error(
            "Cannot auto-assign courses for student %s: "
            "classroom name '%s' is not a valid integer grade.",
            instance.id,
            classroom.name,
        )
        return

    # 1. Assign subjects
    class_subjects = ClassSubject.objects.filter(classroom=classroom)
    assigned_subjects = 0
    for cs in class_subjects:
        _, created_ss = StudentSubject.objects.get_or_create(
            student=instance,
            subject=cs.subject,
            classroom=classroom,
        )
        if created_ss:
            assigned_subjects += 1

    # 2. Enroll in matching grade courses
    matching_courses = Course.objects.filter(grade=student_grade)
    enrolled_courses = 0
    for course in matching_courses:
        _, created_enrollment = Enrollment.objects.get_or_create(
            user=instance,
            course=course,
            defaults={"status": "enrolled"},
        )
        if created_enrollment:
            enrolled_courses += 1

    logger.info(
        "Student %s (id=%s): assigned %d subjects, enrolled in %d courses.",
        instance.username,
        instance.id,
        assigned_subjects,
        enrolled_courses,
    )


@receiver(post_save, sender=ClassSubject)
def auto_assign_students_for_new_class_subject(sender, instance, **kwargs):
    """
    When a new ClassSubject is added to a classroom,
    retroactively assign it to all existing students in that classroom.
    """
    classroom = instance.classroom
    students = User.objects.filter(role="STUDENT", section__classroom=classroom)

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
            "ClassSubject added: assigned subject '%s' to %d existing students in classroom '%s'.",
            instance.subject.name,
            assigned,
            classroom.name,
        )