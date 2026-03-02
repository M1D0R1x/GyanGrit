from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.academics.models import StudentSubject
from apps.content.models import Course
from .models import Enrollment


@receiver(post_save, sender=StudentSubject)
def auto_enroll_core_courses(sender, instance, created, **kwargs):
    """Auto-enroll student in all core courses of their class/subject when StudentSubject is created."""
    if not created:
        return

    # Safe grade handling (classroom.name is string like "6")
    try:
        grade = int(instance.classroom.name)
    except (ValueError, TypeError, AttributeError):
        return  # classroom name not numeric → skip

    courses = Course.objects.filter(
        subject=instance.subject,
        grade=grade,
        is_core=True,
    )

    for course in courses:
        Enrollment.objects.get_or_create(
            user=instance.student,
            course=course,
            defaults={"status": "enrolled"},
        )