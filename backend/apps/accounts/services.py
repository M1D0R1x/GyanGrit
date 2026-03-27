"""
apps/accounts/services.py

Shared service functions for the accounts app.
- assign_teacher_to_classes: creates TeachingAssignment records on teacher registration
- send_otp: delivers OTP via SMS (Fast2SMS) or email with a log fallback
"""
import logging

import requests
from django.conf import settings
from django.core.mail import send_mail

from apps.academics.models import ClassRoom, Section, TeachingAssignment

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Teacher assignment
# ─────────────────────────────────────────────────────────────────────────────

def assign_teacher_to_classes(teacher, subject, institution):
    """
    Creates TeachingAssignment records for a teacher across all
    sections of grades 6-10 in the given institution.

    Called from:
    - accounts/views.py register() when a TEACHER registers via join code
    - accounts/admin.py UserAdmin.save_model() when admin creates a teacher
    """
    classrooms = ClassRoom.objects.filter(
        institution=institution,
        name__in=["6", "7", "8", "9", "10"],
    )
    created_count = 0
    for classroom in classrooms:
        for section in Section.objects.filter(classroom=classroom):
            _, created = TeachingAssignment.objects.get_or_create(
                teacher=teacher,
                subject=subject,
                section=section,
            )
            if created:
                created_count += 1

    logger.info(
        "assign_teacher_to_classes: teacher id=%s assigned to %d new sections "
        "for subject '%s' in institution '%s'.",
        teacher.id, created_count, subject.name, institution.name,
    )
    return created_count


# ─────────────────────────────────────────────────────────────────────────────
# OTP delivery  —  async, email-first
#
# Priority:  Email → SMS (Fast2SMS) → Log fallback
# Delivery:  fire-and-forget via threading.Thread (safe with gthread workers)
#
# Why email-first?
#   - Fast2SMS Quick route is unreliable (DLT restrictions, rate limits)
#   - Gmail SMTP is free, instant, and always available
#   - All staff roles (TEACHER/PRINCIPAL/OFFICIAL) have email on file
#
# Why async?
#   - SMTP can block 3-5s, Fast2SMS up to 4s (timeout)
#   - On 3G networks in rural Punjab, every second of login latency matters
#   - The OTP is already saved to DB before delivery starts, so the user
#     can verify as soon as the message arrives
# ─────────────────────────────────────────────────────────────────────────────

import threading
import time


def _send_sms_fast2sms(mobile: str, otp_code: str) -> bool:
    """
    Send OTP via Fast2SMS Quick SMS route (route=q).
    Returns True on success, False on any failure (never raises).
    """
    api_key = getattr(settings, "FAST2SMS_API_KEY", "").strip()
    if not api_key:
        return False

    # Normalise to 10-digit Indian mobile number
    digits = "".join(c for c in mobile if c.isdigit())
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) != 10:
        logger.warning("send_otp: invalid mobile after strip: %s chars", len(digits))
        return False

    message = (
        f"Your GyanGrit verification code is: {otp_code}. "
        f"It expires in 10 minutes. Do not share this code with anyone."
    )

    try:
        resp = requests.get(
            "https://www.fast2sms.com/dev/bulkV2",
            params={
                "authorization": api_key,
                "route": "q",
                "message": message,
                "numbers": digits,
                "flash": "0",
            },
            timeout=4,  # reduced from 6s — fail fast on 3G
        )
        data = resp.json()
        if data.get("return") is True:
            logger.info("OTP SMS delivered to *%s", digits[-4:])
            return True
        logger.error("Fast2SMS error: %s", data)
        return False
    except requests.RequestException as exc:
        logger.error("Fast2SMS request failed: %s", exc)
        return False


def _send_otp_email(email: str, otp_code: str, username: str) -> bool:
    """
    Send OTP via email (Gmail SMTP).
    Returns True on success, False on any failure (never raises).
    """
    if not email or not getattr(settings, "EMAIL_HOST", "").strip():
        return False
    try:
        send_mail(
            subject="GyanGrit — Your Login OTP",
            message=(
                f"Hello {username},\n\n"
                f"Your GyanGrit login OTP is: {otp_code}\n\n"
                f"This code expires in 10 minutes.\n"
                f"Do not share this code with anyone.\n\n"
                f"— GyanGrit Team"
            ),
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@gyangrit.com"),
            recipient_list=[email],
            fail_silently=True,
        )
        masked = email[:3] + "***" + email[email.find("@"):]
        logger.info("OTP email delivered to %s", masked)
        return True
    except Exception as exc:
        logger.error("OTP email failed: %s", exc)
        return False


def _deliver_otp_background(username: str, email: str, mobile: str, otp_code: str) -> None:
    """
    Background thread: try email first, then SMS, then log.
    This runs AFTER the HTTP response has already been sent to the user.
    """
    t0 = time.monotonic()

    # 1 — Email (primary)
    if email and _send_otp_email(email, otp_code, username):
        elapsed = round(time.monotonic() - t0, 2)
        logger.info("OTP[%s] delivered via EMAIL in %ss", username, elapsed)
        return

    # 2 — SMS (fallback)
    if mobile and _send_sms_fast2sms(mobile, otp_code):
        elapsed = round(time.monotonic() - t0, 2)
        logger.info("OTP[%s] delivered via SMS in %ss", username, elapsed)
        return

    # 3 — Log fallback (nothing worked)
    elapsed = round(time.monotonic() - t0, 2)
    if settings.DEBUG:
        logger.debug("DEV OTP for %s: %s (took %ss)", username, otp_code, elapsed)
    else:
        logger.error(
            "OTP NOT DELIVERED for %s after %ss — check EMAIL_HOST/FAST2SMS_API_KEY",
            username, elapsed,
        )


def send_otp_async(user, otp_code: str) -> str:
    """
    Fire-and-forget OTP delivery. Returns the *intended* channel immediately
    so the login response is never blocked by SMTP or HTTP latency.

    Returns:
      channel: str  — "email", "sms", or "log" (best guess of what will be tried first)
    """
    email = getattr(user, "email", "").strip()
    mobile = getattr(user, "mobile_primary", "").strip()

    # Determine the intended channel for the frontend UI hint
    if email and getattr(settings, "EMAIL_HOST", "").strip():
        channel = "email"
    elif mobile and getattr(settings, "FAST2SMS_API_KEY", "").strip():
        channel = "sms"
    else:
        channel = "log"

    # Fire background thread — daemon=True so it won't block server shutdown
    thread = threading.Thread(
        target=_deliver_otp_background,
        args=(user.username, email, mobile, otp_code),
        daemon=True,
    )
    thread.start()

    logger.info("OTP[%s] delivery dispatched (channel=%s)", user.username, channel)
    return channel
