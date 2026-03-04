from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.accounts.models import User
from apps.content.models import Course
from apps.learning.models import Enrollment
from .models import ClassSubject, StudentSubject


@receiver(post_save, sender=User)
def auto_assign_subjects_and_courses(sender, instance, created, **kwargs):
    """Auto-assign subjects + enroll in all published courses for new students"""
    if instance.role != "STUDENT" or not created:
        return
    if not instance.section:
        return

    classroom = instance.section.classroom

    # 1. Old logic: StudentSubject (academics)
    class_subjects = ClassSubject.objects.filter(classroom=classroom)
    for cs in class_subjects:
        StudentSubject.objects.get_or_create(
            student=instance,
            subject=cs.subject,
            classroom=classroom,
        )

    # 2. NEW: Auto-enroll in ALL published courses (this was missing)
    courses = Course.objects.filter(is_published=True) if hasattr(Course, 'is_published') else Course.objects.all()
    for course in courses:
        Enrollment.objects.get_or_create(
            user=instance,
            course=course,
            defaults={"status": "enrolled"}
        )

    print(f"✅ Auto-assigned subjects + courses to new student: {instance.username}")


# Extra safety: When a new ClassSubject is added later
@receiver(post_save, sender=ClassSubject)
def auto_assign_students_for_new_class_subject(sender, instance, **kwargs):
    classroom = instance.classroom
    students = User.objects.filter(role="STUDENT", section__classroom=classroom)

    for student in students:
        StudentSubject.objects.get_or_create(
            student=student,
            subject=instance.subject,
            classroom=classroom,
        )