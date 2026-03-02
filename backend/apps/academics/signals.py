from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.accounts.models import User
from .models import ClassSubject, StudentSubject


@receiver(post_save, sender=User)
def auto_assign_subjects(sender, instance, created, **kwargs):

    if instance.role != "STUDENT":
        return

    if not instance.section:
        return

    classroom = instance.section.classroom

    class_subjects = ClassSubject.objects.filter(
        classroom=classroom
    )

    for cs in class_subjects:
        StudentSubject.objects.get_or_create(
            student=instance,
            subject=cs.subject,
            classroom=classroom,
        )