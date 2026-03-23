# apps.chatrooms.views
"""
Chat Rooms endpoints.

GET  /api/v1/chat/rooms/                        → list rooms visible to the user
GET  /api/v1/chat/rooms/<id>/                   → room detail
GET  /api/v1/chat/rooms/<id>/history/           → last 50 top-level messages + reply counts
GET  /api/v1/chat/rooms/<id>/thread/<msg_id>/   → all replies for a message (thread)
POST /api/v1/chat/rooms/<id>/message/           → send a message (or reply)
POST /api/v1/chat/rooms/<id>/pin/<msg_id>/      → pin/unpin (TEACHER/ADMIN only)
GET  /api/v1/chat/rooms/<id>/pinned/            → list pinned messages

Sender display rules:
  - ADMIN role: shown as "Chat Moderator" with role label "moderator"
  - TEACHER: shown as "{first_name} {last_name}" with role label "teacher"
  - STUDENT: shown as "{first_name} {last_name}" with role label "student"
  - PRINCIPAL: shown as "{first_name} {last_name}" with role label "principal"

Post permission rules:
  - In class_general + subject rooms: TEACHER/ADMIN can post + reply;
    STUDENTS can only reply to existing messages (not start new threads)
  - In staff rooms: TEACHER/PRINCIPAL/ADMIN can post freely
  - In officials rooms: OFFICIAL/PRINCIPAL/ADMIN can post freely

File/image sharing: only TEACHER and ADMIN can include attachment_url.
"""
import json
import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from apps.academics.models import Section, Subject, Institution
from .models import ChatRoom, ChatMessage, RoomType

User = get_user_model()
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Sender display
# ─────────────────────────────────────────────────────────────────────────────

def _sender_display(user) -> dict:
    """
    Returns display name and role label for a sender.
    ADMIN is anonymised as 'Chat Moderator'.
    """
    if user.role == "ADMIN":
        return {"name": "Chat Moderator", "role_label": "moderator"}

    first = (user.first_name or "").strip()
    last  = (user.last_name  or "").strip()
    full  = f"{first} {last}".strip() or user.username

    role_map = {
        "TEACHER":   "teacher",
        "PRINCIPAL": "principal",
        "OFFICIAL":  "official",
        "STUDENT":   "student",
    }
    return {"name": full, "role_label": role_map.get(user.role, user.role.lower())}


# ─────────────────────────────────────────────────────────────────────────────
# Message serialisation
# ─────────────────────────────────────────────────────────────────────────────

def _msg_to_dict(msg: ChatMessage, reply_count: int = 0) -> dict:
    sender_info = _sender_display(msg.sender)
    return {
        "id":              msg.id,
        "sender_id":       msg.sender_id,
        "sender_name":     sender_info["name"],
        "sender_role":     msg.sender.role,
        "role_label":      sender_info["role_label"],
        "content":         msg.content,
        "attachment_url":  msg.attachment_url,
        "attachment_type": msg.attachment_type,
        "attachment_name": msg.attachment_name,
        "parent_id":       msg.parent_id,
        "reply_count":     reply_count,
        "is_pinned":       msg.is_pinned,
        "sent_at":         msg.sent_at.isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Room serialisation
# ─────────────────────────────────────────────────────────────────────────────

def _room_to_dict(room: ChatRoom) -> dict:
    return {
        "id":             room.id,
        "name":           room.name,
        "room_type":      room.room_type,
        "section_id":     room.section_id,
        "subject_id":     room.subject_id,
        "institution_id": room.institution_id,
        "is_active":      room.is_active,
        "ably_channel":   room.ably_channel,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Access control
# ─────────────────────────────────────────────────────────────────────────────

def _user_can_access_room(user, room: ChatRoom) -> bool:
    if user.role == "ADMIN":
        return True

    if room.room_type == RoomType.CLASS_GENERAL:
        if user.role == "STUDENT":
            return getattr(user, "section_id", None) == room.section_id
        if user.role == "TEACHER":
            return user.teaching_assignments.filter(section_id=room.section_id).exists()
        if user.role in ("PRINCIPAL", "OFFICIAL"):
            if user.institution:
                return room.section.classroom.institution_id == user.institution_id
        return False

    if room.room_type == RoomType.SUBJECT:
        if user.role == "STUDENT":
            return getattr(user, "section_id", None) == room.section_id
        if user.role == "TEACHER":
            return user.teaching_assignments.filter(
                section_id=room.section_id, subject_id=room.subject_id
            ).exists()
        if user.role in ("PRINCIPAL", "OFFICIAL"):
            if user.institution:
                return room.section.classroom.institution_id == user.institution_id
        return False

    if room.room_type == RoomType.STAFF:
        if user.role in ("TEACHER", "PRINCIPAL"):
            if user.institution:
                return room.institution_id == user.institution_id
        return False

    if room.room_type == RoomType.OFFICIALS:
        return user.role in ("OFFICIAL", "PRINCIPAL", "ADMIN")

    return False


def _user_can_post(user, room: ChatRoom, is_reply: bool) -> bool:
    """
    Rules:
    - ADMIN: always
    - Staff rooms: TEACHER/PRINCIPAL freely
    - Officials room: OFFICIAL/PRINCIPAL freely
    - Class/subject rooms: TEACHER can post + reply; STUDENT can only REPLY
    """
    if user.role == "ADMIN":
        return True
    if room.room_type == RoomType.STAFF:
        return user.role in ("TEACHER", "PRINCIPAL")
    if room.room_type == RoomType.OFFICIALS:
        return user.role in ("OFFICIAL", "PRINCIPAL")
    # class_general + subject
    if user.role == "TEACHER":
        return True
    if user.role == "STUDENT":
        return is_reply  # students can only reply, not start new threads
    if user.role in ("PRINCIPAL",):
        return True
    return False


def _user_can_share_files(user) -> bool:
    return user.role in ("TEACHER", "PRINCIPAL", "ADMIN")


# ─────────────────────────────────────────────────────────────────────────────
# Lazy room creation helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_or_create_class_room(section: Section) -> ChatRoom:
    grade = section.classroom.name if section.classroom else "?"
    label = section.name  # e.g. "A"
    name  = f"Class {grade}{label} — General"
    room, _ = ChatRoom.objects.get_or_create(
        room_type=RoomType.CLASS_GENERAL,
        section=section,
        defaults={"name": name},
    )
    return room


def get_or_create_subject_room(section: Section, subject: Subject) -> ChatRoom:
    grade = section.classroom.name if section.classroom else "?"
    label = section.name  # e.g. "A"
    name  = f"Class {grade}{label} {subject.name}"
    room, _ = ChatRoom.objects.get_or_create(
        room_type=RoomType.SUBJECT,
        section=section,
        subject=subject,
        defaults={"name": name},
    )
    return room


def get_or_create_staff_room(institution: Institution) -> ChatRoom:
    room, _ = ChatRoom.objects.get_or_create(
        room_type=RoomType.STAFF,
        institution=institution,
        defaults={"name": f"{institution.name} — Staff"},
    )
    return room


def get_or_create_officials_room() -> ChatRoom:
    room, _ = ChatRoom.objects.get_or_create(
        room_type=RoomType.OFFICIALS,
        defaults={"name": "Officials"},
    )
    return room


# ─────────────────────────────────────────────────────────────────────────────
# LIST rooms — GET /api/v1/chat/rooms/
# Groups rooms by type. Admin gets a filtered view, not a flat list.
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def list_rooms(request):
    user = request.user
    rooms: list[ChatRoom] = []

    if user.role == "STUDENT":
        # Only their section's class_general + subject rooms for enrolled subjects
        section = getattr(user, "section", None)
        if section:
            rooms.append(get_or_create_class_room(section))
            # Subject rooms where teacher is assigned to this section
            from apps.academics.models import TeachingAssignment
            subject_ids = TeachingAssignment.objects.filter(
                section=section
            ).values_list("subject_id", flat=True).distinct()
            subjects = Subject.objects.filter(id__in=subject_ids)
            for subj in subjects:
                rooms.append(get_or_create_subject_room(section, subj))

    elif user.role == "TEACHER":
        # class_general + subject rooms for each assigned section
        from apps.academics.models import TeachingAssignment
        assignments = TeachingAssignment.objects.filter(
            teacher=user
        ).select_related("section__classroom__institution", "subject").distinct()

        seen_sections: set[int] = set()
        for ta in assignments:
            if ta.section_id not in seen_sections:
                rooms.append(get_or_create_class_room(ta.section))
                seen_sections.add(ta.section_id)
            rooms.append(get_or_create_subject_room(ta.section, ta.subject))

        # Staff room for their institution
        if user.institution:
            rooms.append(get_or_create_staff_room(user.institution))

    elif user.role == "PRINCIPAL":
        if user.institution:
            # All class_general + subject rooms for their school
            sections = Section.objects.filter(
                classroom__institution=user.institution
            ).select_related("classroom")
            subjects = Subject.objects.all()
            for sec in sections:
                rooms.append(get_or_create_class_room(sec))
                for subj in subjects:
                    # Only create subject room if a teacher is assigned
                    from apps.academics.models import TeachingAssignment
                    if TeachingAssignment.objects.filter(section=sec, subject=subj).exists():
                        rooms.append(get_or_create_subject_room(sec, subj))
            rooms.append(get_or_create_staff_room(user.institution))
        rooms.append(get_or_create_officials_room())

    elif user.role == "OFFICIAL":
        rooms.append(get_or_create_officials_room())
        # Also show staff rooms for institutions in their district
        if user.district:
            institutions = Institution.objects.filter(district__name=user.district)
            for inst in institutions:
                rooms.append(get_or_create_staff_room(inst))

    elif user.role == "ADMIN":
        # Admin: return grouped summary.
        # filter by institution_id or section query param to avoid giant lists
        institution_id = request.GET.get("institution_id")
        room_type      = request.GET.get("room_type")

        qs = ChatRoom.objects.select_related("section__classroom__institution", "subject", "institution")
        if institution_id:
            qs = qs.filter(
                models.Q(institution_id=institution_id) |
                models.Q(section__classroom__institution_id=institution_id)
            )
        if room_type:
            qs = qs.filter(room_type=room_type)

        # Always show officials room
        officials = get_or_create_officials_room()
        result = [_room_to_dict(officials)]
        result += [_room_to_dict(r) for r in qs[:100]]
        return JsonResponse(result, safe=False)

    # Deduplicate by id
    seen: set[int] = set()
    unique_rooms: list[ChatRoom] = []
    for r in rooms:
        if r.id not in seen:
            seen.add(r.id)
            unique_rooms.append(r)

    return JsonResponse([_room_to_dict(r) for r in unique_rooms], safe=False)


# Need to import Q for Admin filter
from django.db import models as _dm


# ─────────────────────────────────────────────────────────────────────────────
# ROOM DETAIL — GET /api/v1/chat/rooms/<id>/
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def room_detail(request, room_id):
    room = get_object_or_404(
        ChatRoom.objects.select_related("section__classroom__institution", "subject", "institution"),
        id=room_id,
    )
    if not _user_can_access_room(request.user, room):
        return JsonResponse({"error": "Forbidden"}, status=403)
    return JsonResponse(_room_to_dict(room))


# ─────────────────────────────────────────────────────────────────────────────
# MESSAGE HISTORY — GET /api/v1/chat/rooms/<id>/history/
# Returns last 50 TOP-LEVEL messages (parent=None) with reply_count each.
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def message_history(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not _user_can_access_room(request.user, room):
        return JsonResponse({"error": "Forbidden"}, status=403)

    from django.db.models import Count
    messages = list(
        ChatMessage.objects
        .filter(room=room, parent__isnull=True)
        .select_related("sender")
        .annotate(reply_count=Count("replies"))
        .order_by("-sent_at")[:50]
    )
    messages.reverse()

    return JsonResponse([_msg_to_dict(m, m.reply_count) for m in messages], safe=False)


# ─────────────────────────────────────────────────────────────────────────────
# THREAD — GET /api/v1/chat/rooms/<id>/thread/<msg_id>/
# Returns the parent message + all its replies ordered oldest→newest.
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def thread(request, room_id, message_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not _user_can_access_room(request.user, room):
        return JsonResponse({"error": "Forbidden"}, status=403)

    parent_msg = get_object_or_404(
        ChatMessage.objects.select_related("sender"),
        id=message_id, room=room, parent__isnull=True,
    )
    replies = list(
        ChatMessage.objects
        .filter(room=room, parent=parent_msg)
        .select_related("sender")
        .order_by("sent_at")
    )

    return JsonResponse({
        "parent":  _msg_to_dict(parent_msg, len(replies)),
        "replies": [_msg_to_dict(r) for r in replies],
    })


# ─────────────────────────────────────────────────────────────────────────────
# SEND MESSAGE — POST /api/v1/chat/rooms/<id>/message/
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def send_message(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not _user_can_access_room(request.user, room):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if not room.is_active:
        return JsonResponse({"error": "This chat room is closed"}, status=400)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    content         = body.get("content", "").strip()
    parent_id       = body.get("parent_id")
    attachment_url  = body.get("attachment_url", "").strip() or None
    attachment_type = body.get("attachment_type") or None
    attachment_name = body.get("attachment_name", "").strip() or None

    # Validate content or attachment
    if not content and not attachment_url:
        return JsonResponse({"error": "content or attachment_url is required"}, status=400)
    if content and len(content) > 2000:
        return JsonResponse({"error": "Message too long (max 2000 chars)"}, status=400)

    # File sharing permission
    if attachment_url and not _user_can_share_files(request.user):
        return JsonResponse({"error": "Only teachers and admins can share files"}, status=403)

    # Thread validation
    parent = None
    if parent_id:
        parent = get_object_or_404(
            ChatMessage, id=parent_id, room=room, parent__isnull=True
        )

    is_reply = parent is not None
    if not _user_can_post(request.user, room, is_reply):
        return JsonResponse(
            {"error": "Students can only reply to messages, not start new threads"},
            status=403,
        )

    msg = ChatMessage.objects.create(
        room=room,
        sender=request.user,
        content=content,
        parent=parent,
        attachment_url=attachment_url,
        attachment_type=attachment_type,
        attachment_name=attachment_name,
    )

    logger.info(
        "ChatMessage created: room=%s sender=%s parent=%s",
        room_id, request.user.id, parent_id,
    )
    return JsonResponse(_msg_to_dict(msg), status=201)


# ─────────────────────────────────────────────────────────────────────────────
# PIN — POST /api/v1/chat/rooms/<id>/pin/<msg_id>/
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def pin_message(request, room_id, message_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not _user_can_access_room(request.user, room):
        return JsonResponse({"error": "Forbidden"}, status=403)
    msg = get_object_or_404(ChatMessage, id=message_id, room=room)
    msg.is_pinned = not msg.is_pinned
    msg.save(update_fields=["is_pinned"])
    return JsonResponse({"id": msg.id, "is_pinned": msg.is_pinned})


# ─────────────────────────────────────────────────────────────────────────────
# PINNED — GET /api/v1/chat/rooms/<id>/pinned/
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def pinned_messages(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not _user_can_access_room(request.user, room):
        return JsonResponse({"error": "Forbidden"}, status=403)
    msgs = list(
        ChatMessage.objects
        .filter(room=room, is_pinned=True)
        .select_related("sender")
        .order_by("sent_at")
    )
    return JsonResponse([_msg_to_dict(m) for m in msgs], safe=False)
