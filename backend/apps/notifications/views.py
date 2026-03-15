import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Notification

logger = logging.getLogger(__name__)


@login_required
@require_http_methods(["GET"])
def list_notifications(request):
    """
    GET /api/v1/notifications/

    Returns the 50 most recent notifications for the authenticated user.
    Also returns total unread count for the bell badge.
    """
    notifications = Notification.objects.filter(user=request.user)[:50]
    unread_count  = Notification.objects.filter(user=request.user, is_read=False).count()

    data = [
        {
            "id":         n.id,
            "title":      n.title,
            "message":    n.message,
            "type":       n.type,
            "is_read":    n.is_read,
            "link":       n.link,
            "created_at": n.created_at.isoformat(),
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