# apps.competitions.views
"""
Competition Rooms endpoints.

Endpoints:
  GET  /api/v1/competitions/              — list rooms visible to the user
  POST /api/v1/competitions/create/       — teacher/principal creates a room
  GET  /api/v1/competitions/<id>/         — room detail + participants
  POST /api/v1/competitions/<id>/join/    — student joins a room
  POST /api/v1/competitions/<id>/start/   — teacher starts the room (status → active)
  POST /api/v1/competitions/<id>/finish/  — teacher ends the room (status → finished)
  POST /api/v1/competitions/<id>/answer/  — student submits an answer

Ably token:
  POST /api/v1/realtime/token/            — returns a short-lived Ably JWT
  (lives in apps.competitions.views but mounted under /api/v1/realtime/)

Security:
  - Students can only join/answer rooms in their own section.
  - is_correct is NEVER returned to students.
  - Ably token is scoped to competition:{room_id} for students,
    competition:* for teachers/admins of that section.
"""
import json
import logging
import time

from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings

from apps.accesscontrol.permissions import require_roles
from apps.academics.models import Section
from apps.assessments.models import Assessment, Question, QuestionOption
from .models import CompetitionRoom, CompetitionParticipant, CompetitionAnswer, RoomStatus

User = get_user_model()
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _room_to_dict(room: CompetitionRoom, include_participants: bool = False) -> dict:
    d = {
        "id":           room.id,
        "title":        room.title,
        "status":       room.status,
        "host":         room.host.display_name or room.host.username,
        "host_id":      room.host_id,
        "section_id":   room.section_id,
        "section":      room.section.name,
        "assessment_id": room.assessment_id,
        "assessment":   room.assessment.title,
        "scheduled_at": room.scheduled_at.isoformat() if room.scheduled_at else None,
        "started_at":   room.started_at.isoformat()   if room.started_at   else None,
        "finished_at":  room.finished_at.isoformat()  if room.finished_at  else None,
        "created_at":   room.created_at.isoformat(),
        "participant_count": room.participants.count(),
    }
    if include_participants:
        d["participants"] = [
            {
                "student_id":    p.student_id,
                "username":      p.student.username,
                "display_name":  p.student.display_name or p.student.username,
                "score":         p.score,
                "rank":          p.rank,
            }
            for p in room.participants.select_related("student").order_by("rank", "-score")
        ]
    return d


def _publish_ably_event(channel_name: str, event: str, data: dict) -> bool:
    """
    Publish an event to an Ably channel from the backend via Ably REST HTTP API.
    Uses requests directly — Ably Python v3 SDK is async-only, incompatible with
    sync Django views.
    Returns True on success, False if ABLY_API_KEY is not set or publish fails.
    """
    import requests as http_requests
    import base64

    api_key = getattr(settings, "ABLY_API_KEY", "").strip()
    if not api_key:
        logger.warning("ABLY_API_KEY not set — skipping publish to %s", channel_name)
        return False

    if ":" not in api_key:
        logger.error("ABLY_API_KEY format invalid")
        return False

    try:
        credentials = base64.b64encode(api_key.encode()).decode()
        # URL-encode the channel name (handles special chars like [chat]123)
        from urllib.parse import quote
        encoded_channel = quote(channel_name, safe="")
        url = f"https://rest.ably.io/channels/{encoded_channel}/messages"

        resp = http_requests.post(
            url,
            json={"name": event, "data": data},
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type":  "application/json",
            },
            timeout=5,
        )
        resp.raise_for_status()
        return True
    except Exception as exc:
        logger.error("Ably publish failed on %s: %s", channel_name, exc)
        return False


def _recalculate_leaderboard(room: CompetitionRoom) -> list:
    """
    Recalculate scores from CompetitionAnswer rows, update participant ranks,
    and return the sorted leaderboard list.
    """
    from django.db.models import Sum
    participants = list(
        room.participants.select_related("student").all()
    )
    # Aggregate marks_earned per student
    from django.db.models import Sum as DjSum
    score_map = {
        row["student"]: row["total"]
        for row in (
            CompetitionAnswer.objects
            .filter(room=room)
            .values("student")
            .annotate(total=DjSum("marks_earned"))
        )
    }
    # Update scores
    for p in participants:
        p.score = score_map.get(p.student_id, 0)

    # Sort and assign ranks
    participants.sort(key=lambda p: -p.score)
    for i, p in enumerate(participants, 1):
        p.rank = i
    CompetitionParticipant.objects.bulk_update(participants, ["score", "rank"])

    return [
        {
            "rank":         p.rank,
            "student_id":   p.student_id,
            "username":     p.student.username,
            "display_name": p.student.display_name or p.student.username,
            "score":        p.score,
        }
        for p in participants
    ]


# ─────────────────────────────────────────────────────────────────────────────
# LIST rooms — GET /api/v1/competitions/
# ─────────────────────────────────────────────────────────────────────────────

from django.contrib.auth.decorators import login_required

@login_required
@require_http_methods(["GET"])
def list_rooms(request):
    user = request.user
    if user.role in ("TEACHER", "PRINCIPAL", "ADMIN"):
        # Teachers see rooms they host
        if user.role == "TEACHER":
            qs = CompetitionRoom.objects.filter(host=user)
        else:
            # Principal/Admin see all rooms in their institution
            from apps.academics.models import ClassRoom
            if user.institution:
                section_ids = Section.objects.filter(
                    classroom__institution=user.institution
                ).values_list("id", flat=True)
                qs = CompetitionRoom.objects.filter(section_id__in=section_ids)
            else:
                qs = CompetitionRoom.objects.all()
    else:
        # Students see rooms for their section only
        section = getattr(user, "section", None)
        if not section:
            return JsonResponse([], safe=False)
        qs = CompetitionRoom.objects.filter(section=section).exclude(status=RoomStatus.DRAFT)

    qs = qs.select_related("host", "section", "assessment").order_by("-created_at")
    return JsonResponse([_room_to_dict(r) for r in qs], safe=False)


# ─────────────────────────────────────────────────────────────────────────────
# CREATE room — POST /api/v1/competitions/create/
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def create_room(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    title         = body.get("title", "").strip()
    section_id    = body.get("section_id")
    assessment_id = body.get("assessment_id")

    if not title:
        return JsonResponse({"error": "title is required"}, status=400)
    if not section_id:
        return JsonResponse({"error": "section_id is required"}, status=400)
    if not assessment_id:
        return JsonResponse({"error": "assessment_id is required"}, status=400)

    section    = get_object_or_404(Section, id=section_id)
    assessment = get_object_or_404(Assessment, id=assessment_id)

    scheduled_at = None
    if body.get("scheduled_at"):
        from django.utils.dateparse import parse_datetime
        scheduled_at = parse_datetime(body["scheduled_at"])

    room = CompetitionRoom.objects.create(
        title=title,
        host=request.user,
        section=section,
        assessment=assessment,
        scheduled_at=scheduled_at,
    )
    logger.info("CompetitionRoom created: id=%s by user=%s", room.id, request.user.id)
    return JsonResponse(_room_to_dict(room), status=201)


# ─────────────────────────────────────────────────────────────────────────────
# ROOM DETAIL — GET /api/v1/competitions/<id>/
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def room_detail(request, room_id):
    room = get_object_or_404(
        CompetitionRoom.objects.select_related("host", "section", "assessment"),
        id=room_id,
    )
    user = request.user
    # Students can only see rooms for their section
    if user.role == "STUDENT":
        section = getattr(user, "section", None)
        if not section or room.section_id != section.id:
            return JsonResponse({"error": "Forbidden"}, status=403)

    data = _room_to_dict(room, include_participants=True)

    # Add questions for ACTIVE rooms (no correct answer included for students)
    if room.status == RoomStatus.ACTIVE:
        questions = list(
            Question.objects
            .filter(assessment=room.assessment)
            .prefetch_related("options")
            .order_by("order")
        )
        is_host = (user.role in ("TEACHER", "PRINCIPAL", "ADMIN"))
        data["questions"] = [
            {
                "id":      q.id,
                "text":    q.text,
                "marks":   q.marks,
                "order":   q.order,
                "options": [
                    {
                        "id":         opt.id,
                        "text":       opt.text,
                        # is_correct only sent to host (teacher)
                        **({"is_correct": opt.is_correct} if is_host else {}),
                    }
                    for opt in q.options.all()
                ],
            }
            for q in questions
        ]

    return JsonResponse(data)


# ─────────────────────────────────────────────────────────────────────────────
# JOIN room — POST /api/v1/competitions/<id>/join/
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def join_room(request, room_id):
    user = request.user
    if user.role != "STUDENT":
        return JsonResponse({"error": "Only students can join rooms"}, status=403)

    room    = get_object_or_404(CompetitionRoom, id=room_id)
    section = getattr(user, "section", None)

    if not section or room.section_id != section.id:
        return JsonResponse({"error": "You are not in this section"}, status=403)
    if room.status == RoomStatus.FINISHED:
        return JsonResponse({"error": "This competition has ended"}, status=400)

    participant, created = CompetitionParticipant.objects.get_or_create(
        room=room, student=user
    )
    if created:
        logger.info("Student %s joined competition room %s", user.id, room.id)

    return JsonResponse({
        "joined":    True,
        "room_id":   room.id,
        "room_title": room.title,
        "status":    room.status,
    })


# ─────────────────────────────────────────────────────────────────────────────
# START room — POST /api/v1/competitions/<id>/start/
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def start_room(request, room_id):
    room = get_object_or_404(CompetitionRoom, id=room_id)
    if room.host_id != request.user.id and request.user.role not in ("PRINCIPAL", "ADMIN"):
        return JsonResponse({"error": "Only the host can start this room"}, status=403)
    if room.status != RoomStatus.DRAFT:
        return JsonResponse({"error": f"Room is already {room.status}"}, status=400)

    question_count = Question.objects.filter(assessment=room.assessment).count()
    if question_count == 0:
        return JsonResponse({"error": "Assessment has no questions"}, status=400)

    room.status     = RoomStatus.ACTIVE
    room.started_at = timezone.now()
    room.save(update_fields=["status", "started_at"])

    # Notify all participants via Ably
    _publish_ably_event(
        f"competition:{room.id}",
        "room:started",
        {"room_id": room.id, "question_count": question_count},
    )
    logger.info("CompetitionRoom %s started by user %s", room.id, request.user.id)
    return JsonResponse({"status": "active", "question_count": question_count})


# ─────────────────────────────────────────────────────────────────────────────
# FINISH room — POST /api/v1/competitions/<id>/finish/
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def finish_room(request, room_id):
    room = get_object_or_404(CompetitionRoom, id=room_id)
    if room.host_id != request.user.id and request.user.role not in ("PRINCIPAL", "ADMIN"):
        return JsonResponse({"error": "Only the host can end this room"}, status=403)
    if room.status != RoomStatus.ACTIVE:
        return JsonResponse({"error": "Room is not active"}, status=400)

    room.status      = RoomStatus.FINISHED
    room.finished_at = timezone.now()
    room.save(update_fields=["status", "finished_at"])

    leaderboard = _recalculate_leaderboard(room)
    _publish_ably_event(
        f"competition:{room.id}",
        "room:finished",
        {"room_id": room.id, "leaderboard": leaderboard},
    )
    logger.info("CompetitionRoom %s finished by user %s", room.id, request.user.id)
    return JsonResponse({"status": "finished", "leaderboard": leaderboard})


# ─────────────────────────────────────────────────────────────────────────────
# SUBMIT ANSWER — POST /api/v1/competitions/<id>/answer/
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def submit_answer(request, room_id):
    user = request.user
    if user.role != "STUDENT":
        return JsonResponse({"error": "Only students can submit answers"}, status=403)

    room = get_object_or_404(CompetitionRoom, id=room_id)
    if room.status != RoomStatus.ACTIVE:
        return JsonResponse({"error": "Room is not active"}, status=400)

    # Verify student is a participant
    try:
        participant = CompetitionParticipant.objects.get(room=room, student=user)
    except CompetitionParticipant.DoesNotExist:
        return JsonResponse({"error": "You have not joined this room"}, status=403)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    question_id = body.get("question_id")
    option_id   = body.get("option_id")

    if not question_id or not option_id:
        return JsonResponse({"error": "question_id and option_id are required"}, status=400)

    question = get_object_or_404(Question, id=question_id, assessment=room.assessment)
    option   = get_object_or_404(QuestionOption, id=option_id, question=question)

    with transaction.atomic():
        answer, created = CompetitionAnswer.objects.get_or_create(
            room=room, student=user, question=question,
            defaults={
                "chosen_option": option,
                "is_correct":    option.is_correct,
                "marks_earned":  question.marks if option.is_correct else 0,
            },
        )
        if not created:
            # Already answered — ignore (first answer counts)
            return JsonResponse({"accepted": False, "reason": "Already answered"})

    # Recalculate and broadcast updated leaderboard
    leaderboard = _recalculate_leaderboard(room)
    _publish_ably_event(
        f"competition:{room.id}",
        "room:scores",
        {"leaderboard": leaderboard},
    )

    return JsonResponse({
        "accepted":     True,
        "question_id":  question_id,
        # Never send is_correct — student gets feedback from leaderboard only
    })


# ─────────────────────────────────────────────────────────────────────────────
# ABLY TOKEN — POST /api/v1/realtime/token/
# Returns a short-lived Ably token request for the requesting user.
#
# Uses the Ably REST API directly (requests lib) because the Ably Python v3
# SDK uses async/await throughout — incompatible with sync Django views.
# Ably token request endpoint: POST https://rest.ably.io/keys/{key_name}/requestToken
#
# Channel scope:
#   STUDENT (competition) → subscribe competition:{room_id}
#   STUDENT (chat)        → publish+subscribe [chat]{section_id}
#   TEACHER/ADMIN (comp)  → publish+subscribe competition:*
#   TEACHER/ADMIN (chat)  → publish+subscribe [chat]*
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def ably_token(request):
    import requests as http_requests
    import base64
    import time

    api_key = getattr(settings, "ABLY_API_KEY", "").strip()
    if not api_key:
        return JsonResponse({"error": "Real-time not configured"}, status=503)

    # api_key format: "keyName:keySecret"
    if ":" not in api_key:
        logger.error("ABLY_API_KEY format invalid — expected keyName:keySecret")
        return JsonResponse({"error": "Real-time misconfigured"}, status=503)

    key_name, key_secret = api_key.split(":", 1)

    try:
        body = json.loads(request.body) if request.body else {}
    except (json.JSONDecodeError, ValueError):
        body = {}

    room_id      = body.get("room_id")
    channel_type = body.get("channel_type", "competition")  # "competition" or "chat"
    user         = request.user

    # ── Build capability ─────────────────────────────────────────────────
    # All authenticated users subscribe to their own notification channel
    notification_cap = {f"notifications:{user.id}": ["subscribe"]}

    if user.role == "STUDENT":
        if channel_type == "chat":
            # Chat rooms by membership — subscribe to all their chat rooms
            from apps.chatrooms.models import ChatRoomMember
            room_ids = list(
                ChatRoomMember.objects.filter(user=user).values_list("room_id", flat=True)
            )
            capability = {f"chat:{rid}": ["subscribe", "publish"] for rid in room_ids}
        else:
            if not room_id:
                return JsonResponse({"error": "room_id is required for students"}, status=400)
            capability = {f"competition:{room_id}": ["subscribe"]}
    else:
        # TEACHER / PRINCIPAL / OFFICIAL / ADMIN
        if channel_type == "chat":
            capability = {"chat:*": ["subscribe", "publish"]}
        else:
            capability = {"competition:*": ["subscribe", "publish"]}

    # Merge notification capability
    capability.update(notification_cap)

    # ── Request token from Ably REST API ─────────────────────────────────
    # https://ably.com/docs/api/rest-api#request-token
    ttl_ms = 3600 * 1000  # 1 hour

    token_params = {
        "keyName":    key_name,
        "ttl":        ttl_ms,
        "capability": json.dumps(capability),
        "clientId":   str(user.id),
        "timestamp":  int(time.time() * 1000),
    }

    credentials = base64.b64encode(f"{api_key}".encode()).decode()
    url = f"https://rest.ably.io/keys/{key_name}/requestToken"

    try:
        resp = http_requests.post(
            url,
            json=token_params,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type":  "application/json",
            },
            timeout=10,
        )
        resp.raise_for_status()
        token_data = resp.json()

        return JsonResponse({
            "token":      token_data.get("token"),
            "expires":    token_data.get("expires"),
            "client_id":  str(user.id),
            "capability": capability,
        })

    except Exception as exc:
        logger.error("Ably token request failed: %s", exc)
        return JsonResponse({"error": "Could not generate real-time token"}, status=500)
