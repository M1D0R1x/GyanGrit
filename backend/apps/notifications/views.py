# apps.notifications.views
"""
Notification views for GyanGrit.

Endpoints:
  GET  /api/v1/notifications/                       — inbox (all roles)
  GET  /api/v1/notifications/history/               — searchable inbox history (all roles)
  POST /api/v1/notifications/<id>/read/             — mark one read
  POST /api/v1/notifications/read-all/              — mark all read
  POST /api/v1/notifications/send/                  — send broadcast (staff only)
  GET  /api/v1/notifications/sent/                  — sent history (staff only)
  GET  /api/v1/notifications/sent/<id>/             — broadcast detail (staff only)
  GET  /api/v1/notifications/audience-options/      — dropdown data for send form

Filter params (consistent naming across both history endpoints):
  q           — full-text search on subject + message
  type        — notification type (info, announcement, etc.)
  sent_after  — ISO date string, inclusive lower bound  (replaces old "from")
  sent_before — ISO date string, inclusive upper bound  (replaces old "to")
  page        — 1-based page number
  page_size   — items per page (default 20, max 100)
  unread_only — "1" to show only unread (inbox history only)
"""
import json
import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import AudienceType, Broadcast, Notification, NotificationType

User = get_user_model()
logger = logging.getLogger(__name__)

SENDER_ROLES = {"TEACHER", "PRINCIPAL", "OFFICIAL", "ADMIN"}

ROLE_ALLOWED_AUDIENCES = {
    "TEACHER": {
        AudienceType.CLASS_STUDENTS,
        AudienceType.CLASS_TEACHERS,
        AudienceType.CLASS_ALL,
    },
    "PRINCIPAL": {
        AudienceType.CLASS_STUDENTS,
        AudienceType.CLASS_TEACHERS,
        AudienceType.CLASS_ALL,
        AudienceType.SCHOOL_STUDENTS,
        AudienceType.SCHOOL_TEACHERS,
        AudienceType.SCHOOL_ALL,
    },
    "OFFICIAL": {
        AudienceType.SCHOOL_STUDENTS,
        AudienceType.SCHOOL_TEACHERS,
        AudienceType.SCHOOL_ALL,
        AudienceType.DISTRICT_STUDENTS,
        AudienceType.DISTRICT_TEACHERS,
        AudienceType.DISTRICT_PRINCIPALS,
        AudienceType.DISTRICT_ALL,
    },
    "ADMIN": set(AudienceType.values),
}


# ─────────────────────────────────────────────────────────────────────────────
# SHARED HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _serialize_notification(n) -> dict:
    """Serialize a Notification row to the standard inbox shape."""
    return {
        "id":              n.id,
        "subject":         n.subject,
        "message":         n.message,
        "type":            n.notification_type,
        "is_read":         n.is_read,
        "link":            n.link,
        "attachment_url":  n.attachment_url,
        "attachment_name": n.attachment_name,
        "created_at":      n.created_at.isoformat(),
        "sender": (
            n.broadcast.sender.username
            if n.broadcast and n.broadcast.sender
            else "System"
        ),
    }


def _parse_page_params(request, default_size: int = 20, max_size: int = 100):
    """Parse ?page= and ?page_size= safely, returning (page, page_size)."""
    try:
        page = max(1, int(request.GET.get("page", 1)))
    except (ValueError, TypeError):
        page = 1
    try:
        page_size = min(max_size, max(1, int(request.GET.get("page_size", default_size))))
    except (ValueError, TypeError):
        page_size = default_size
    return page, page_size


def _apply_notification_filters(qs, request):
    """
    Apply common search filters to a Notification queryset.
    Used by both list_notifications and notification_history.
    """
    q = request.GET.get("q", "").strip()
    if q:
        qs = qs.filter(Q(subject__icontains=q) | Q(message__icontains=q))

    notif_type = request.GET.get("type", "").strip()
    if notif_type:
        qs = qs.filter(notification_type=notif_type)

    sent_after = request.GET.get("sent_after", "").strip()
    if sent_after:
        parsed = parse_date(sent_after)
        if parsed:
            qs = qs.filter(created_at__date__gte=parsed)

    sent_before = request.GET.get("sent_before", "").strip()
    if sent_before:
        parsed = parse_date(sent_before)
        if parsed:
            qs = qs.filter(created_at__date__lte=parsed)

    return qs


# ─────────────────────────────────────────────────────────────────────────────
# SCOPING HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _get_teacher_classroom(teacher, class_id):
    from apps.academics.models import ClassRoom
    if not class_id:
        raise ValueError("class_id is required for class targeting")
    try:
        classroom = ClassRoom.objects.get(id=class_id)
    except ClassRoom.DoesNotExist:
        raise ValueError("Classroom not found")
    if not teacher.teaching_assignments.filter(section__classroom=classroom).exists():
        raise ValueError("You are not assigned to this classroom")
    return classroom


def _get_classroom_in_scope(sender, class_id):
    from apps.academics.models import ClassRoom
    if not class_id:
        raise ValueError("class_id is required")
    try:
        classroom = ClassRoom.objects.get(id=class_id)
    except ClassRoom.DoesNotExist:
        raise ValueError("Classroom not found")
    if sender.role == "ADMIN" or sender.is_superuser:
        return classroom
    if not sender.institution:
        raise ValueError("No institution assigned")
    if classroom.institution != sender.institution:
        raise ValueError("Classroom is not in your institution")
    return classroom


def _get_institution_in_scope(sender, institution_id):
    from apps.academics.models import Institution
    if sender.role == "ADMIN" or sender.is_superuser:
        if institution_id:
            return get_object_or_404(Institution, id=institution_id)
        # ADMIN sending SCHOOL_* without institution_id = all institutions
        # Return None to signal "all institutions" to callers that support it
        return None
    if sender.role == "OFFICIAL":
        if institution_id:
            inst = get_object_or_404(Institution, id=institution_id)
            if inst.district.name != sender.district:
                raise ValueError("Institution is not in your district")
            return inst
        raise ValueError("institution_id is required")
    if not sender.institution:
        raise ValueError("No institution assigned")
    return sender.institution


def _get_district_for_sender(sender):
    if sender.role == "ADMIN" or sender.is_superuser:
        # ADMIN district broadcasts go to all districts when district not set
        return sender.district or None
    if not sender.district:
        raise ValueError("No district assigned to your account")
    return sender.district


def _resolve_recipients(sender, audience_type, class_id=None, institution_id=None):
    """
    Returns (list of User, audience_label string).
    Raises ValueError if the scope is invalid for this sender.
    """
    role = sender.role

    if audience_type == AudienceType.CLASS_STUDENTS:
        classroom = (
            _get_teacher_classroom(sender, class_id)
            if role == "TEACHER"
            else _get_classroom_in_scope(sender, class_id)
        )
        qs = User.objects.filter(role="STUDENT", section__classroom=classroom)
        return list(qs), f"Class {classroom.name} — Students"

    if audience_type == AudienceType.CLASS_TEACHERS:
        classroom = (
            _get_teacher_classroom(sender, class_id)
            if role == "TEACHER"
            else _get_classroom_in_scope(sender, class_id)
        )
        qs = User.objects.filter(
            role="TEACHER",
            teaching_assignments__section__classroom=classroom,
        ).distinct()
        return list(qs), f"Class {classroom.name} — Teachers"

    if audience_type == AudienceType.CLASS_ALL:
        classroom = (
            _get_teacher_classroom(sender, class_id)
            if role == "TEACHER"
            else _get_classroom_in_scope(sender, class_id)
        )
        student_ids = list(
            User.objects.filter(role="STUDENT", section__classroom=classroom)
            .values_list("id", flat=True)
        )
        teacher_ids = list(
            User.objects.filter(
                role="TEACHER",
                teaching_assignments__section__classroom=classroom,
            ).distinct().values_list("id", flat=True)
        )
        combined = list(set(student_ids + teacher_ids))
        qs = User.objects.filter(id__in=combined)
        return list(qs), f"Class {classroom.name} — Everyone"

    if audience_type == AudienceType.SCHOOL_STUDENTS:
        inst = _get_institution_in_scope(sender, institution_id)
        qs = (
            User.objects.filter(role="STUDENT")
            if inst is None
            else User.objects.filter(role="STUDENT", institution=inst)
        )
        label = "All Schools — Students" if inst is None else f"{inst.name} — Students"
        return list(qs), label

    if audience_type == AudienceType.SCHOOL_TEACHERS:
        inst = _get_institution_in_scope(sender, institution_id)
        qs = (
            User.objects.filter(role="TEACHER")
            if inst is None
            else User.objects.filter(role="TEACHER", institution=inst)
        )
        label = "All Schools — Teachers" if inst is None else f"{inst.name} — Teachers"
        return list(qs), label

    if audience_type == AudienceType.SCHOOL_ALL:
        inst = _get_institution_in_scope(sender, institution_id)
        qs = (
            User.objects.filter(role__in=["STUDENT", "TEACHER", "PRINCIPAL"])
            if inst is None
            else User.objects.filter(
                institution=inst, role__in=["STUDENT", "TEACHER", "PRINCIPAL"]
            )
        )
        label = "All Schools — Everyone" if inst is None else f"{inst.name} — Everyone"
        return list(qs), label

    if audience_type == AudienceType.DISTRICT_STUDENTS:
        district = _get_district_for_sender(sender)
        qs = (
            User.objects.filter(role="STUDENT")
            if district is None
            else User.objects.filter(role="STUDENT", institution__district__name=district)
        )
        label = "All Districts — Students" if district is None else f"{district} District — Students"
        return list(qs), label

    if audience_type == AudienceType.DISTRICT_TEACHERS:
        district = _get_district_for_sender(sender)
        qs = (
            User.objects.filter(role="TEACHER")
            if district is None
            else User.objects.filter(role="TEACHER", institution__district__name=district)
        )
        label = "All Districts — Teachers" if district is None else f"{district} District — Teachers"
        return list(qs), label

    if audience_type == AudienceType.DISTRICT_PRINCIPALS:
        district = _get_district_for_sender(sender)
        qs = (
            User.objects.filter(role="PRINCIPAL")
            if district is None
            else User.objects.filter(role="PRINCIPAL", institution__district__name=district)
        )
        label = "All Districts — Principals" if district is None else f"{district} District — Principals"
        return list(qs), label

    if audience_type == AudienceType.DISTRICT_ALL:
        district = _get_district_for_sender(sender)
        qs = (
            User.objects.filter(role__in=["STUDENT", "TEACHER", "PRINCIPAL"])
            if district is None
            else User.objects.filter(
                role__in=["STUDENT", "TEACHER", "PRINCIPAL"],
                institution__district__name=district,
            )
        )
        label = "All Districts — Everyone" if district is None else f"{district} District — Everyone"
        return list(qs), label

    if audience_type == AudienceType.SYSTEM:
        if sender.role != "ADMIN" and not sender.is_superuser:
            raise ValueError("Only ADMIN can send system-wide notifications")
        # Include ALL users — including the sender (we exclude sender after)
        qs = User.objects.all()
        return list(qs), "System-wide (all users)"

    raise ValueError(f"Unknown audience type: {audience_type}")


# ─────────────────────────────────────────────────────────────────────────────
# INBOX ENDPOINTS — available to ALL authenticated users
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def list_notifications(request):
    """
    GET /api/v1/notifications/

    Quick inbox — 20 most recent notifications + unread count.
    Used by NotificationPanel (bell dropdown).
    Supports ?type= and ?unread_only=1 filters.
    """
    qs = (
        Notification.objects
        .filter(user=request.user)
        .select_related("broadcast__sender")
    )

    notif_type = request.GET.get("type", "").strip()
    if notif_type:
        qs = qs.filter(notification_type=notif_type)

    if request.GET.get("unread_only") == "1":
        qs = qs.filter(is_read=False)

    notifications = qs[:20]
    unread_count  = Notification.objects.filter(user=request.user, is_read=False).count()

    return JsonResponse({
        "unread":        unread_count,
        "notifications": [_serialize_notification(n) for n in notifications],
    })


@login_required
@require_http_methods(["GET"])
def notification_history(request):
    """
    GET /api/v1/notifications/history/

    Full searchable inbox history — available to ALL authenticated users.
    This is the personal notification archive: every notification ever
    received by the requesting user, with search, type filter, date range,
    and unread filter.

    Query params:
      q           — search subject + message (case-insensitive)
      type        — filter by notification type
      sent_after  — ISO date (YYYY-MM-DD), inclusive lower bound
      sent_before — ISO date (YYYY-MM-DD), inclusive upper bound
      unread_only — "1" to show only unread
      page        — 1-based, default 1
      page_size   — default 20, max 100

    Response:
      {
        "count":       <total matching rows>,
        "page":        <current page>,
        "total_pages": <total pages>,
        "unread":      <total unread across ALL notifications, not just this page>,
        "results":     [ ...notification objects... ]
      }
    """
    qs = (
        Notification.objects
        .filter(user=request.user)
        .select_related("broadcast__sender")
    )

    # Apply shared filters
    qs = _apply_notification_filters(qs, request)

    if request.GET.get("unread_only") == "1":
        qs = qs.filter(is_read=False)

    # Total unread count is always the global count, not filtered count
    total_unread = Notification.objects.filter(user=request.user, is_read=False).count()

    page, page_size = _parse_page_params(request)
    total  = qs.count()
    offset = (page - 1) * page_size

    notifications = qs[offset: offset + page_size]

    return JsonResponse({
        "count":       total,
        "page":        page,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "unread":      total_unread,
        "results":     [_serialize_notification(n) for n in notifications],
    })


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def mark_read(request, notification_id):
    """POST /api/v1/notifications/<id>/read/"""
    updated = Notification.objects.filter(
        id=notification_id, user=request.user
    ).update(is_read=True)

    if not updated:
        return JsonResponse({"error": "Not found"}, status=404)

    return JsonResponse({"success": True})


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def mark_all_read(request):
    """POST /api/v1/notifications/read-all/"""
    count = Notification.objects.filter(
        user=request.user, is_read=False
    ).update(is_read=True)

    logger.info("User %s marked %d notifications as read.", request.user.id, count)
    return JsonResponse({"success": True, "marked": count})


# ─────────────────────────────────────────────────────────────────────────────
# SEND
# ─────────────────────────────────────────────────────────────────────────────

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def send_notification(request):
    """POST /api/v1/notifications/send/"""
    user = request.user
    if user.role not in SENDER_ROLES and not user.is_superuser:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    subject = body.get("subject", "").strip()
    if not subject:
        return JsonResponse({"error": "subject is required"}, status=400)

    message           = body.get("message", "").strip()
    notification_type = body.get("notification_type", NotificationType.INFO)
    audience_type     = body.get("audience_type", "")
    class_id          = body.get("class_id")
    institution_id    = body.get("institution_id")
    link              = body.get("link", "").strip()
    attachment_url    = body.get("attachment_url", "").strip()
    attachment_name   = body.get("attachment_name", "").strip()

    # Sanitise attachment_name
    import os
    attachment_name = os.path.basename(attachment_name.replace("\x00", ""))[:100]

    valid_types     = [c[0] for c in NotificationType.choices]
    valid_audiences = [c[0] for c in AudienceType.choices]

    if notification_type not in valid_types:
        return JsonResponse({"error": f"Invalid notification_type. Choices: {valid_types}"}, status=400)

    if audience_type not in valid_audiences:
        return JsonResponse({"error": f"Invalid audience_type. Choices: {valid_audiences}"}, status=400)

    allowed = ROLE_ALLOWED_AUDIENCES.get(user.role, set())
    if audience_type not in allowed and not user.is_superuser:
        return JsonResponse(
            {"error": f"Your role ({user.role}) cannot send to '{audience_type}'"},
            status=403,
        )

    try:
        recipients, audience_label = _resolve_recipients(
            sender=user,
            audience_type=audience_type,
            class_id=class_id,
            institution_id=institution_id,
        )
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)

    # Exclude the sender — they don't receive their own broadcast
    recipients = [r for r in recipients if r.id != user.id]

    if not recipients:
        return JsonResponse(
            {"error": "No recipients found. Check your audience selection."},
            status=400,
        )

    with transaction.atomic():
        broadcast = Broadcast.objects.create(
            sender=user,
            subject=subject,
            message=message,
            notification_type=notification_type,
            audience_type=audience_type,
            audience_label=audience_label,
            link=link,
            attachment_url=attachment_url,
            attachment_name=attachment_name,
            recipient_count=len(recipients),
        )

        Notification.objects.bulk_create([
            Notification(
                broadcast=broadcast,
                user=recipient,
                subject=subject,
                message=message,
                notification_type=notification_type,
                is_read=False,
                link=link,
                attachment_url=attachment_url,
                attachment_name=attachment_name,
            )
            for recipient in recipients
        ])

    logger.info(
        "Broadcast id=%s sent by user=%s to %d recipients (audience=%s, label=%s)",
        broadcast.id, user.id, len(recipients), audience_type, audience_label,
    )

    return JsonResponse({
        "success":         True,
        "broadcast_id":    broadcast.id,
        "recipient_count": len(recipients),
        "audience_label":  audience_label,
    }, status=201)


# ─────────────────────────────────────────────────────────────────────────────
# SENT HISTORY (staff only)
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def sent_history(request):
    """
    GET /api/v1/notifications/sent/

    Paginated list of broadcasts sent BY the requesting user.
    Staff roles only (TEACHER, PRINCIPAL, OFFICIAL, ADMIN).

    Query params:
      q           — search subject + message
      type        — notification type
      sent_after  — ISO date, inclusive lower bound
      sent_before — ISO date, inclusive upper bound
      page        — default 1
      page_size   — default 20, max 100
    """
    user = request.user
    if user.role not in SENDER_ROLES and not user.is_superuser:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    qs = Broadcast.objects.filter(sender=user)

    q = request.GET.get("q", "").strip()
    if q:
        qs = qs.filter(Q(subject__icontains=q) | Q(message__icontains=q))

    notif_type = request.GET.get("type", "").strip()
    if notif_type:
        qs = qs.filter(notification_type=notif_type)

    sent_after = request.GET.get("sent_after", "").strip()
    if sent_after:
        parsed = parse_date(sent_after)
        if parsed:
            qs = qs.filter(sent_at__date__gte=parsed)

    sent_before = request.GET.get("sent_before", "").strip()
    if sent_before:
        parsed = parse_date(sent_before)
        if parsed:
            qs = qs.filter(sent_at__date__lte=parsed)

    page, page_size = _parse_page_params(request)
    total      = qs.count()
    offset     = (page - 1) * page_size
    broadcasts = qs[offset: offset + page_size]

    data = [
        {
            "id":                b.id,
            "subject":           b.subject,
            "message":           b.message,
            "notification_type": b.notification_type,
            "audience_type":     b.audience_type,
            "audience_label":    b.audience_label,
            "link":              b.link,
            "attachment_url":    b.attachment_url,
            "attachment_name":   b.attachment_name,
            "sent_at":           b.sent_at.isoformat(),
            "recipient_count":   b.recipient_count,
        }
        for b in broadcasts
    ]

    return JsonResponse({
        "count":       total,
        "page":        page,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "results":     data,
    })


@login_required
@require_http_methods(["GET"])
def broadcast_detail(request, broadcast_id):
    """GET /api/v1/notifications/sent/<id>/"""
    user = request.user
    if user.role not in SENDER_ROLES and not user.is_superuser:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    broadcast = get_object_or_404(Broadcast, id=broadcast_id)

    if broadcast.sender != user and user.role != "ADMIN" and not user.is_superuser:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    notifs = (
        broadcast.notifications
        .select_related("user")
        .order_by("user__username")[:50]
    )

    read_count   = broadcast.notifications.filter(is_read=True).count()
    unread_count = broadcast.recipient_count - read_count

    return JsonResponse({
        "id":                broadcast.id,
        "subject":           broadcast.subject,
        "message":           broadcast.message,
        "notification_type": broadcast.notification_type,
        "audience_type":     broadcast.audience_type,
        "audience_label":    broadcast.audience_label,
        "link":              broadcast.link,
        "attachment_url":    broadcast.attachment_url,
        "attachment_name":   broadcast.attachment_name,
        "sent_at":           broadcast.sent_at.isoformat(),
        "recipient_count":   broadcast.recipient_count,
        "read_count":        read_count,
        "unread_count":      unread_count,
        "recipients": [
            {"user_id": n.user_id, "username": n.user.username, "is_read": n.is_read}
            for n in notifs
        ],
    })


# ─────────────────────────────────────────────────────────────────────────────
# AUDIENCE OPTIONS
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def audience_options(request):
    """GET /api/v1/notifications/audience-options/"""
    user = request.user
    if user.role not in SENDER_ROLES and not user.is_superuser:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    allowed = sorted(ROLE_ALLOWED_AUDIENCES.get(user.role, set()))

    classrooms = []
    if user.role == "TEACHER":
        from apps.academics.models import ClassRoom as CR
        classroom_ids = (
            user.teaching_assignments
            .values_list("section__classroom_id", flat=True)
            .distinct()
        )
        classrooms = list(
            CR.objects.filter(id__in=classroom_ids)
            .select_related("institution")
            .order_by("name")
            .values("id", "name", "institution__name")
        )
    elif user.role in ("PRINCIPAL", "ADMIN"):
        from apps.academics.models import ClassRoom as CR
        if user.institution:
            classrooms = list(
                CR.objects.filter(institution=user.institution)
                .select_related("institution")
                .order_by("name")
                .values("id", "name", "institution__name")
            )

    institutions = []
    if user.role == "OFFICIAL":
        from apps.academics.models import Institution as Inst
        institutions = list(
            Inst.objects.filter(district__name=user.district)
            .order_by("name")
            .values("id", "name")
        )
    elif user.role == "ADMIN":
        from apps.academics.models import Institution as Inst
        institutions = list(
            Inst.objects.order_by("name").values("id", "name")
        )

    return JsonResponse({
        "allowed_audience_types": allowed,
        "classrooms":             classrooms,
        "institutions":           institutions,
    })