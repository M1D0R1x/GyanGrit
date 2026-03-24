# apps.chatrooms.views
"""
Chat Rooms — endpoints + room creation helpers.

Endpoints:
  GET  /api/v1/chat/rooms/                       — list rooms for the user
  GET  /api/v1/chat/rooms/<id>/                  — room detail + member count
  GET  /api/v1/chat/rooms/<id>/history/          — last 50 top-level messages
  GET  /api/v1/chat/rooms/<id>/thread/<msg_id>/  — parent + all replies
  POST /api/v1/chat/rooms/<id>/message/          — send message / reply
  POST /api/v1/chat/rooms/<id>/pin/<msg_id>/     — pin/unpin
  GET  /api/v1/chat/rooms/<id>/pinned/           — list pinned messages
  GET  /api/v1/chat/rooms/<id>/members/          — list members (admin/teacher)

  Admin management:
  GET  /api/v1/chat/admin/rooms/                 — all rooms, filterable
  GET  /api/v1/chat/admin/rooms/<id>/messages/   — all messages in a room (admin)
"""
import json
import logging

from django.contrib.auth import get_user_model
from apps.accesscontrol.permissions import require_auth  # returns 401 JSON, not 302
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from apps.academics.models import Section, Subject, Institution
from .models import ChatRoom, ChatRoomMember, ChatMessage, RoomType

User = get_user_model()
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers — sender display
# ─────────────────────────────────────────────────────────────────────────────

def _sender_display(user) -> dict:
    if user.role == "ADMIN":
        return {"name": "Chat Moderator", "role_label": "moderator"}
    first = (user.first_name or "").strip()
    last  = (user.last_name  or "").strip()
    full  = f"{first} {last}".strip() or user.username
    role_map = {"TEACHER": "teacher", "PRINCIPAL": "principal",
                "OFFICIAL": "official", "STUDENT": "student"}
    return {"name": full, "role_label": role_map.get(user.role, user.role.lower())}


def _msg_to_dict(msg: ChatMessage, reply_count: int = 0) -> dict:
    s = _sender_display(msg.sender)
    return {
        "id":              msg.id,
        "sender_id":       msg.sender_id,
        "sender_name":     s["name"],
        "sender_role":     msg.sender.role,
        "role_label":      s["role_label"],
        "content":         msg.content,
        "attachment_url":  msg.attachment_url,
        "attachment_type": msg.attachment_type,
        "attachment_name": msg.attachment_name,
        "parent_id":       msg.parent_id,
        "reply_count":     reply_count,
        "is_pinned":       msg.is_pinned,
        "sent_at":         msg.sent_at.isoformat(),
    }


def _room_to_dict(room: ChatRoom, member_count: int = 0) -> dict:
    return {
        "id":             room.id,
        "name":           room.name,
        "room_type":      room.room_type,
        "section_id":     room.section_id,
        "subject_id":     room.subject_id,
        "institution_id": room.institution_id,
        "is_active":      room.is_active,
        "ably_channel":   room.ably_channel,
        "member_count":   member_count,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Helpers — lazy room creation + enrollment
# ─────────────────────────────────────────────────────────────────────────────

def get_or_create_subject_room(section: Section, subject: Subject) -> ChatRoom:
    grade = section.classroom.name if section.classroom else "?"
    label = section.name
    name  = f"Class {grade}{label} {subject.name}"
    room, _ = ChatRoom.objects.get_or_create(
        room_type=RoomType.SUBJECT, section=section, subject=subject,
        defaults={"name": name},
    )
    return room


def get_or_create_staff_room(institution: Institution) -> ChatRoom:
    room, _ = ChatRoom.objects.get_or_create(
        room_type=RoomType.STAFF, institution=institution,
        defaults={"name": f"{institution.name} — Staff"},
    )
    return room


def get_or_create_officials_room() -> ChatRoom:
    room, _ = ChatRoom.objects.get_or_create(
        room_type=RoomType.OFFICIALS,
        defaults={"name": "Officials"},
    )
    return room


def enroll_user(room: ChatRoom, user) -> bool:
    """Add user as member. Returns True if newly added."""
    _, created = ChatRoomMember.objects.get_or_create(room=room, user=user)
    return created


def enroll_admin_in_room(room: ChatRoom) -> None:
    """Ensure ADMIN user(s) are enrolled in every room."""
    for admin in User.objects.filter(role="ADMIN"):
        ChatRoomMember.objects.get_or_create(room=room, user=admin)


def enroll_student_in_all_section_rooms(student) -> None:
    """
    When a student is assigned to a section, enroll them ONLY in subject rooms
    where a TeachingAssignment already exists for that section.
    Rooms are NOT created for subjects with no assigned teacher.
    """
    section = getattr(student, "section", None)
    if not section:
        return

    from apps.academics.models import TeachingAssignment
    # Only look at existing rooms — never create rooms here
    # Rooms are created when a teacher is assigned (enroll_teacher_in_subject_rooms)
    existing_rooms = ChatRoom.objects.filter(
        room_type=RoomType.SUBJECT,
        section=section,
    )
    for room in existing_rooms:
        enroll_user(room, student)
        enroll_admin_in_room(room)


def enroll_teacher_in_subject_rooms(teacher, section: Section, subject: Subject) -> None:
    """
    When a teacher is assigned to a section+subject:
    - Create subject room if needed
    - Enroll teacher
    - Enroll all existing students of that section
    - Enroll admin
    - Enroll teacher in staff room of their institution
    """
    room = get_or_create_subject_room(section, subject)
    enroll_user(room, teacher)
    enroll_admin_in_room(room)

    # Enroll existing students of this section
    for student in User.objects.filter(role="STUDENT", section=section):
        enroll_user(room, student)

    # Staff room
    if teacher.institution:
        staff_room = get_or_create_staff_room(teacher.institution)
        enroll_user(staff_room, teacher)
        enroll_admin_in_room(staff_room)


# ─────────────────────────────────────────────────────────────────────────────
# Access control
# ─────────────────────────────────────────────────────────────────────────────

def _user_can_access_room(user, room: ChatRoom) -> bool:
    if user.role == "ADMIN":
        return True
    # Membership-based check — fastest path
    return ChatRoomMember.objects.filter(room=room, user=user).exists()


def _user_can_post(user, room: ChatRoom, is_reply: bool) -> bool:
    if user.role == "ADMIN":
        return True
    if room.room_type == RoomType.STAFF:
        return user.role in ("TEACHER", "PRINCIPAL")
    if room.room_type == RoomType.OFFICIALS:
        return user.role in ("OFFICIAL", "PRINCIPAL")
    # subject rooms
    if user.role in ("TEACHER", "PRINCIPAL"):
        return True
    if user.role == "STUDENT":
        return is_reply  # students reply only
    return False


def _user_can_share_files(user) -> bool:
    return user.role in ("TEACHER", "PRINCIPAL", "ADMIN")


# ─────────────────────────────────────────────────────────────────────────────
# Push notification helper
# ─────────────────────────────────────────────────────────────────────────────

def _create_notification_records(room: ChatRoom, message: ChatMessage, sender) -> None:
    """
    Create a persistent Notification row for each room member (excluding sender).
    This makes the chat message appear in the notification bell on every page.
    Uses Notification.send() from apps.notifications.
    """
    from apps.notifications.models import Notification, NotificationType

    sender_info  = _sender_display(sender)
    preview      = message.content[:120] if message.content else "📎 Attachment"
    subject      = f"New message in {room.name}"
    msg_body     = f"{sender_info['name']}: {preview}"
    link         = f"/chat"  # frontend will navigate to chat page

    member_ids = list(
        ChatRoomMember.objects.filter(room=room)
        .exclude(user_id=sender.id)
        .values_list("user_id", flat=True)
    )

    users = User.objects.filter(id__in=member_ids)
    for user in users:
        try:
            Notification.send(
                user=user,
                subject=subject,
                message=msg_body,
                notification_type=NotificationType.INFO,
                link=link,
            )
        except Exception as exc:
            logger.warning("Failed to create notification for user %s: %s", user.id, exc)


def _push_chat_notification(room: ChatRoom, message: ChatMessage, sender) -> None:
    """
    Publish a push notification to each room member via Ably
    on channel notifications:{user_id}.
    Skips the sender themselves.
    """
    from django.conf import settings
    import requests as http_requests
    import base64
    from urllib.parse import quote

    api_key = getattr(settings, "ABLY_API_KEY", "").strip()
    if not api_key or ":" not in api_key:
        return

    sender_info = _sender_display(sender)
    preview = message.content[:80] if message.content else "📎 Attachment"

    member_ids = list(
        ChatRoomMember.objects.filter(room=room)
        .exclude(user_id=sender.id)
        .values_list("user_id", flat=True)
    )
    if not member_ids:
        return

    credentials = base64.b64encode(api_key.encode()).decode()

    for uid in member_ids:
        try:
            channel = quote(f"notifications:{uid}", safe="")
            http_requests.post(
                f"https://rest.ably.io/channels/{channel}/messages",
                json={
                    "name": "chat_message",
                    "data": {
                        "room_id":     room.id,
                        "room_name":   room.name,
                        "room_type":   room.room_type,
                        "sender_name": sender_info["name"],
                        "role_label":  sender_info["role_label"],
                        "preview":     preview,
                    },
                },
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type":  "application/json",
                },
                timeout=3,
            )
        except Exception as exc:
            logger.warning("Push notification failed for user %s: %s", uid, exc)


# ─────────────────────────────────────────────────────────────────────────────
# LIST rooms — GET /api/v1/chat/rooms/
# ─────────────────────────────────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def list_rooms(request):
    user = request.user

    if user.role == "ADMIN":
        institution_id = request.GET.get("institution_id")
        room_type      = request.GET.get("room_type")

        # Default: show admin's own institution rooms + officials room.
        # Admin can pass ?institution_id=X to browse other schools.
        # Pass ?institution_id=all to see everything (admin management screen uses this).
        if not institution_id and user.institution_id:
            institution_id = str(user.institution_id)

        qs = ChatRoom.objects.prefetch_related("members")

        if institution_id and institution_id != "all":
            from django.db.models import Q
            qs = qs.filter(
                Q(institution_id=institution_id) |
                Q(section__classroom__institution_id=institution_id) |
                Q(room_type="officials")  # always include officials
            )
        if room_type:
            qs = qs.filter(room_type=room_type)

        rooms = list(qs.order_by("room_type", "name")[:150])
        return JsonResponse(
            [_room_to_dict(r, r.members.count()) for r in rooms],
            safe=False,
        )

    # All other roles: return rooms they are explicitly a member of
    memberships = (
        ChatRoomMember.objects
        .filter(user=user)
        .select_related("room")
        .order_by("room__room_type", "room__name")
    )
    result = []
    for m in memberships:
        result.append(_room_to_dict(m.room))
    return JsonResponse(result, safe=False)


# ─────────────────────────────────────────────────────────────────────────────
# ROOM DETAIL — GET /api/v1/chat/rooms/<id>/
# ─────────────────────────────────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def room_detail(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not _user_can_access_room(request.user, room):
        return JsonResponse({"error": "Forbidden"}, status=403)
    count = room.members.count()
    return JsonResponse(_room_to_dict(room, count))


# ─────────────────────────────────────────────────────────────────────────────
# MESSAGE HISTORY — GET /api/v1/chat/rooms/<id>/history/
# ─────────────────────────────────────────────────────────────────────────────

@require_auth
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
# ─────────────────────────────────────────────────────────────────────────────

@require_auth
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
        ChatMessage.objects.filter(room=room, parent=parent_msg)
        .select_related("sender").order_by("sent_at")
    )
    return JsonResponse({
        "parent":  _msg_to_dict(parent_msg, len(replies)),
        "replies": [_msg_to_dict(r) for r in replies],
    })


# ─────────────────────────────────────────────────────────────────────────────
# SEND MESSAGE — POST /api/v1/chat/rooms/<id>/message/
# ─────────────────────────────────────────────────────────────────────────────

@require_auth
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

    if not content and not attachment_url:
        return JsonResponse({"error": "content or attachment_url is required"}, status=400)
    if content and len(content) > 2000:
        return JsonResponse({"error": "Message too long (max 2000 chars)"}, status=400)
    if attachment_url and not _user_can_share_files(request.user):
        return JsonResponse({"error": "Only teachers and admins can share files"}, status=403)

    parent = None
    if parent_id:
        parent = get_object_or_404(ChatMessage, id=parent_id, room=room, parent__isnull=True)

    is_reply = parent is not None
    if not _user_can_post(request.user, room, is_reply):
        return JsonResponse(
            {"error": "Students can only reply to messages, not start new threads"},
            status=403,
        )

    with transaction.atomic():
        msg = ChatMessage.objects.create(
            room=room, sender=request.user, content=content,
            parent=parent, attachment_url=attachment_url,
            attachment_type=attachment_type, attachment_name=attachment_name,
        )

    # 1. Create persistent Notification records (shows in bell on any page)
    # 2. Push real-time Ably event to notifications:{user_id} channel
    try:
        _create_notification_records(room, msg, request.user)
        _push_chat_notification(room, msg, request.user)
    except Exception as exc:
        logger.warning("Notification error: %s", exc)

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

@require_auth
@require_http_methods(["GET"])
def pinned_messages(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not _user_can_access_room(request.user, room):
        return JsonResponse({"error": "Forbidden"}, status=403)
    msgs = list(
        ChatMessage.objects.filter(room=room, is_pinned=True)
        .select_related("sender").order_by("sent_at")
    )
    return JsonResponse([_msg_to_dict(m) for m in msgs], safe=False)


# ─────────────────────────────────────────────────────────────────────────────
# MEMBERS — GET /api/v1/chat/rooms/<id>/members/
# ─────────────────────────────────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def room_members(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not _user_can_access_room(request.user, room):
        return JsonResponse({"error": "Forbidden"}, status=403)
    members = list(
        ChatRoomMember.objects.filter(room=room)
        .select_related("user")
        .order_by("user__role", "user__first_name")
    )
    return JsonResponse([
        {
            "user_id":    m.user_id,
            "name":       f"{m.user.first_name} {m.user.last_name}".strip() or m.user.username,
            "role":       m.user.role,
            "role_label": _sender_display(m.user)["role_label"],
            "joined_at":  m.joined_at.isoformat(),
        }
        for m in members
    ], safe=False)


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN MANAGEMENT — GET /api/v1/chat/admin/rooms/
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["ADMIN"])
@require_http_methods(["GET"])
def admin_list_rooms(request):
    institution_id = request.GET.get("institution_id")
    room_type      = request.GET.get("room_type")
    search         = request.GET.get("q", "").strip()

    from django.db.models import Q, Count
    qs = ChatRoom.objects.annotate(
        member_count=Count("members"),
        message_count=Count("messages"),
    ).select_related("section__classroom__institution", "subject", "institution")

    if institution_id:
        qs = qs.filter(
            Q(institution_id=institution_id) |
            Q(section__classroom__institution_id=institution_id)
        )
    if room_type:
        qs = qs.filter(room_type=room_type)
    if search:
        qs = qs.filter(name__icontains=search)

    qs = qs.order_by("room_type", "name")[:200]

    data = []
    for r in qs:
        d = _room_to_dict(r, r.member_count)
        d["message_count"] = r.message_count
        d["institution_name"] = (
            r.institution.name if r.institution else
            (r.section.classroom.institution.name if r.section and r.section.classroom and r.section.classroom.institution else None)
        )
        data.append(d)

    return JsonResponse(data, safe=False)


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN MESSAGES — GET /api/v1/chat/admin/rooms/<id>/messages/
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["ADMIN"])
@require_http_methods(["GET"])
def admin_room_messages(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    from django.db.models import Count
    messages = list(
        ChatMessage.objects
        .filter(room=room)
        .select_related("sender")
        .annotate(reply_count=Count("replies"))
        .order_by("-sent_at")[:100]
    )
    messages.reverse()
    return JsonResponse({
        "room": _room_to_dict(room),
        "messages": [_msg_to_dict(m, m.reply_count) for m in messages],
    })
