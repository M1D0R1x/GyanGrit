# apps.chatrooms.signals
"""
Auto-create chat rooms and enroll users.

Signal handlers:
  post_save User (STUDENT)         → create all subject rooms for their section, enroll them
  post_save User (TEACHER)         → enroll in staff room
  post_save User (PRINCIPAL)       → enroll in staff room + officials room
  post_save User (OFFICIAL)        → enroll in officials room
  post_save TeachingAssignment     → create subject room, enroll teacher + all existing students
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="accounts.User")
def handle_user_save(sender, instance, **kwargs):
    from .views import (
        get_or_create_subject_room,
        get_or_create_staff_room,
        get_or_create_officials_room,
        enroll_user,
        enroll_admin_in_room,
        enroll_student_in_all_section_rooms,
    )
    try:
        if instance.role == "STUDENT" and instance.section_id:
            enroll_student_in_all_section_rooms(instance)

        elif instance.role == "TEACHER" and instance.institution_id:
            staff_room = get_or_create_staff_room(instance.institution)
            enroll_user(staff_room, instance)
            enroll_admin_in_room(staff_room)

        elif instance.role == "PRINCIPAL":
            if instance.institution_id:
                staff_room = get_or_create_staff_room(instance.institution)
                enroll_user(staff_room, instance)
                enroll_admin_in_room(staff_room)
            officials_room = get_or_create_officials_room()
            enroll_user(officials_room, instance)
            enroll_admin_in_room(officials_room)

        elif instance.role == "OFFICIAL":
            officials_room = get_or_create_officials_room()
            enroll_user(officials_room, instance)
            enroll_admin_in_room(officials_room)

    except Exception as exc:
        logger.warning("chatrooms.signals.handle_user_save [user=%s]: %s", instance.id, exc)


@receiver(post_save, sender="academics.TeachingAssignment")
def handle_teaching_assignment(sender, instance, created, **kwargs):
    if not created:
        return
    from .views import enroll_teacher_in_subject_rooms
    try:
        enroll_teacher_in_subject_rooms(instance.teacher, instance.section, instance.subject)
    except Exception as exc:
        logger.warning(
            "chatrooms.signals.handle_teaching_assignment [ta=%s]: %s", instance.id, exc
        )
