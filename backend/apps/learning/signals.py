from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.academics.models import StudentSubject
from apps.content.models import Course
from .models import Enrollment


@receiver(post_save, sender=StudentSubject)
def auto_enroll_core_courses(sender, instance, created, **kwargs):

    if not created:
        return

    courses = Course.objects.filter(
        subject=instance.subject,
        grade=int(instance.classroom.name),
        is_core=True,
    )

    for course in courses:
        Enrollment.objects.get_or_create(
            user=instance.student,
            course=course,
        )