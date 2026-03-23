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
# OTP delivery
# ─────────────────────────────────────────────────────────────────────────────

def _send_sms_fast2sms(mobile: str, otp_code: str) -> bool:
    """
    Send OTP via Fast2SMS OTP route.
    Env var: FAST2SMS_API_KEY
    Sign up: https://www.fast2sms.com/
    Free trial: ₹50 on signup (~330 OTPs). Production: ~₹0.15/SMS.

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

    try:
        resp = requests.post(
            "https://www.fast2sms.com/dev/bulkV2",
            headers={"authorization": api_key, "Content-Type": "application/json"},
            json={"route": "otp", "variables_values": otp_code, "numbers": digits},
            timeout=8,
        )
        data = resp.json()
        if data.get("return") is True:
            logger.info("OTP SMS sent to *%s", digits[-4:])
            return True
        logger.error("Fast2SMS error response: %s", data)
        return False
    except requests.RequestException as exc:
        logger.error("Fast2SMS request failed: %s", exc)
        return False


def _send_otp_email(email: str, otp_code: str, username: str) -> bool:
    """
    Send OTP via email. Uses Django EMAIL_HOST settings.
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
            fail_silently=False,
        )
        masked = email[:3] + "***" + email[email.find("@"):]
        logger.info("OTP email sent to %s", masked)
        return True
    except Exception as exc:
        logger.error("OTP email failed: %s", exc)
        return False


def send_otp(user, otp_code: str) -> tuple[bool, str]:
    """
    Deliver OTP to the user via the best available channel.

    Priority:
      1. SMS via Fast2SMS  (needs FAST2SMS_API_KEY + user.mobile_primary)
      2. Email             (needs EMAIL_HOST + user.email)
      3. Log only          (dev fallback — logs ERROR in production so it's visible)

    Returns:
      (delivered: bool, channel: str)  — channel is "sms", "email", or "log"
    """
    # 1 — SMS
    mobile = getattr(user, "mobile_primary", "").strip()
    if mobile and _send_sms_fast2sms(mobile, otp_code):
        return True, "sms"

    # 2 — Email
    email = getattr(user, "email", "").strip()
    if email and _send_otp_email(email, otp_code, user.username):
        return True, "email"

    # 3 — Log fallback
    if settings.DEBUG:
        logger.debug("DEV OTP for %s: %s", user.username, otp_code)
    else:
        logger.error(
            "OTP NOT DELIVERED for user %s — set FAST2SMS_API_KEY or EMAIL_HOST in env",
            user.username,
        )
    return False, "log"
