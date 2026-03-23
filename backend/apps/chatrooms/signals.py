# apps.chatrooms.signals
"""
Auto-create and enroll users into chat rooms on relevant model saves.

Rules:
  STUDENT saved with section:
    → create all 12 subject rooms for their section (if not already there)
    → enroll student in all those rooms
    → enroll admin in all those rooms

  TEACHER saved with institution:
    → enroll in staff room of their institution

  PRINCIPAL saved with institution:
    → enroll in staff room + officials room

  OFFICIAL saved:
    → enroll in officials room

  TeachingAssignment created:
    → create subject room for that section × subject
    → enroll teacher in that room
    → enroll all existing students of that section in that room
    → enroll teacher in staff room of their institution
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="accounts.User")
def handle_user_save(sender, instance, **kwargs):
    from apps.chatrooms.models import ChatRoom, ChatRoomMember
    from apps.chatrooms.views import (
        get_or_create_staff_room,
        get_or_create_officials_room,
    )
    from apps.academics.models import Subject
    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        admins = list(User.objects.filter(role="ADMIN"))

        def _enroll(room, user):
            ChatRoomMember.objects.get_or_create(room=room, user=user)

        if instance.role == "STUDENT" and instance.section_id:
            section = instance.section
            grade = section.classroom.name if section.classroom else "?"
            label = section.name

            for subj in Subject.objects.all():
                room, _ = ChatRoom.objects.get_or_create(
                    room_type="subject",
                    section=section,
                    subject=subj,
                    defaults={"name": f"Class {grade}{label} {subj.name}"},
                )
                _enroll(room, instance)
                for a in admins:
                    _enroll(room, a)

        elif instance.role == "TEACHER" and getattr(instance, "institution_id", None):
            staff_room = get_or_create_staff_room(instance.institution)
            _enroll(staff_room, instance)
            for a in admins:
                _enroll(staff_room, a)

        elif instance.role == "PRINCIPAL":
            if getattr(instance, "institution_id", None):
                staff_room = get_or_create_staff_room(instance.institution)
                _enroll(staff_room, instance)
                for a in admins:
                    _enroll(staff_room, a)
            officials_room = get_or_create_officials_room()
            _enroll(officials_room, instance)
            for a in admins:
                _enroll(officials_room, a)

        elif instance.role == "OFFICIAL":
            officials_room = get_or_create_officials_room()
            _enroll(officials_room, instance)
            for a in admins:
                _enroll(officials_room, a)

    except Exception as exc:
        logger.warning("chatrooms.signals.handle_user_save [user=%s]: %s", instance.id, exc)


@receiver(post_save, sender="academics.TeachingAssignment")
def handle_teaching_assignment(sender, instance, created, **kwargs):
    """
    When a teacher is assigned to a section+subject:
    - Ensure subject room exists
    - Enroll teacher + existing students of that section + admins
    - Enroll teacher in staff room
    """
    if not created:
        return
    from apps.chatrooms.models import ChatRoom, ChatRoomMember
    from apps.chatrooms.views import get_or_create_staff_room
    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        section = instance.section
        subject = instance.subject
        teacher = instance.teacher
        grade   = section.classroom.name if section.classroom else "?"
        label   = section.name
        admins  = list(User.objects.filter(role="ADMIN"))

        def _enroll(room, user):
            ChatRoomMember.objects.get_or_create(room=room, user=user)

        room, _ = ChatRoom.objects.get_or_create(
            room_type="subject",
            section=section,
            subject=subject,
            defaults={"name": f"Class {grade}{label} {subject.name}"},
        )
        _enroll(room, teacher)
        for student in User.objects.filter(role="STUDENT", section=section):
            _enroll(room, student)
        for a in admins:
            _enroll(room, a)

        # Staff room
        if teacher.institution:
            staff_room = get_or_create_staff_room(teacher.institution)
            _enroll(staff_room, teacher)
            for a in admins:
                _enroll(staff_room, a)

    except Exception as exc:
        logger.warning(
            "chatrooms.signals.handle_teaching_assignment [ta=%s]: %s", instance.id, exc
        )
