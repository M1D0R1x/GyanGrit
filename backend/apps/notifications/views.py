# apps.notifications.views
"""
Notification views for GyanGrit.

Endpoints:
  GET  /api/v1/notifications/                    — inbox (50 most recent + unread count)
  POST /api/v1/notifications/<id>/read/          — mark one read
  POST /api/v1/notifications/read-all/           — mark all read
  POST /api/v1/notifications/send/               — send a broadcast (staff roles)
  GET  /api/v1/notifications/sent/               — sent history with search + date filters
  GET  /api/v1/notifications/sent/<id>/          — broadcast detail + recipient list
  GET  /api/v1/notifications/audience-options/   — dropdown data for send form

Scoping rules (enforced server-side):
  TEACHER   → CLASS_* for their assigned sections only
  PRINCIPAL → any CLASS_* or SCHOOL_* scoped to their institution
  OFFICIAL  → any SCHOOL_* or DISTRICT_* scoped to their district
  ADMIN     → any scope including SYSTEM
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
        if not institution_id:
            raise ValueError("institution_id is required for ADMIN")
        return get_object_or_404(Institution, id=institution_id)
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
        return sender.district or ""
    if not sender.district:
        raise ValueError("No district assigned")
    return sender.district


def _resolve_recipients(sender, audience_type, class_id=None, institution_id=None):
    """
    Returns (list of User, audience_label string).
    Raises ValueError if the scope is invalid for this sender.
    """
    role = sender.role

    if audience_type == AudienceType.CLASS_STUDENTS:
        if role == "TEACHER":
            classroom = _get_teacher_classroom(sender, class_id)
        else:
            classroom = _get_classroom_in_scope(sender, class_id)
        qs = User.objects.filter(role="STUDENT", section__classroom=classroom)
        return list(qs), f"Class {classroom.name} — Students"

    if audience_type == AudienceType.CLASS_TEACHERS:
        if role == "TEACHER":
            classroom = _get_teacher_classroom(sender, class_id)
        else:
            classroom = _get_classroom_in_scope(sender, class_id)
        qs = User.objects.filter(
            role="TEACHER",
            teaching_assignments__section__classroom=classroom,
        ).distinct()
        return list(qs), f"Class {classroom.name} — Teachers"

    if audience_type == AudienceType.CLASS_ALL:
        if role == "TEACHER":
            classroom = _get_teacher_classroom(sender, class_id)
        else:
            classroom = _get_classroom_in_scope(sender, class_id)
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
        qs = User.objects.filter(role="STUDENT", institution=inst)
        return list(qs), f"{inst.name} — Students"

    if audience_type == AudienceType.SCHOOL_TEACHERS:
        inst = _get_institution_in_scope(sender, institution_id)
        qs = User.objects.filter(role="TEACHER", institution=inst)
        return list(qs), f"{inst.name} — Teachers"

    if audience_type == AudienceType.SCHOOL_ALL:
        inst = _get_institution_in_scope(sender, institution_id)
        qs = User.objects.filter(institution=inst, role__in=["STUDENT", "TEACHER", "PRINCIPAL"])
        return list(qs), f"{inst.name} — Everyone"

    if audience_type == AudienceType.DISTRICT_STUDENTS:
        district = _get_district_for_sender(sender)
        qs = User.objects.filter(role="STUDENT", institution__district__name=district)
        return list(qs), f"{district} District — Students"

    if audience_type == AudienceType.DISTRICT_TEACHERS:
        district = _get_district_for_sender(sender)
        qs = User.objects.filter(role="TEACHER", institution__district__name=district)
        return list(qs), f"{district} District — Teachers"

    if audience_type == AudienceType.DISTRICT_PRINCIPALS:
        district = _get_district_for_sender(sender)
        qs = User.objects.filter(role="PRINCIPAL", institution__district__name=district)
        return list(qs), f"{district} District — Principals"

    if audience_type == AudienceType.DISTRICT_ALL:
        district = _get_district_for_sender(sender)
        qs = User.objects.filter(
            role__in=["STUDENT", "TEACHER", "PRINCIPAL"],
            institution__district__name=district,
        )
        return list(qs), f"{district} District — Everyone"

    if audience_type == AudienceType.SYSTEM:
        if sender.role != "ADMIN" and not sender.is_superuser:
            raise ValueError("Only ADMIN can send system-wide notifications")
        qs = User.objects.all()
        return list(qs), "System-wide"

    raise ValueError(f"Unknown audience type: {audience_type}")


# ─────────────────────────────────────────────────────────────────────────────
# INBOX ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def list_notifications(request):
    """GET /api/v1/notifications/"""
    qs = Notification.objects.filter(
        user=request.user
    ).select_related("broadcast__sender")

    notif_type = request.GET.get("type")
    if notif_type:
        qs = qs.filter(notification_type=notif_type)

    if request.GET.get("unread_only") == "1":
        qs = qs.filter(is_read=False)

    notifications = qs[:50]
    unread_count  = Notification.objects.filter(user=request.user, is_read=False).count()

    data = [
        {
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
        for n in notifications
    ]

    return JsonResponse({"unread": unread_count, "notifications": data})


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

    subject          = body.get("subject", "").strip()
    if not subject:
        return JsonResponse({"error": "subject is required"}, status=400)

    message          = body.get("message", "").strip()
    notification_type = body.get("notification_type", NotificationType.INFO)
    audience_type    = body.get("audience_type", "")
    class_id         = body.get("class_id")
    institution_id   = body.get("institution_id")
    link             = body.get("link", "")
    attachment_url   = body.get("attachment_url", "")
    attachment_name  = body.get("attachment_name", "")

    valid_types     = [c[0] for c in NotificationType.choices]
    valid_audiences = [c[0] for c in AudienceType.choices]

    if notification_type not in valid_types:
        return JsonResponse(
            {"error": f"Invalid notification_type. Must be one of: {valid_types}"},
            status=400,
        )

    if audience_type not in valid_audiences:
        return JsonResponse(
            {"error": f"Invalid audience_type. Must be one of: {valid_audiences}"},
            status=400,
        )

    allowed = ROLE_ALLOWED_AUDIENCES.get(user.role, set())
    if audience_type not in allowed and not user.is_superuser:
        return JsonResponse(
            {"error": f"Your role ({user.role}) cannot send to audience type '{audience_type}'"},
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

    # Exclude the sender from their own broadcast
    recipients = [r for r in recipients if r.id != user.id]

    if not recipients:
        return JsonResponse({"error": "No recipients found for the given audience"}, status=400)

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
        "Broadcast id=%s sent by user=%s to %d recipients (audience=%s)",
        broadcast.id, user.id, len(recipients), audience_type,
    )

    return JsonResponse({
        "success":         True,
        "broadcast_id":    broadcast.id,
        "recipient_count": len(recipients),
        "audience_label":  audience_label,
    }, status=201)


# ─────────────────────────────────────────────────────────────────────────────
# SENT HISTORY
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def sent_history(request):
    """GET /api/v1/notifications/sent/"""
    user = request.user
    if user.role not in SENDER_ROLES and not user.is_superuser:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    qs = Broadcast.objects.filter(sender=user)

    q = request.GET.get("q", "").strip()
    if q:
        qs = qs.filter(Q(subject__icontains=q) | Q(message__icontains=q))

    notif_type = request.GET.get("type")
    if notif_type:
        qs = qs.filter(notification_type=notif_type)

    from_date = request.GET.get("from")
    to_date   = request.GET.get("to")
    if from_date:
        parsed = parse_date(from_date)
        if parsed:
            qs = qs.filter(sent_at__date__gte=parsed)
    if to_date:
        parsed = parse_date(to_date)
        if parsed:
            qs = qs.filter(sent_at__date__lte=parsed)

    try:
        page = max(1, int(request.GET.get("page", 1)))
    except (ValueError, TypeError):
        page = 1

    page_size  = 20
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

    notifications = (
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
            {
                "user_id":  n.user_id,
                "username": n.user.username,
                "is_read":  n.is_read,
            }
            for n in notifications
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