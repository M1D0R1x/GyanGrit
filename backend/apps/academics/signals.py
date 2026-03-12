from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.accounts.models import User
from apps.content.models import Course
from apps.learning.models import Enrollment
from .models import ClassSubject, StudentSubject


@receiver(post_save, sender=User)
def auto_assign_subjects_and_courses(sender, instance, created, **kwargs):
    if instance.role != "STUDENT" or not created:
        return

    if not instance.section or not instance.section.classroom:
        return

    classroom = instance.section.classroom
    student_grade = int(classroom.name.strip())

    # 1. StudentSubject
    class_subjects = ClassSubject.objects.filter(classroom=classroom)
    for cs in class_subjects:
        StudentSubject.objects.get_or_create(
            student=instance,
            subject=cs.subject,
            classroom=classroom,
        )

    # 2. Enroll in matching grade courses
    matching_courses = Course.objects.filter(grade=student_grade)
    for course in matching_courses:
        Enrollment.objects.get_or_create(
            user=instance,
            course=course,
            defaults={"status": "enrolled"}
        )

    print(f"✅ Assigned to {matching_courses.count()} courses")


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