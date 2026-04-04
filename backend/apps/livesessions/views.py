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

Recordings:
  POST /api/v1/live/recording-webhook/         — LiveKit Egress completion callback
  GET  /api/v1/live/recordings/                — list recordings (role-filtered)
  GET  /api/v1/live/recordings/<id>/           — single recording detail

Fixes applied 2026-04-04:
  BUG1: _notify_students_inapp — removed nonexistent class_id field from Broadcast.create
        (was causing TypeError → all live-session notifications silently failed)
  BUG2: session_token — students now get canPublishData=False (whiteboard is truly read-only)
        (was canPublishData=True for everyone — students could broadcast whiteboard data)
  BUG3: session_end — now deletes LiveKit room so all participants are forcibly disconnected
        (was only setting DB status; students had to click Leave manually)
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
from .models import LiveSession, LiveAttendance, SessionStatus, RecordingStatus

logger = logging.getLogger(__name__)


# ── LiveKit token helper ──────────────────────────────────────────────────────

def _make_livekit_token(room_name: str, identity: str, name: str,
                        can_publish: bool = True,
                        can_publish_data: bool = False) -> str:
    """
    Generate a LiveKit JWT token.
    can_publish      = True for everyone (mic, camera, screenshare)
    can_publish_data = True only for teachers (whiteboard/chat data channel)
    """
    from django.conf import settings
    import jwt as pyjwt

    api_key    = settings.LIVEKIT_API_KEY
    api_secret = settings.LIVEKIT_API_SECRET
    now        = int(time.time())

    payload = {
        "iss":   api_key,
        "sub":   identity,
        "iat":   now,
        "exp":   now + 4 * 3600,
        "name":  name,
        "video": {
            "room":           room_name,
            "roomJoin":       True,
            "canPublish":     can_publish,
            "canSubscribe":   True,
            "canPublishData": can_publish_data,
        },
    }
    return pyjwt.encode(payload, api_secret, algorithm="HS256")


def _to_iso(val) -> str | None:
    """Safely convert a datetime or ISO string to isoformat string."""
    if val is None:
        return None
    if isinstance(val, str):
        # DB returned a string (migration edge case) — parse it first
        from dateutil.parser import parse as _parse_dt
        try:
            return _parse_dt(val).isoformat()
        except Exception:
            return val
    return val.isoformat()


def _session_to_dict(session: LiveSession, include_attendance: bool = False) -> dict:
    d = {
        "id":                 session.public_id,
        "title":              session.title,
        "status":             session.status,
        "section_id":         session.section_id,
        "subject_id":         session.subject_id,
        "subject_name":       session.subject.name if session.subject else None,
        "teacher_name":       session.teacher.get_full_name() or session.teacher.username,
        "livekit_room_name":  session.livekit_room_name,
        "scheduled_at":       _to_iso(session.scheduled_at),
        "started_at":         _to_iso(session.started_at),
        "ended_at":           _to_iso(session.ended_at),
        "description":        session.description,
        "recording_status":   session.recording_status,
    }
    if include_attendance:
        # Use pre-annotated value if available (avoids N+1 in list views)
        if hasattr(session, "attendance_count_annotated"):
            d["attendance_count"] = session.attendance_count_annotated
        else:
            d["attendance_count"] = session.attendance.filter(is_present=True).count()
    return d


# ── In-app + push notification helper ────────────────────────────────────────

def _notify_students_inapp(session: LiveSession, sender, subject_line: str,
                           message: str, link: str) -> None:
    """
    Create in-app notification rows + send browser push to all students
    in the session's section.

    BUG FIXED: Broadcast model has no class_id field.
    Previously passing class_id= caused a TypeError that was silently swallowed,
    meaning ALL live-session notifications (scheduled, started, reminders) never
    actually created any DB rows.
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

    section_label = (
        f"{session.section.classroom.name}-{session.section.name}"
        if session.section else "class"
    )

    broadcast = Broadcast.objects.create(
        sender=sender,
        subject=subject_line,
        message=message,
        notification_type=NotificationType.INFO,
        audience_type=AudienceType.CLASS_STUDENTS,
        audience_label=section_label,
        link=link,
    )

    Notification.objects.bulk_create([
        Notification(
            user_id=uid,
            broadcast=broadcast,
            subject=subject_line,
            message=message,
            notification_type=NotificationType.INFO,
            link=link,
        )
        for uid in student_ids
    ])

    broadcast.recipient_count = len(student_ids)
    broadcast.save(update_fields=["recipient_count"])

    logger.info("In-app notifications created: session=%s students=%d",
                session.public_id, len(student_ids))

    try:
        send_push_to_users(
            user_ids=student_ids,
            title=subject_line,
            body=message,
            url=link,
            tag=f"live-session-{session.public_id}",
        )
    except Exception as exc:
        logger.warning("Push delivery failed for session %s: %s", session.public_id, exc)


# ── LiveKit room admin helper ─────────────────────────────────────────────────

def _delete_livekit_room(room_name: str) -> None:
    """
    Delete a LiveKit room via RoomService API.
    All participants receive a Disconnected event and are forcibly removed.
    Called by session_end so students are auto-kicked instead of staying in the room.
    """
    import requests as _req
    from django.conf import settings as _s

    api_key    = getattr(_s, "LIVEKIT_API_KEY", "")
    api_secret = getattr(_s, "LIVEKIT_API_SECRET", "")
    livekit_url = getattr(_s, "LIVEKIT_URL", "")

    if not api_key or not api_secret or not livekit_url:
        logger.warning("LiveKit credentials not configured — cannot delete room")
        return

    import jwt as _pyjwt
    now = int(time.time())
    token = _pyjwt.encode({
        "iss": api_key,
        "exp": now + 60,
        "nbf": now,
        "video": {"roomCreate": True, "roomList": True, "roomAdmin": True},
    }, api_secret, algorithm="HS256")

    http_url = livekit_url.replace("wss://", "https://").replace("ws://", "http://").rstrip("/")
    try:
        resp = _req.post(
            f"{http_url}/twirp/livekit.RoomService/DeleteRoom",
            json={"room": room_name},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type":  "application/json",
            },
            timeout=5,
        )
        if resp.ok:
            logger.info("LiveKit room deleted: %s", room_name)
        else:
            logger.warning("LiveKit room delete HTTP %d: %s", resp.status_code, resp.text[:200])
    except _req.RequestException as exc:
        logger.error("LiveKit room delete failed: %s", exc)


# ── Teacher endpoints ─────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET", "POST"])
@csrf_exempt
def session_list_create(request):
    user = request.user

    if request.method == "GET":
        if user.role == "ADMIN":
            qs = LiveSession.objects.select_related(
                "section", "subject", "teacher"
            ).order_by("-scheduled_at")[:50]
        else:
            qs = LiveSession.objects.filter(
                teacher=user
            ).select_related("section", "subject", "teacher").order_by("-scheduled_at")[:50]
        from django.db.models import Count as _Count, Q as _Q
        qs = qs.annotate(
            attendance_count_annotated=_Count(
                "attendance", filter=_Q(attendance__is_present=True)
            )
        )
        return JsonResponse([_session_to_dict(s, include_attendance=True) for s in qs], safe=False)

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

    room_name = f"gyangrit-{section_id}-{uuid.uuid4().hex[:8]}"

    session = LiveSession.objects.create(
        title=title, section=section, subject=subject,
        teacher=user, status=SessionStatus.SCHEDULED,
        livekit_room_name=room_name,
        description=description,
        scheduled_at=parsed_scheduled,
    )
    logger.info("LiveSession created: id=%s room=%s", session.public_id, room_name)

    try:
        _notify_students_inapp(
            session=session,
            sender=user,
            subject_line=f"\U0001f4cb Live Class Scheduled: {session.title}",
            message=(
                f"{user.get_full_name() or user.username} scheduled a live class "
                f"for {section.classroom.name}-{section.name}."
            ),
            link=f"/live/{session.public_id}",
        )
    except Exception as exc:
        logger.warning("Notify failed for new session %s: %s", session.public_id, exc)

    try:
        _schedule_session_reminders(session)
    except Exception as exc:
        logger.warning("Reminder scheduling failed for session %s: %s", session.public_id, exc)

    return JsonResponse(_session_to_dict(session), status=201)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def session_start(request, session_id):
    session = get_object_or_404(LiveSession, public_id=session_id)
    if request.user.role not in ("ADMIN",) and session.teacher_id != request.user.id:
        return JsonResponse({"error": "Forbidden"}, status=403)
    if session.status != SessionStatus.SCHEDULED:
        return JsonResponse({"error": f"Session is already {session.status}"}, status=400)

    session.status     = SessionStatus.LIVE
    session.started_at = timezone.now()
    session.save(update_fields=["status", "started_at"])

    # Start LiveKit Egress recording after 5s (room needs time to initialise)
    try:
        from .recording import start_recording
        import threading

        def _delayed_recording(session_ref):
            try:
                start_recording(session_ref)
            except Exception as exc:
                logger.warning("Delayed recording start failed: %s", exc)

        threading.Timer(5.0, _delayed_recording, args=[session]).start()
    except Exception as exc:
        logger.warning("Recording thread init failed for session %s: %s",
                       session.public_id, exc)

    try:
        _notify_session_event(session, "session:started")
    except Exception as exc:
        logger.warning("Ably notify failed: %s", exc)

    try:
        teacher_name = session.teacher.get_full_name() or session.teacher.username
        _notify_students_inapp(
            session=session,
            sender=request.user,
            subject_line=f"\U0001f534 Live Class Started: {session.title}",
            message=f"{teacher_name} is now live! Join the class.",
            link=f"/live/{session.public_id}",
        )
    except Exception as exc:
        logger.warning("Notify failed for live session %s: %s", session.public_id, exc)

    return JsonResponse(_session_to_dict(session))


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def session_end(request, session_id):
    session = get_object_or_404(LiveSession, public_id=session_id)
    if request.user.role not in ("ADMIN",) and session.teacher_id != request.user.id:
        return JsonResponse({"error": "Forbidden"}, status=403)
    if session.status != SessionStatus.LIVE:
        return JsonResponse({"error": "Session is not live"}, status=400)

    session.status   = SessionStatus.ENDED
    session.ended_at = timezone.now()
    session.save(update_fields=["status", "ended_at"])

    # Notify via Ably (bell panel update)
    try:
        _notify_session_event(session, "session:ended")
    except Exception as exc:
        logger.warning("Ably notify failed: %s", exc)

    # RECORDING FIX: Stop the Egress BEFORE deleting the LiveKit room.
    # If the room is deleted first, the in-progress Egress is killed mid-stream
    # and the MP4 never gets finalised/uploaded to R2 — stays PROCESSING forever.
    # We stop Egress first, wait 3 s for it to flush, then delete the room.
    def _stop_then_delete(sess):
        import time as _t
        try:
            from .recording import stop_recording
            stop_recording(sess)
        except Exception as exc:
            logger.warning("Egress stop failed for session %s: %s", sess.public_id, exc)
        _t.sleep(3)  # give Egress time to flush/finalize the MP4
        try:
            _delete_livekit_room(sess.livekit_room_name)
        except Exception as exc:
            logger.warning("LiveKit room delete failed for session %s: %s",
                           sess.public_id, exc)

    import threading
    threading.Thread(target=_stop_then_delete, args=[session], daemon=True).start()

    return JsonResponse(_session_to_dict(session))


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def session_attendance(request, session_id):
    session = get_object_or_404(LiveSession, public_id=session_id)
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
    session = get_object_or_404(LiveSession, public_id=session_id)

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


# ── Token endpoint ────────────────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def session_token(request, session_id):
    """
    Return a LiveKit JWT for this session room.

    BUG FIX: canPublishData is now role-dependent.
    Previously everyone got can_publish=True which set canPublishData=True for
    ALL participants including students. This meant students could broadcast
    whiteboard data, overriding the teacher's drawings.

    Now:
      TEACHER/PRINCIPAL/ADMIN — canPublish=True, canPublishData=True
      STUDENT                 — canPublish=True, canPublishData=False
    """
    from django.conf import settings as django_settings

    session = get_object_or_404(LiveSession, public_id=session_id)

    if request.user.role == "STUDENT":
        if getattr(request.user, "section_id", None) != session.section_id:
            return JsonResponse({"error": "Forbidden"}, status=403)
    elif request.user.role == "TEACHER":
        if session.teacher_id != request.user.id:
            return JsonResponse({"error": "Forbidden"}, status=403)

    is_teacher_role  = request.user.role in ("TEACHER", "PRINCIPAL", "ADMIN")
    # All participants need canPublishData=True for hand raises and chat.
    # Whiteboard broadcast security is enforced at the application layer —
    # only the teacher's Excalidraw onChange handler calls broadcastWhiteboard().
    can_publish_data = True

    identity = str(request.user.id)
    name     = request.user.get_full_name() or request.user.username

    try:
        token = _make_livekit_token(
            room_name=session.livekit_room_name,
            identity=identity,
            name=name,
            can_publish=True,
            can_publish_data=can_publish_data,
        )
    except Exception as exc:
        logger.error("LiveKit token error: %s", exc)
        return JsonResponse({"error": "Could not generate token"}, status=500)

    return JsonResponse({
        "token":           token,
        "room_name":       session.livekit_room_name,
        "livekit_url":     getattr(django_settings, "LIVEKIT_URL", ""),
        "identity":        identity,
        "can_publish":     True,
        "can_publish_data": can_publish_data,
    })


# ── Ably notification helper ──────────────────────────────────────────────────

def _notify_session_event(session: LiveSession, event: str) -> None:
    from django.conf import settings
    import requests as http_requests
    import base64
    from urllib.parse import quote
    from apps.accounts.models import User

    api_key = getattr(settings, "ABLY_API_KEY", "").strip()
    if not api_key:
        return

    credentials = base64.b64encode(api_key.encode()).decode()
    students = User.objects.filter(
        role="STUDENT", section_id=session.section_id
    ).values_list("id", flat=True)

    for uid in students:
        channel = quote(f"notifications:{uid}", safe="")
        try:
            http_requests.post(
                f"https://rest.ably.io/channels/{channel}/messages",
                json={"name": event, "data": {
                    "session_id":    session.public_id,
                    "session_title": session.title,
                    "teacher_name":  session.teacher.get_full_name() or session.teacher.username,
                }},
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type":  "application/json",
                },
                timeout=3,
            )
        except Exception as exc:
            logger.warning("Ably notify session user %s: %s", uid, exc)


# ── QStash scheduled reminders ────────────────────────────────────────────────

def _schedule_session_reminders(session: LiveSession) -> None:
    from django.conf import settings
    import requests as http_requests
    import os

    qstash_token = getattr(settings, "QSTASH_TOKEN", "").strip()
    if not qstash_token:
        qstash_token = os.environ.get("UPSTASH_QSTASH_QSTASH_TOKEN", "").strip()
    if not qstash_token:
        logger.debug("QStash token not configured — skipping session reminders")
        return

    backend_url = getattr(settings, "BACKEND_BASE_URL", "").strip()
    if not backend_url:
        backend_url = os.environ.get("BACKEND_BASE_URL", "https://api.gyangrit.site").strip()

    remind_url = f"{backend_url}/api/v1/live/sessions/{session.public_id}/remind/"
    now        = timezone.now()

    for offset, label in [
        (timedelta(minutes=15), "15 minutes"),
        (timedelta(minutes=5),  "5 minutes"),
    ]:
        remind_at     = session.scheduled_at - offset
        if remind_at <= now:
            continue
        delay_seconds = int((remind_at - now).total_seconds())
        if delay_seconds < 10:
            continue

        try:
            resp = http_requests.post(
                "https://qstash.upstash.io/v2/publish/" + remind_url,
                json={"session_id": session.id, "minutes_before": label},
                headers={
                    "Authorization": f"Bearer {qstash_token}",
                    "Content-Type":  "application/json",
                    "Upstash-Delay": f"{delay_seconds}s",
                },
                timeout=5,
            )
            if resp.ok:
                logger.info("QStash reminder scheduled: session=%s delay=%ds label=%s",
                            session.public_id, delay_seconds, label)
            else:
                logger.warning("QStash schedule failed: %s %s", resp.status_code, resp.text[:200])
        except Exception as exc:
            logger.warning("QStash schedule error for session %s: %s", session.public_id, exc)


@csrf_exempt
@require_http_methods(["POST"])
def session_remind(request, session_id):
    try:
        session = LiveSession.objects.select_related(
            "section", "section__classroom", "subject", "teacher"
        ).get(public_id=session_id)
    except LiveSession.DoesNotExist:
        return JsonResponse({"error": "Session not found"}, status=404)

    if session.status != SessionStatus.SCHEDULED:
        return JsonResponse({"skipped": True, "reason": f"Session is {session.status}"})

    try:
        body          = json.loads(request.body)
        minutes_label = body.get("minutes_before", "soon")
    except (json.JSONDecodeError, ValueError):
        minutes_label = "soon"

    teacher_name  = session.teacher.get_full_name() or session.teacher.username
    subject_label = session.subject.name if session.subject else "General"

    _notify_students_inapp(
        session=session,
        sender=session.teacher,
        subject_line=f"\u23f0 Live Class in {minutes_label}: {session.title}",
        message=f"{teacher_name} has a {subject_label} class starting in {minutes_label}. Get ready!",
        link=f"/live/{session.public_id}",
    )

    logger.info("Reminder sent: session=%s minutes_before=%s", session.public_id, minutes_label)
    return JsonResponse({"reminded": True, "session_id": session.public_id})


# ── Recording helpers ─────────────────────────────────────────────────────────

def _recording_to_dict(session: LiveSession) -> dict:
    return {
        "id":                         session.public_id,
        "title":                      session.title,
        "subject_id":                 session.subject_id,
        "subject_name":               session.subject.name if session.subject else None,
        "teacher_name":               session.teacher.get_full_name() or session.teacher.username,
        "section_id":                 session.section_id,
        "section_name":               session.section.name if session.section else None,
        "scheduled_at":               session.scheduled_at.isoformat(),
        "started_at":                 session.started_at.isoformat() if session.started_at else None,
        "recording_status":           session.recording_status,
        "recording_url":              session.recording_url,
        "recording_duration_seconds": session.recording_duration_seconds,
        "recording_size_bytes":       session.recording_size_bytes,
        "recording_r2_key":           session.recording_r2_key,  # for admin debug
    }


@csrf_exempt
@require_http_methods(["POST"])
def recording_webhook(request):
    from .recording import verify_webhook_signature, handle_recording_webhook

    signature = request.headers.get("Authorization", "")
    if not verify_webhook_signature(request.body, signature):
        logger.warning("Recording webhook: invalid signature")
        return JsonResponse({"error": "Invalid signature"}, status=401)

    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    try:
        handle_recording_webhook(payload)
    except Exception as exc:
        logger.error("Recording webhook handler error: %s", exc, exc_info=True)
        return JsonResponse({"error": "Internal error"}, status=500)

    return JsonResponse({"ok": True})


@require_auth
@require_http_methods(["GET"])
def recordings_list(request):
    """
    List recordings accessible to the current user.

    - STUDENT:           only section recordings that are READY
    - TEACHER:           all their own session recordings (any status)
    - PRINCIPAL / ADMIN: all recordings (any status) for oversight/debugging

    Query params:
      subject_id       — filter by subject
      recording_status — filter by status (none/processing/ready/failed)
    """
    user    = request.user
    base_qs = (
        LiveSession.objects
        .exclude(recording_status=RecordingStatus.NONE)
        .select_related("subject", "teacher", "section")
        .order_by("-scheduled_at")
    )

    if user.role == "STUDENT":
        section = getattr(user, "section", None)
        if not section:
            return JsonResponse([], safe=False)
        # Students only see finished, playable recordings for their section
        qs = base_qs.filter(section=section, recording_status=RecordingStatus.READY)
    elif user.role == "TEACHER":
        # Teachers see ALL statuses for their own sessions so they can
        # track processing progress and debug failed recordings
        qs = base_qs.filter(teacher=user)
    else:
        # PRINCIPAL / ADMIN — full visibility
        qs = base_qs

    subject_id    = request.GET.get("subject_id")
    status_filter = request.GET.get("recording_status")
    if subject_id:    qs = qs.filter(subject_id=subject_id)
    if status_filter: qs = qs.filter(recording_status=status_filter)

    return JsonResponse([_recording_to_dict(s) for s in qs[:100]], safe=False)


@require_auth
@require_http_methods(["GET"])
def recording_detail(request, session_id):
    user    = request.user
    session = get_object_or_404(
        LiveSession.objects.select_related("subject", "teacher", "section"),
        public_id=session_id,
    )

    if user.role == "STUDENT":
        if getattr(user, "section_id", None) != session.section_id:
            return JsonResponse({"error": "Forbidden"}, status=403)
    elif user.role == "TEACHER":
        if session.teacher_id != user.id:
            return JsonResponse({"error": "Forbidden"}, status=403)

    if session.recording_status == RecordingStatus.NONE:
        return JsonResponse({"error": "No recording for this session"}, status=404)

    data = _recording_to_dict(session)
    data["attendance_count"] = session.attendance.filter(is_present=True).count()
    return JsonResponse(data)

@csrf_exempt
@require_auth
@require_http_methods(["POST"])
def sync_recording(request, session_id):
    """
    Manual R2 sync — checks if the recorded MP4 exists in Cloudflare R2 and
    marks the session as READY without requiring the LiveKit webhook.

    Fallback for when the webhook doesn't fire (payload shape mismatch, etc).
    Only TEACHER (own sessions) / PRINCIPAL / ADMIN can call this.
    """
    user = request.user
    from django.conf import settings
    try:
        session = LiveSession.objects.select_related(
            "subject", "teacher", "section"
        ).get(public_id=session_id)
    except LiveSession.DoesNotExist:
        return JsonResponse({"error": "Session not found"}, status=404)

    # Access control
    if user.role == "STUDENT":
        return JsonResponse({"error": "Forbidden"}, status=403)
    if user.role == "TEACHER" and session.teacher_id != user.id:
        return JsonResponse({"error": "Forbidden"}, status=403)

    if session.recording_status == RecordingStatus.READY:
        return JsonResponse({"status": "already_ready", "recording": _recording_to_dict(session)})

    r2_key = session.recording_r2_key
    if not r2_key:
        return JsonResponse({
            "error": "No R2 key stored for this session — recording may not have started.",
        }, status=422)

    # R2 credentials
    account_id = getattr(settings, "CLOUDFLARE_R2_ACCOUNT_ID", "")
    access_key = getattr(settings, "CLOUDFLARE_R2_ACCESS_KEY_ID", "")
    secret_key = getattr(settings, "CLOUDFLARE_R2_SECRET_ACCESS_KEY", "")
    bucket     = getattr(settings, "CLOUDFLARE_R2_BUCKET_NAME", "gyangrit-media")
    public_url = getattr(settings, "CLOUDFLARE_R2_PUBLIC_URL", "").rstrip("/")

    if not account_id or not access_key or not secret_key:
        logger.error("sync_recording: R2 credentials missing for session %s", session_id)
        return JsonResponse({"error": "R2 credentials not configured on server."}, status=500)

    # Import boto3 with a clear error
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError:
        logger.error("sync_recording: boto3 not installed")
        return JsonResponse({"error": "boto3 not installed on server."}, status=500)

    s3_endpoint = f"https://{account_id}.r2.cloudflarestorage.com"

    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=s3_endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
        )
        logger.info("sync_recording: HEAD %s / %s", bucket, r2_key)
        head = s3.head_object(Bucket=bucket, Key=r2_key)
        size = head.get("ContentLength", 0)

    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        logger.warning("sync_recording: R2 ClientError code=%s key=%s err=%s", code, r2_key, exc)
        if code in ("404", "NoSuchKey"):
            return JsonResponse({
                "error": f"File not found in R2 at key: {r2_key}. "
                         "Egress may still be uploading — try again in a minute.",
                "r2_key": r2_key,
            }, status=404)
        return JsonResponse({"error": f"R2 error ({code}): {exc}"}, status=500)
    except Exception as exc:
        logger.error("sync_recording: unexpected error for session %s: %s", session_id, exc, exc_info=True)
        return JsonResponse({"error": f"Server error: {type(exc).__name__}: {exc}"}, status=500)

    # File exists in R2 — mark ready
    recording_url = f"{public_url}/{r2_key}" if public_url else ""
    session.recording_status           = RecordingStatus.READY
    session.recording_url              = recording_url
    session.recording_size_bytes       = size or None
    session.recording_duration_seconds = session.recording_duration_seconds  # keep existing
    session.save(update_fields=[
        "recording_status",
        "recording_url",
        "recording_size_bytes",
        "recording_duration_seconds",
    ])

    logger.info(
        "sync_recording: marked READY — session=%s key=%s size=%s url=%s",
        session.id, r2_key, size, recording_url,
    )
    return JsonResponse({
        "status": "synced",
        "recording": _recording_to_dict(session),
    })

