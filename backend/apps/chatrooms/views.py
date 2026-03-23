# apps.chatrooms.views
"""
Chat Rooms endpoints.

GET  /api/v1/chat/rooms/                → list rooms visible to the user
GET  /api/v1/chat/rooms/<id>/           → room detail (metadata only)
GET  /api/v1/chat/rooms/<id>/history/   → last 50 messages (for initial load)
POST /api/v1/chat/rooms/<id>/message/   → save a message to DB after Ably delivery
POST /api/v1/chat/rooms/<id>/pin/<msg>/ → teacher pins a message
GET  /api/v1/chat/rooms/<id>/pinned/    → list pinned messages

The Ably Chat token is vended by the existing realtime/token/ endpoint
(apps/competitions/views.py — ably_token) with chat:{section_id} capability.
"""
import json
import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from apps.academics.models import Section
from .models import ChatRoom, ChatMessage

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_or_create_room(section: Section) -> ChatRoom:
    room, _ = ChatRoom.objects.get_or_create(section=section)
    return room


def _msg_to_dict(msg: ChatMessage) -> dict:
    return {
        "id":           msg.id,
        "sender_id":    msg.sender_id,
        "sender":       msg.sender.display_name or msg.sender.username,
        "sender_role":  msg.sender.role,
        "content":      msg.content,
        "is_pinned":    msg.is_pinned,
        "sent_at":      msg.sent_at.isoformat(),
    }


def _room_to_dict(room: ChatRoom) -> dict:
    return {
        "id":           room.id,
        "section_id":   room.section_id,
        "section":      room.section.name,
        "class_name":   room.section.classroom.name if room.section.classroom else None,
        "is_active":    room.is_active,
        "created_at":   room.created_at.isoformat(),
    }


def _user_can_access_room(user, room: ChatRoom) -> bool:
    if user.role in ("ADMIN",):
        return True
    if user.role == "STUDENT":
        return getattr(user, "section_id", None) == room.section_id
    if user.role == "TEACHER":
        return user.teaching_assignments.filter(section_id=room.section_id).exists()
    if user.role in ("PRINCIPAL", "OFFICIAL"):
        if user.institution:
            return room.section.classroom.institution_id == user.institution_id
        return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# LIST rooms — GET /api/v1/chat/rooms/
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def list_rooms(request):
    user = request.user

    if user.role == "STUDENT":
        section = getattr(user, "section", None)
        if not section:
            return JsonResponse([], safe=False)
        rooms = [_get_or_create_room(section)]

    elif user.role == "TEACHER":
        section_ids = list(
            user.teaching_assignments.values_list("section_id", flat=True).distinct()
        )
        sections = Section.objects.filter(id__in=section_ids).select_related("classroom")
        rooms    = [_get_or_create_room(s) for s in sections]

    elif user.role in ("PRINCIPAL", "OFFICIAL"):
        from apps.academics.models import ClassRoom
        if user.institution:
            sections = Section.objects.filter(
                classroom__institution=user.institution
            ).select_related("classroom")
        else:
            sections = Section.objects.all().select_related("classroom")
        rooms = [_get_or_create_room(s) for s in sections]

    else:  # ADMIN
        rooms = list(ChatRoom.objects.select_related("section__classroom").all())

    return JsonResponse([_room_to_dict(r) for r in rooms], safe=False)


# ─────────────────────────────────────────────────────────────────────────────
# ROOM DETAIL — GET /api/v1/chat/rooms/<id>/
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def room_detail(request, room_id):
    room = get_object_or_404(
        ChatRoom.objects.select_related("section__classroom"),
        id=room_id,
    )
    if not _user_can_access_room(request.user, room):
        return JsonResponse({"error": "Forbidden"}, status=403)
    return JsonResponse(_room_to_dict(room))


# ─────────────────────────────────────────────────────────────────────────────
# MESSAGE HISTORY — GET /api/v1/chat/rooms/<id>/history/
# Last 50 messages, ordered oldest → newest for display.
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def message_history(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not _user_can_access_room(request.user, room):
        return JsonResponse({"error": "Forbidden"}, status=403)

    messages = list(
        ChatMessage.objects
        .filter(room=room)
        .select_related("sender")
        .order_by("-sent_at")[:50]
    )
    messages.reverse()  # oldest first for display

    return JsonResponse([_msg_to_dict(m) for m in messages], safe=False)


# ─────────────────────────────────────────────────────────────────────────────
# SAVE MESSAGE — POST /api/v1/chat/rooms/<id>/message/
# Called by frontend after Ably publishes a message, to persist it.
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def save_message(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not _user_can_access_room(request.user, room):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if not room.is_active:
        return JsonResponse({"error": "This chat room is closed"}, status=400)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    content = body.get("content", "").strip()
    if not content:
        return JsonResponse({"error": "content is required"}, status=400)
    if len(content) > 2000:
        return JsonResponse({"error": "Message too long (max 2000 chars)"}, status=400)

    msg = ChatMessage.objects.create(
        room=room,
        sender=request.user,
        content=content,
    )
    return JsonResponse(_msg_to_dict(msg), status=201)


# ─────────────────────────────────────────────────────────────────────────────
# PIN MESSAGE — POST /api/v1/chat/rooms/<id>/pin/<msg_id>/
# Only teachers/principals/admins can pin.
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def pin_message(request, room_id, message_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not _user_can_access_room(request.user, room):
        return JsonResponse({"error": "Forbidden"}, status=403)

    msg = get_object_or_404(ChatMessage, id=message_id, room=room)
    msg.is_pinned = not msg.is_pinned  # toggle
    msg.save(update_fields=["is_pinned"])

    return JsonResponse({"id": msg.id, "is_pinned": msg.is_pinned})


# ─────────────────────────────────────────────────────────────────────────────
# PINNED MESSAGES — GET /api/v1/chat/rooms/<id>/pinned/
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
