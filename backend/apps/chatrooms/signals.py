# apps.chatrooms.signals
"""
Auto-create chat rooms and enroll users on assignment.

RULES (must match bootstrap_chatrooms exactly):
  STUDENT joins section  → enroll in EXISTING subject rooms for that section only.
                           NEVER create new rooms here. Rooms only exist when a teacher
                           is assigned via TeachingAssignment.
  TeachingAssignment created → create subject room, enroll teacher + all existing students
                                of that section + admin.
  TEACHER saved with institution → enroll in staff room.
  PRINCIPAL → staff room + officials room.
  OFFICIAL  → officials room.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="accounts.User")
def handle_user_save(sender, instance, **kwargs):
    from apps.chatrooms.models import ChatRoom, ChatRoomMember, RoomType
    from apps.chatrooms.views import (
        get_or_create_staff_room,
        get_or_create_officials_room,
        enroll_admin_in_room,
    )
    from django.contrib.auth import get_user_model
    User = get_user_model()

    def _enroll(room, user):
        ChatRoomMember.objects.get_or_create(room=room, user=user)

    try:
        if instance.role == "STUDENT" and instance.section_id:
            # ONLY enroll in rooms that already exist for this section.
            # Never create rooms — that's the teacher assignment signal's job.
            existing_rooms = ChatRoom.objects.filter(
                room_type=RoomType.SUBJECT,
                section_id=instance.section_id,
            )
            room_ids = list(existing_rooms.values_list("id", flat=True))
            if room_ids:
                # Bulk-enroll student — 1 INSERT instead of N get_or_create
                ChatRoomMember.objects.bulk_create(
                    [ChatRoomMember(room_id=rid, user=instance) for rid in room_ids],
                    ignore_conflicts=True,
                )
                # Bulk-enroll admins — 1 query for admins, 1 INSERT
                admin_ids = list(User.objects.filter(role="ADMIN").values_list("id", flat=True))
                if admin_ids:
                    ChatRoomMember.objects.bulk_create(
                        [ChatRoomMember(room_id=rid, user_id=aid)
                         for rid in room_ids for aid in admin_ids],
                        ignore_conflicts=True,
                    )

        elif instance.role == "TEACHER" and getattr(instance, "institution_id", None):
            staff_room = get_or_create_staff_room(instance.institution)
            _enroll(staff_room, instance)
            enroll_admin_in_room(staff_room)

        elif instance.role == "PRINCIPAL":
            if getattr(instance, "institution_id", None):
                staff_room = get_or_create_staff_room(instance.institution)
                _enroll(staff_room, instance)
                enroll_admin_in_room(staff_room)
            officials_room = get_or_create_officials_room()
            _enroll(officials_room, instance)
            enroll_admin_in_room(officials_room)

        elif instance.role == "OFFICIAL":
            officials_room = get_or_create_officials_room()
            _enroll(officials_room, instance)
            enroll_admin_in_room(officials_room)

    except Exception as exc:
        logger.warning("chatrooms.signals.handle_user_save [user=%s]: %s", instance.id, exc)


@receiver(post_save, sender="academics.TeachingAssignment")
def handle_teaching_assignment(sender, instance, created, **kwargs):
    """
    Teacher assigned to section+subject → create the subject room, enroll
    the teacher + all existing students of that section + admin.
    """
    if not created:
        return

    from apps.chatrooms.models import ChatRoomMember
    from apps.chatrooms.views import (
        get_or_create_subject_room,
        enroll_admin_in_room,
    )
    from django.contrib.auth import get_user_model
    User = get_user_model()

    def _enroll(room, user):
        ChatRoomMember.objects.get_or_create(room=room, user=user)

    try:
        room = get_or_create_subject_room(instance.section, instance.subject)
        _enroll(room, instance.teacher)

        # Bulk-enroll all existing students — 1 INSERT instead of N get_or_create calls
        student_ids = list(
            User.objects.filter(role="STUDENT", section=instance.section)
            .values_list("id", flat=True)
        )
        if student_ids:
            ChatRoomMember.objects.bulk_create(
                [ChatRoomMember(room=room, user_id=uid) for uid in student_ids],
                ignore_conflicts=True,
            )

        enroll_admin_in_room(room)

    except Exception as exc:
        logger.warning(
            "chatrooms.signals.handle_teaching_assignment [ta=%s]: %s", instance.id, exc
        )
