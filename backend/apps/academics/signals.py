from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.models import User
from apps.content.models import Course
from apps.learning.models import Enrollment
from .models import ClassSubject, StudentSubject


@receiver(post_save, sender=User)
def auto_assign_subjects_and_courses(sender, instance, created, **kwargs):
    """
    ROBUST & FUTURE-PROOF:
    - Only enrolls student in courses matching their exact class grade
    - No duplicates
    - Works even if Course model changes later
    """
    if instance.role != "STUDENT" or not created:
        return
    if not instance.section or not instance.section.classroom:
        return

    classroom = instance.section.classroom
    try:
        student_grade = int(classroom.name.strip())
    except (ValueError, TypeError):
        print(f"⚠️ Could not parse grade from classroom '{classroom.name}' for student {instance.username}")
        return

    # 1. Auto-assign StudentSubject (your existing academics logic)
    class_subjects = ClassSubject.objects.filter(classroom=classroom)
    for cs in class_subjects:
        StudentSubject.objects.get_or_create(
            student=instance,
            subject=cs.subject,
            classroom=classroom,
        )

    # 2. Auto-enroll ONLY in courses of the student's grade
    matching_courses = Course.objects.filter(grade=student_grade)

    enrolled_count = 0
    for course in matching_courses:
        _, created = Enrollment.objects.get_or_create(
            user=instance,
            course=course,
            defaults={"status": "enrolled"}
        )
        if created:
            enrolled_count += 1

    print(f"✅ Student {instance.username} (Class {student_grade}) → "
          f"Assigned {class_subjects.count()} subjects + {enrolled_count} correct courses")


# Extra safety for future ClassSubject additions
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