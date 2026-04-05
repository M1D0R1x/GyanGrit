# apps.analytics.views
"""
Analytics endpoints for engagement tracking.

Endpoints:
  POST /api/v1/analytics/heartbeat/            — student sends a heartbeat (lesson/session view)
  POST /api/v1/analytics/event/                — log a one-shot event (assessment, ai_chat)
  GET  /api/v1/analytics/my-summary/           — student's own daily summaries
  GET  /api/v1/analytics/my-risk/              — student's own risk score
  GET  /api/v1/analytics/class-summary/        — teacher/admin: class-level aggregation
"""
import json
import logging
from datetime import date, timedelta

from apps.accesscontrol.permissions import require_auth, require_roles
from django.core.cache import cache
from django.db.models import Sum, Count, F
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import EngagementEvent, DailyEngagementSummary, EventType

logger = logging.getLogger(__name__)

HEARTBEAT_SECONDS = 30  # each heartbeat represents 30s of active viewing
_CLASS_SUMMARY_TTL = 5 * 60   # 5 min — short because heartbeats update it live
_RISK_TTL          = 60 * 60  # 1 hour — updated on each assessment submit via signal


# ── Heartbeat (student sends every 30s while viewing lesson / in live session) ─

@require_auth
@require_http_methods(["POST"])
@csrf_exempt
def heartbeat(request):
    """
    POST /api/v1/analytics/heartbeat/
    Body: { "event_type": "lesson_view"|"live_session"|"flashcard_study",
            "resource_id": 123,
            "resource_label": "Math Lesson 1" }

    Called by the frontend every 30 seconds while the student is actively
    viewing content. Each call creates or updates an EngagementEvent for
    today, incrementing duration_seconds by HEARTBEAT_SECONDS.

    Uses get_or_create on (user, event_type, resource_id, event_date) to
    accumulate time into a single row per resource per day, rather than
    creating a new row every 30 seconds.
    """
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    event_type = body.get("event_type", "").strip()
    resource_id = body.get("resource_id")
    resource_label = body.get("resource_label", "")[:200]

    valid_heartbeat_types = {EventType.LESSON_VIEW, EventType.LIVE_SESSION, EventType.FLASHCARD_STUDY}
    if event_type not in valid_heartbeat_types:
        return JsonResponse({"error": f"Invalid event_type for heartbeat. Use one of: {sorted(valid_heartbeat_types)}"}, status=400)

    if not resource_id:
        return JsonResponse({"error": "resource_id is required"}, status=400)

    today = timezone.now().date()

    event, created = EngagementEvent.objects.get_or_create(
        user=request.user,
        event_type=event_type,
        resource_id=resource_id,
        event_date=today,
        defaults={
            "resource_label": resource_label,
            "duration_seconds": HEARTBEAT_SECONDS,
        },
    )

    if not created:
        # Accumulate — add 30 seconds
        event.duration_seconds = F("duration_seconds") + HEARTBEAT_SECONDS
        if resource_label and not event.resource_label:
            event.resource_label = resource_label
        event.save(update_fields=["duration_seconds", "resource_label"])

    return JsonResponse({"recorded": True})


# ── One-shot event (assessment completion, AI chat message) ────────────────────

@require_auth
@require_http_methods(["POST"])
@csrf_exempt
def log_event(request):
    """
    POST /api/v1/analytics/event/
    Body: { "event_type": "assessment"|"ai_chat",
            "resource_id": 123,
            "resource_label": "Math Quiz 1",
            "duration_seconds": 180 }

    For one-shot events that don't use heartbeats.
    Each call creates a new EngagementEvent row.
    """
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    event_type = body.get("event_type", "").strip()
    resource_id = body.get("resource_id")
    resource_label = body.get("resource_label", "")[:200]
    duration = body.get("duration_seconds", 0)

    valid_event_types = {
        EventType.ASSESSMENT, EventType.AI_CHAT,
        EventType.LESSON_COMPLETE, EventType.ASSESSMENT_PASS, EventType.ASSESSMENT_FAIL,
        EventType.LOGIN, EventType.RECORDING_VIEW, EventType.CHATROOM_MSG,
        EventType.COMPETITION, EventType.STREAK_BREAK, EventType.NOTIFICATION_CLICK,
        EventType.PAGE_VISIT
    }
    if event_type not in valid_event_types:
        return JsonResponse({"error": f"Invalid event_type. Use one of: {sorted(valid_event_types)}"}, status=400)

    try:
        duration = max(0, int(duration))
    except (TypeError, ValueError):
        duration = 0

    EngagementEvent.objects.create(
        user=request.user,
        event_type=event_type,
        resource_id=resource_id,
        resource_label=resource_label,
        duration_seconds=duration,
        event_date=timezone.now().date(),
    )

    return JsonResponse({"recorded": True}, status=201)


# ── Student: my own summary ────────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def my_summary(request):
    """
    GET /api/v1/analytics/my-summary/?days=7

    Returns the requesting student's daily engagement for the last N days.
    Aggregated from EngagementEvent rows (lazy — no pre-aggregation needed
    for a single student's data).
    """
    try:
        days = min(90, max(1, int(request.GET.get("days", 7))))
    except (ValueError, TypeError):
        days = 7

    since = timezone.now().date() - timedelta(days=days)

    events = (
        EngagementEvent.objects
        .filter(user=request.user, event_date__gte=since)
        .values("event_date", "event_type")
        .annotate(total_seconds=Sum("duration_seconds"), count=Count("id"))
        .order_by("event_date")
    )

    # Group by date
    by_date: dict[str, dict] = {}
    for e in events:
        d = e["event_date"].isoformat()
        if d not in by_date:
            by_date[d] = {"date": d, "lesson_min": 0, "live_min": 0, "assessment_min": 0, "ai_messages": 0, "flashcard_min": 0, "total_min": 0}
        minutes = e["total_seconds"] // 60
        if e["event_type"] == EventType.LESSON_VIEW:
            by_date[d]["lesson_min"] += minutes
        elif e["event_type"] == EventType.LIVE_SESSION:
            by_date[d]["live_min"] += minutes
        elif e["event_type"] == EventType.ASSESSMENT:
            by_date[d]["assessment_min"] += minutes
        elif e["event_type"] == EventType.AI_CHAT:
            by_date[d]["ai_messages"] += e["count"]
        elif e["event_type"] == EventType.FLASHCARD_STUDY:
            by_date[d]["flashcard_min"] += minutes
        by_date[d]["total_min"] = (
            by_date[d]["lesson_min"] + by_date[d]["live_min"] +
            by_date[d]["assessment_min"] + by_date[d]["flashcard_min"]
        )

    return JsonResponse({
        "days": days,
        "summary": sorted(by_date.values(), key=lambda x: x["date"]),
    })


# ── Teacher/Admin: class-level summary ─────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def class_summary(request):
    """
    GET /api/v1/analytics/class-summary/?section_id=5&days=7

    Aggregated engagement per student for a section over the last N days.
    Teachers see only their assigned sections. Admin sees all.
    Cached per section+days for 5 minutes (short TTL since heartbeats update it live).
    """
    from apps.accounts.models import User

    section_id = request.GET.get("section_id")
    class_id = request.GET.get("class_id")
    if not section_id and not class_id:
        return JsonResponse({"error": "section_id or class_id is required"}, status=400)

    try:
        days = min(90, max(1, int(request.GET.get("days", 7))))
    except (ValueError, TypeError):
        days = 7

    # Scope check: teacher can only see their assigned sections/classes
    user = request.user
    if user.role == "TEACHER":
        if section_id and not user.teaching_assignments.filter(section_id=section_id).exists():
            return JsonResponse({"error": "You are not assigned to this section"}, status=403)
        if class_id and not user.teaching_assignments.filter(section__classroom_id=class_id).exists():
             return JsonResponse({"error": "You are not assigned to this class"}, status=403)

    cache_key = f"analytics:class_summary:{class_id or section_id}:{days}"
    cached = cache.get(cache_key)
    if cached is not None:
        return JsonResponse(cached)

    since = timezone.now().date() - timedelta(days=days)

    if section_id:
        students = User.objects.filter(role="STUDENT", section_id=section_id).values("id", "username", "first_name", "last_name")
    else:
        students = User.objects.filter(role="STUDENT", section__classroom_id=class_id).values("id", "username", "first_name", "last_name")

    student_ids = [s["id"] for s in students]

    events = (
        EngagementEvent.objects
        .filter(user_id__in=student_ids, event_date__gte=since)
        .values("user_id", "event_type")
        .annotate(total_seconds=Coalesce(Sum("duration_seconds"), 0), count=Count("id"))
    )

    # Build per-student summary
    student_map = {s["id"]: {
        "user_id": s["id"],
        "username": s["username"],
        "name": f"{s['first_name']} {s['last_name']}".strip() or s["username"],
        "lesson_min": 0, "live_min": 0, "assessment_min": 0, "ai_messages": 0, "flashcard_min": 0, "total_min": 0,
    } for s in students}

    for e in events:
        uid = e["user_id"]
        if uid not in student_map:
            continue
        minutes = e["total_seconds"] // 60
        if e["event_type"] == EventType.LESSON_VIEW:
            student_map[uid]["lesson_min"] += minutes
        elif e["event_type"] == EventType.LIVE_SESSION:
            student_map[uid]["live_min"] += minutes
        elif e["event_type"] == EventType.ASSESSMENT:
            student_map[uid]["assessment_min"] += minutes
        elif e["event_type"] == EventType.AI_CHAT:
            student_map[uid]["ai_messages"] += e["count"]
        elif e["event_type"] == EventType.FLASHCARD_STUDY:
            student_map[uid]["flashcard_min"] += minutes

    for s in student_map.values():
        s["total_min"] = s["lesson_min"] + s["live_min"] + s["assessment_min"] + s["flashcard_min"]

    from .models import StudentRiskScore
    risk_scores = StudentRiskScore.objects.filter(user_id__in=student_ids).values("user_id", "risk_level", "score")
    for r in risk_scores:
        if r["user_id"] in student_map:
            student_map[r["user_id"]]["risk_level"] = r["risk_level"]
            student_map[r["user_id"]]["risk_score"] = r["score"]

    results = sorted(student_map.values(), key=lambda x: -x["total_min"])

    payload = {
        "section_id": int(section_id) if section_id else None,
        "class_id": int(class_id) if class_id else None,
        "days": days,
        "students": results,
    }
    cache.set(cache_key, payload, timeout=_CLASS_SUMMARY_TTL)
    return JsonResponse(payload)


# ── Student: my own risk score ─────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def my_risk(request):
    """
    GET /api/v1/analytics/my-risk/

    Returns the requesting student's risk score and level.
    Cached per-user for 1 hour (risk score updates on each assessment submission via signal).
    Students only — teachers/admins use class-summary.
    """
    user = request.user
    if user.role != "STUDENT":
        return JsonResponse({"error": "Students only"}, status=403)

    cache_key = f"analytics:risk:{user.id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return JsonResponse(cached)

    from .models import StudentRiskScore
    try:
        risk = StudentRiskScore.objects.get(user=user)
        data = {
            "risk_level": risk.risk_level,
            "score":      round(risk.score, 1),
            "factors":    risk.factors,
        }
    except StudentRiskScore.DoesNotExist:
        data = {
            "risk_level": StudentRiskScore.RiskLevel.LOW,
            "score":      0.0,
            "factors":    {},
        }

    cache.set(cache_key, data, timeout=_RISK_TTL)
    return JsonResponse(data)


# ── Nightly risk recompute — called by QStash cron (0 2 * * *) ────────────────

@require_http_methods(["POST"])
@csrf_exempt
def nightly_recompute(request):
    """
    POST /api/v1/analytics/nightly-recompute/

    Triggered nightly at 2 AM IST via QStash schedule (scd_6J2Lypd946oDhWQFW6EoU87hS8T3).
    Recalculates StudentRiskScore for every active student and sends
    At-Risk notifications for students who newly cross into HIGH.

    No auth required — this endpoint only triggers read + upsert computation.
    It is rate-limited by QStash schedule frequency (once/day).
    """
    from django.contrib.auth import get_user_model
    from .models import StudentRiskScore
    from .signals import _recalculate_risk, _notify_teachers_high_risk

    # ── Recompute ─────────────────────────────────────────────────────────────
    User = get_user_model()
    students = (
        User.objects
        .filter(role="STUDENT", is_active=True)
        .only("id", "username", "first_name", "last_name", "section_id")
    )

    updated = 0
    newly_high = 0
    errors = 0

    for student in students:
        try:
            score, risk_level, factors = _recalculate_risk(student)

            prev = StudentRiskScore.objects.filter(user=student).first()
            prev_level = prev.risk_level if prev else StudentRiskScore.RiskLevel.LOW

            StudentRiskScore.objects.update_or_create(
                user=student,
                defaults={"score": score, "risk_level": risk_level, "factors": factors},
            )

            # Bust the cached risk for this student
            cache.delete(f"analytics:risk:{student.id}")

            updated += 1

            # Notify only on transition INTO high — avoid daily spam for chronic high-risk
            if (
                risk_level == StudentRiskScore.RiskLevel.HIGH
                and prev_level != StudentRiskScore.RiskLevel.HIGH
            ):
                _notify_teachers_high_risk(student, factors)
                newly_high += 1

        except Exception as exc:
            logger.warning("nightly_recompute: failed for student %s: %s", student.id, exc)
            errors += 1

    logger.info(
        "nightly_recompute complete: updated=%d newly_high=%d errors=%d",
        updated, newly_high, errors,
    )
    return JsonResponse({
        "ok":         True,
        "updated":    updated,
        "newly_high": newly_high,
        "errors":     errors,
    })
