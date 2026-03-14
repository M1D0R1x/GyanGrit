"""
Signals for the assessments app.

Recalculates Assessment.total_marks whenever a Question is
saved or deleted. This keeps total_marks always consistent
with the actual sum of question marks without requiring
manual updates.
"""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Question


@receiver(post_save, sender=Question)
def update_total_marks_on_save(sender, instance, **kwargs):
    instance.assessment.recalculate_total_marks()


@receiver(post_delete, sender=Question)
def update_total_marks_on_delete(sender, instance, **kwargs):
    instance.assessment.recalculate_total_marks()