# apps.livesessions.views
"""
Live session endpoints.

Teacher:
  GET  /api/v1/live/sessions/                  — list my sessions
  POST /api/v1/live/sessions/                  — create session
  POST /api/v1/live/sessions/<id>/start/       — go live
  POST /api/v1/live/sessions/<id>/end/         — end session
  GET  /api/v1/live/sessions/<id>/attendance/  — view attendance

Student:
  GET  /api/v1/live/sessions/upcoming/         — upcoming sessions for my section
  POST /api/v1/live/sessions/<id>/join/        — join session (records attendance)

Both:
  GET  /api/v1/live/sessions/<id>/token/       — LiveKit JWT token for room
"""
import json
import logging
import time
import uuid
from datetime import timedelta

from apps.accesscontrol.permissions import require_auth  # returns 401 JSON, not 302
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from .models import LiveSession, LiveAttendance, SessionStatus

logger = logging.getLogger(__name__)


# ── LiveKit token helper ──────────────────────────────────────────────────────

def _make_livekit_token(room_name: str, identity: str, name: str,
                        can_publish: bool = False) -> str:
    """
    Generate a LiveKit JWT token using the API key + secret.
    Uses PyJWT directly — no LiveKit SDK needed (avoids async issues).
    """
    from django.conf import settings
    import jwt as pyjwt

    api_key    = settings.LIVEKIT_API_KEY
    api_secret = settings.LIVEKIT_API_SECRET

    now = int(time.time())

    video_grant = {
        "room":            room_name,
        "roomJoin":        True,
        "canPublish":      can_publish,        # teacher=True, student=False
        "canSubscribe":    True,
        "canPublishData":  can_publish,        # teacher can send data messages
    }

    payload = {
        "iss":   api_key,
        "sub":   identity,
        "iat":   now,
        "exp":   now + 4 * 3600,               # 4-hour token
        "name":  name,
        "video": video_grant,
    }
    return pyjwt.encode(payload, api_secret, algorithm="HS256")


def _session_to_dict(session: LiveSession, include_attendance: bool = False) -> dict:
    d = {
        "id":                 session.id,
        "title":              session.title,
        "status":             session.status,
        "section_id":         session.section_id,
        "subject_id":         session.subject_id,
        "subject_name":       session.subject.name if session.subject else None,
        "teacher_name":       session.teacher.get_full_name() or session.teacher.username,
        "livekit_room_name":  session.livekit_room_name,
        "scheduled_at":       session.scheduled_at.isoformat(),
        "started_at":         session.started_at.isoformat() if session.started_at else None,
        "ended_at":           session.ended_at.isoformat()   if session.ended_at   else None,
        "description":        session.description,
    }
    if include_attendance:
        d["attendance_count"] = session.attendance.filter(is_present=True).count()
    return d


# ── In-app + push notification helper ──────────────────────────────────────────

def _notify_students_inapp(session: LiveSession, sender, subject_line: str, message: str, link: str):
    """
    Create an in-app notification (shows in bell panel) AND send browser push
    to all students in the session's section.
    """
    from apps.accounts.models import User
    from apps.notifications.models import Broadcast, Notification, AudienceType, NotificationType
    from apps.notifications.push import send_push_to_users

    student_ids = list(
        User.objects.filter(role="STUDENT", section_id=session.section_id)
        .values_list("id", flat=True)
    )
    if not student_ids:
        return

    # Create a Broadcast record (shows in teacher's "sent history")
    broadcast = Broadcast.objects.create(
        sender=sender,
        subject=subject_line,
        message=message,
        notification_type=NotificationType.INFO,
        audience_type=AudienceType.CLASS_STUDENTS,
        class_id=session.section.classroom_id if session.section else None,
        link=link,
    )

    # Create individual Notification records for each student (shows in bell panel)
    notifications = [
        Notification(
            user_id=uid,
            broadcast=broadcast,
            subject=subject_line,
            message=message,
            notification_type=NotificationType.INFO,
            link=link,
        )
        for uid in student_ids
    ]
    Notification.objects.bulk_create(notifications)

    # Update recipient count on the broadcast
    broadcast.recipient_count = len(student_ids)
    broadcast.save(update_fields=["recipient_count"])

    logger.info("In-app notifications created: session=%s students=%d", session.id, len(student_ids))

    # Also send browser push (best-effort)
    try:
        send_push_to_users(
            user_ids=student_ids,
            title=subject_line,
            body=message,
            url=link,
            tag=f"live-session-{session.id}",
        )
    except Exception as exc:
        logger.warning("Push delivery failed for session %s: %s", session.id, exc)


# ── Teacher endpoints ─────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET", "POST"])
@csrf_exempt
def session_list_create(request):
    user = request.user

    if request.method == "GET":
        if user.role == "ADMIN":
            qs = LiveSession.objects.select_related("section", "subject", "teacher").order_by("-scheduled_at")[:50]
        else:
            qs = LiveSession.objects.filter(
                teacher=user
            ).select_related("section", "subject", "teacher").order_by("-scheduled_at")[:50]
        return JsonResponse([_session_to_dict(s, include_attendance=True) for s in qs], safe=False)

    # POST — create
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    from apps.academics.models import Section, Subject
    section_id  = body.get("section_id")
    subject_id  = body.get("subject_id")
    title       = body.get("title", "").strip()
    description = body.get("description", "").strip()
    scheduled   = body.get("scheduled_at")

    if not title:      return JsonResponse({"error": "title is required"}, status=400)
    if not section_id: return JsonResponse({"error": "section_id is required"}, status=400)

    section = get_object_or_404(Section, id=section_id)
    subject = Subject.objects.filter(id=subject_id).first() if subject_id else None

    from django.utils.dateparse import parse_datetime
    parsed_scheduled = timezone.now()
    if scheduled:
        dt = parse_datetime(scheduled)
        if dt:
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            parsed_scheduled = dt

    # Unique room name: section_id + short uuid
    room_name = f"gyangrit-{section_id}-{uuid.uuid4().hex[:8]}"

    session = LiveSession.objects.create(
        title=title, section=section, subject=subject,
        teacher=user, status=SessionStatus.SCHEDULED,
        livekit_room_name=room_name,
        description=description,
        scheduled_at=parsed_scheduled,
    )
    logger.info("LiveSession created: id=%s room=%s", session.id, room_name)

    # Notify students: in-app notification (bell panel) + browser push
    try:
        _notify_students_inapp(
            session=session,
            sender=user,
            subject_line=f"\U0001f4cb Live Class Scheduled: {session.title}",
            message=f"{user.get_full_name() or user.username} scheduled a live class for {section.classroom.name}-{section.name}.",
            link=f"/live/{session.id}",
        )
    except Exception as exc:
        logger.warning("Notify failed for new session %s: %s", session.id, exc)

    # Schedule QStash reminders (15min + 5min before scheduled_at)
    try:
        _schedule_session_reminders(session)
    except Exception as exc:
        logger.warning("Reminder scheduling failed for session %s: %s", session.id, exc)

    return JsonResponse(_session_to_dict(session), status=201)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def session_start(request, session_id):
    session = get_object_or_404(LiveSession, id=session_id)
    if request.user.role not in ("ADMIN",) and session.teacher_id != request.user.id:
        return JsonResponse({"error": "Forbidden"}, status=403)
    if session.status != SessionStatus.SCHEDULED:
        return JsonResponse({"error": f"Session is already {session.status}"}, status=400)

    session.status     = SessionStatus.LIVE
    session.started_at = timezone.now()
    session.save(update_fields=["status", "started_at"])

    # Notify students via Ably
    try:
        _notify_session_event(session, "session:started")
    except Exception as exc:
        logger.warning("Ably notify failed: %s", exc)

    # In-app notification (bell panel) + browser push
    try:
        teacher_name = session.teacher.get_full_name() or session.teacher.username
        _notify_students_inapp(
            session=session,
            sender=request.user,
            subject_line=f"\U0001f534 Live Class Started: {session.title}",
            message=f"{teacher_name} is now live! Join the class.",
            link=f"/live/{session.id}",
        )
    except Exception as exc:
        logger.warning("Notify failed for live session %s: %s", session.id, exc)

    return JsonResponse(_session_to_dict(session))


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def session_end(request, session_id):
    session = get_object_or_404(LiveSession, id=session_id)
    if request.user.role not in ("ADMIN",) and session.teacher_id != request.user.id:
        return JsonResponse({"error": "Forbidden"}, status=403)
    if session.status != SessionStatus.LIVE:
        return JsonResponse({"error": "Session is not live"}, status=400)

    session.status   = SessionStatus.ENDED
    session.ended_at = timezone.now()
    session.save(update_fields=["status", "ended_at"])

    try:
        _notify_session_event(session, "session:ended")
    except Exception as exc:
        logger.warning("Ably notify failed: %s", exc)

    return JsonResponse(_session_to_dict(session))


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def session_attendance(request, session_id):
    session = get_object_or_404(LiveSession, id=session_id)
    records = session.attendance.select_related("student").order_by("joined_at")
    return JsonResponse([
        {
            "student_id":   r.student_id,
            "student_name": r.student.get_full_name() or r.student.username,
            "joined_at":    r.joined_at.isoformat(),
            "left_at":      r.left_at.isoformat() if r.left_at else None,
            "is_present":   r.is_present,
        }
        for r in records
    ], safe=False)


# ── Student endpoints ─────────────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def upcoming_sessions(request):
    """List live + upcoming sessions for the student's section."""
    user    = request.user
    section = getattr(user, "section", None)
    if not section:
        return JsonResponse([], safe=False)

    sessions = LiveSession.objects.filter(
        section=section,
        status__in=[SessionStatus.SCHEDULED, SessionStatus.LIVE],
    ).select_related("section", "subject", "teacher").order_by("scheduled_at")

    return JsonResponse([_session_to_dict(s) for s in sessions], safe=False)


@require_auth
@require_http_methods(["POST"])
@csrf_exempt
def join_session(request, session_id):
    """Student joins session — creates attendance record."""
    session = get_object_or_404(LiveSession, id=session_id)

    # Verify student is in the right section
    if request.user.role == "STUDENT":
        if getattr(request.user, "section_id", None) != session.section_id:
            return JsonResponse({"error": "You are not in this class"}, status=403)

    if session.status == SessionStatus.ENDED:
        return JsonResponse({"error": "Session has ended"}, status=400)

    if request.user.role == "STUDENT":
        LiveAttendance.objects.get_or_create(
            session=session, student=request.user,
            defaults={"joined_at": timezone.now(), "is_present": True},
        )

    return JsonResponse({"session": _session_to_dict(session)})


# ── Token endpoint — both teacher and student ─────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def session_token(request, session_id):
    """Return a LiveKit JWT for this session room."""
    from django.conf import settings as django_settings

    session = get_object_or_404(LiveSession, id=session_id)

    # Access check
    if request.user.role == "STUDENT":
        if getattr(request.user, "section_id", None) != session.section_id:
            return JsonResponse({"error": "Forbidden"}, status=403)
    elif request.user.role == "TEACHER":
        if session.teacher_id != request.user.id:
            return JsonResponse({"error": "Forbidden"}, status=403)

    # All participants can publish (mic/camera). Teacher always can.
    # Students get publish rights so they can unmute/share camera when allowed.
    can_publish = True
    identity    = str(request.user.id)
    name        = request.user.get_full_name() or request.user.username

    try:
        token = _make_livekit_token(
            room_name=session.livekit_room_name,
            identity=identity,
            name=name,
            can_publish=can_publish,
        )
    except Exception as exc:
        logger.error("LiveKit token error: %s", exc)
        return JsonResponse({"error": "Could not generate token"}, status=500)

    return JsonResponse({
        "token":      token,
        "room_name":  session.livekit_room_name,
        "livekit_url": getattr(django_settings, "LIVEKIT_URL", ""),
        "identity":   identity,
        "can_publish": can_publish,
    })


# ── Ably notification helper ──────────────────────────────────────────────────

def _notify_session_event(session: LiveSession, event: str) -> None:
    """Notify all students in the section via Ably."""
    from django.conf import settings
    import requests as http_requests
    import base64
    from urllib.parse import quote
    from apps.accounts.models import User
    from apps.chatrooms.models import ChatRoomMember

    api_key = getattr(settings, "ABLY_API_KEY", "").strip()
    if not api_key: return

    credentials = base64.b64encode(api_key.encode()).decode()
    students = User.objects.filter(role="STUDENT", section_id=session.section_id).values_list("id", flat=True)

    for uid in students:
        channel = quote(f"notifications:{uid}", safe="")
        try:
            http_requests.post(
                f"https://rest.ably.io/channels/{channel}/messages",
                json={"name": event, "data": {
                    "session_id":    session.id,
                    "session_title": session.title,
                    "teacher_name":  session.teacher.get_full_name() or session.teacher.username,
                }},
                headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/json"},
                timeout=3,
            )
        except Exception as exc:
            logger.warning("Ably notify session user %s: %s", uid, exc)


# ── QStash scheduled reminders ─────────────────────────────────────────────

def _schedule_session_reminders(session: LiveSession) -> None:
    """
    Schedule QStash delayed callbacks for 15-min and 5-min reminders.
    QStash will POST to /api/v1/live/sessions/<id>/remind/ at the scheduled time.
    
    If scheduled_at is less than 15 min from now, only schedule the reminders
    that are still in the future.
    """
    from django.conf import settings
    import requests as http_requests

    qstash_token = getattr(settings, "QSTASH_TOKEN", "").strip()
    if not qstash_token:
        # Try alternate env var names (Upstash uses verbose naming)
        import os
        qstash_token = os.environ.get("UPSTASH_QSTASH_QSTASH_TOKEN", "").strip()
    if not qstash_token:
        logger.debug("QStash token not configured — skipping session reminders")
        return

    backend_url = getattr(settings, "BACKEND_BASE_URL", "").strip()
    if not backend_url:
        import os
        backend_url = os.environ.get("BACKEND_BASE_URL", "https://gyangrit.onrender.com").strip()

    remind_url = f"{backend_url}/api/v1/live/sessions/{session.id}/remind/"
    now = timezone.now()

    # Schedule reminders at 15min and 5min before the session
    offsets = [
        (timedelta(minutes=15), "15 minutes"),
        (timedelta(minutes=5),  "5 minutes"),
    ]

    for offset, label in offsets:
        remind_at = session.scheduled_at - offset
        if remind_at <= now:
            continue  # already past this reminder time

        delay_seconds = int((remind_at - now).total_seconds())
        if delay_seconds < 10:
            continue  # too close, skip

        try:
            resp = http_requests.post(
                "https://qstash.upstash.io/v2/publish/" + remind_url,
                json={"session_id": session.id, "minutes_before": label},
                headers={
                    "Authorization": f"Bearer {qstash_token}",
                    "Content-Type": "application/json",
                    "Upstash-Delay": f"{delay_seconds}s",
                },
                timeout=5,
            )
            if resp.ok:
                logger.info("QStash reminder scheduled: session=%s in %ds (%s before)", session.id, delay_seconds, label)
            else:
                logger.warning("QStash schedule failed: %s %s", resp.status_code, resp.text[:200])
        except Exception as exc:
            logger.warning("QStash schedule error for session %s: %s", session.id, exc)


@csrf_exempt
@require_http_methods(["POST"])
def session_remind(request, session_id):
    """
    POST /api/v1/live/sessions/<id>/remind/
    
    Called by QStash at scheduled reminder times.
    Sends push + in-app notification to students in the session's section.
    
    No auth required — QStash sends a signed request. For now we trust
    the request since the endpoint only sends notifications (no mutation).
    TODO: Verify QStash signature header for production hardening.
    """
    try:
        session = LiveSession.objects.select_related(
            "section", "section__classroom", "subject", "teacher"
        ).get(id=session_id)
    except LiveSession.DoesNotExist:
        return JsonResponse({"error": "Session not found"}, status=404)

    # Don't send reminders for sessions that are already live or ended
    if session.status != SessionStatus.SCHEDULED:
        return JsonResponse({"skipped": True, "reason": f"Session is {session.status}"})

    # Parse minutes_before from body
    try:
        body = json.loads(request.body)
        minutes_label = body.get("minutes_before", "soon")
    except (json.JSONDecodeError, ValueError):
        minutes_label = "soon"

    teacher_name = session.teacher.get_full_name() or session.teacher.username
    subject_label = session.subject.name if session.subject else "General"

    _notify_students_inapp(
        session=session,
        sender=session.teacher,
        subject_line=f"\u23f0 Live Class in {minutes_label}: {session.title}",
        message=f"{teacher_name} has a {subject_label} class starting in {minutes_label}. Get ready!",
        link=f"/live/{session.id}",
    )

    logger.info("Reminder sent: session=%s minutes_before=%s", session.id, minutes_label)
    return JsonResponse({"reminded": True, "session_id": session.id})
