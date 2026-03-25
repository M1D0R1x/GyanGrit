# apps.notifications.push
"""
Web Push delivery service.

Uses pywebpush to send encrypted push notifications to subscribed browsers.
VAPID keys are read from environment variables:
  VAPID_PRIVATE_KEY  — base64url-encoded private key
  VAPID_PUBLIC_KEY   — base64url-encoded public key
  VAPID_CLAIMS_EMAIL — contact email for VAPID (e.g. mailto:admin@gyangrit.com)

Generate keys once:
  python -c "from py_vapid import Vapid; v = Vapid(); v.generate_keys(); print('PRIVATE:', v.private_pem()); print('PUBLIC:', v.public_key)"

Or use the management command:
  python manage.py generate_vapid_keys
"""
import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def _get_vapid_keys():
    """Return (private_key, claims) tuple or (None, None) if not configured."""
    private_key = getattr(settings, "VAPID_PRIVATE_KEY", "").strip()
    email = getattr(settings, "VAPID_CLAIMS_EMAIL", "").strip()
    if not private_key or not email:
        return None, None
    return private_key, {"sub": email}


def send_push_to_user(user_id: int, title: str, body: str, url: str = "/notifications", tag: str = "gyangrit") -> int:
    """
    Send a push notification to all subscriptions for a user.
    Returns the number of successful deliveries.

    Automatically deletes stale subscriptions (410 Gone from push service).
    """
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed — push notifications disabled.")
        return 0

    from .models import PushSubscription

    private_key, claims = _get_vapid_keys()
    if not private_key:
        return 0

    subscriptions = PushSubscription.objects.filter(user_id=user_id)
    if not subscriptions.exists():
        return 0

    payload = json.dumps({
        "title": title,
        "body":  body,
        "url":   url,
        "tag":   tag,
    })

    sent = 0
    stale_ids = []

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh,
                "auth":   sub.auth,
            },
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=private_key,
                vapid_claims=claims,
                timeout=5,
            )
            sent += 1
        except WebPushException as exc:
            status = getattr(exc, "response", None)
            status_code = status.status_code if status else 0
            if status_code in (404, 410):
                # Subscription expired or unsubscribed — clean up
                stale_ids.append(sub.id)
                logger.info("Push subscription stale (HTTP %d), deleting: user=%s", status_code, user_id)
            else:
                logger.warning("Push failed for user=%s: %s", user_id, exc)
        except Exception as exc:
            logger.warning("Push failed for user=%s: %s", user_id, exc)

    if stale_ids:
        PushSubscription.objects.filter(id__in=stale_ids).delete()

    return sent


def send_push_to_users(user_ids: list[int], title: str, body: str, url: str = "/notifications", tag: str = "gyangrit") -> int:
    """
    Send push to multiple users. Returns total successful deliveries.
    """
    total = 0
    for uid in user_ids:
        total += send_push_to_user(uid, title, body, url, tag)
    return total
