# apps.chatrooms.signals
"""
Auto-create chat rooms when users are assigned to sections or teaching roles.

Signals:
  post_save on User:
    - Student gets section → create class_general + subject rooms for that section
  post_save on TeachingAssignment:
    - Teacher assigned to section+subject → create subject room + class_general room
  post_save on User (PRINCIPAL role):
    - Principal assigned to institution → create staff room
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="accounts.User")
def handle_user_save(sender, instance, created, **kwargs):
    """
    When a student is given a section, ensure class_general + subject rooms exist.
    When a principal is saved with an institution, ensure staff room exists.
    """
    from .views import (
        get_or_create_class_room,
        get_or_create_subject_room,
        get_or_create_staff_room,
        get_or_create_officials_room,
    )
    try:
        if instance.role == "STUDENT" and instance.section_id:
            section = instance.section
            get_or_create_class_room(section)
            # Subject rooms — create for all teaching assignments in this section
            from apps.academics.models import TeachingAssignment
            for ta in TeachingAssignment.objects.filter(section=section).select_related("subject"):
                get_or_create_subject_room(section, ta.subject)

        elif instance.role == "PRINCIPAL" and getattr(instance, "institution_id", None):
            get_or_create_staff_room(instance.institution)
            get_or_create_officials_room()

        elif instance.role == "OFFICIAL":
            get_or_create_officials_room()

    except Exception as exc:
        logger.warning("chatrooms.signals.handle_user_save: %s", exc)


@receiver(post_save, sender="academics.TeachingAssignment")
def handle_teaching_assignment_save(sender, instance, created, **kwargs):
    """
    When a TeachingAssignment is created, ensure the subject chat room
    and class_general room exist for that section.
    """
    if not created:
        return
    from .views import get_or_create_class_room, get_or_create_subject_room
    try:
        section = instance.section
        subject = instance.subject
        get_or_create_class_room(section)
        get_or_create_subject_room(section, subject)
    except Exception as exc:
        logger.warning("chatrooms.signals.handle_teaching_assignment_save: %s", exc)
