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
from django.template.loader import render_to_string

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
# Priority:  Email → SMS (Twilio) → Log fallback
# Delivery:  fire-and-forget via threading.Thread (safe with gthread workers)
#
# Why Email primary?
#   - Twilio SMS is reliable but expensive.
#   - Gmail/Zoho SMTP is free and reliable.
#   - Twilio is retained as a fallback.
#
# Why async?
#   - SMTP can block 3-5s, Fast2SMS up to 4s (timeout)
#   - On 3G networks in rural Punjab, every second of login latency matters
#   - The OTP is already saved to DB before delivery starts, so the user
#     can verify as soon as the message arrives
# ─────────────────────────────────────────────────────────────────────────────

import threading
import time

from twilio.rest import Client


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
    Send OTP via email (Zoho SMTP).
    Returns True on success, False on any failure (never raises).
    """
    if not email or not getattr(settings, "EMAIL_HOST", "").strip():
        return False
    try:
        context = {"username": username, "otp_code": otp_code}
        html_content = render_to_string("emails/otp_email.html", context)
        text_content = (
            f"Hello {username},\n\n"
            f"Your GyanGrit login OTP is: {otp_code}\n\n"
            f"This code expires in 10 minutes.\n"
            f"Do not share this code with anyone.\n\n"
            f"— GyanGrit Team"
        )

        send_mail(
            subject="GyanGrit — Verify your secure login",
            message=text_content,
            html_message=html_content,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "GyanGrit <noreply@gyangrit.site>"),
            recipient_list=[email],
            fail_silently=False,
        )
        masked = email[:3] + "***" + email[email.find("@"):]
        logger.info("OTP email delivered to %s", masked)
        return True
    except Exception as exc:
        logger.error("OTP email failed: %s", exc)
        return False


def _send_sms_twilio(mobile: str, otp_code: str) -> bool:
    """
    Send OTP via Twilio SMS.
    Returns True on success, False on any failure.
    """
    account_sid = getattr(settings, "TWILIO_ACCOUNT_SID", "").strip()
    auth_token = getattr(settings, "TWILIO_AUTH_TOKEN", "").strip()
    twilio_number = getattr(settings, "TWILIO_PHONE_NUMBER", "").strip()
    
    if not account_sid or not auth_token or not twilio_number:
        logger.warning("Twilio credentials missing in settings.")
        return False

    # Normalise to E.164 format for India (+91)
    digits = "".join(c for c in mobile if c.isdigit())
    if len(digits) == 10:
        digits = "91" + digits
    elif digits.startswith("91") and len(digits) == 12:
        pass
    else:
        logger.warning("send_otp: invalid mobile after strip: %s chars", len(digits))
        return False

    to_number = "+" + digits

    message_body = (
        f"Your GyanGrit verification code is: {otp_code}. "
        f"It expires in 10 minutes. Do not share this code with anyone."
    )

    try:
        client = Client(account_sid, auth_token)
        message = client.messages.create(
            body=message_body,
            from_=twilio_number,
            to=to_number
        )
        logger.info("OTP SMS delivered via Twilio to *%s (SID: %s)", digits[-4:], message.sid)
        return True
    except Exception as exc:
        logger.error("Twilio request failed: %s", exc)
        return False


def _deliver_otp_background(username: str, email: str, mobile: str, otp_code: str) -> None:
    """
    Background thread: try Email first, then Twilio SMS, then log.
    This runs AFTER the HTTP response has already been sent to the user.
    """
    t0 = time.monotonic()

    # 1 — Email (primary - free & reliable via Zoho)
    if email and _send_otp_email(email, otp_code, username):
        elapsed = round(time.monotonic() - t0, 2)
        logger.info("OTP[%s] delivered via EMAIL in %ss", username, elapsed)
        return

    # 2 — Twilio SMS (fallback - expensive)
    if mobile and _send_sms_twilio(mobile, otp_code):
        elapsed = round(time.monotonic() - t0, 2)
        logger.info("OTP[%s] delivered via SMS (Twilio) in %ss", username, elapsed)
        return

    # Legacy: Fast2SMS (Commented out per request)
    # if mobile and _send_sms_fast2sms(mobile, otp_code):
    #     elapsed = round(time.monotonic() - t0, 2)
    #     logger.info("OTP[%s] delivered via SMS (Fast2SMS) in %ss", username, elapsed)
    #     return

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
    elif mobile and getattr(settings, "TWILIO_ACCOUNT_SID", "").strip():
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


# ─────────────────────────────────────────────────────────────────────────────
# Universal Notification Email
# ─────────────────────────────────────────────────────────────────────────────

def send_notification_email_async(
    user_email: str, 
    subject: str, 
    title: str, 
    message: str, 
    greeting: str = "", 
    action_text: str = None, 
    action_url: str = None
) -> None:
    """
    Fire-and-forget general notification email using the universal template.
    
    Example Usage:
        send_notification_email_async(
            "student@example.com", 
            "Assessment Recorded", 
            "Your score is ready!", 
            "You scored 95% on the Math quiz.", 
            greeting="Veera", 
            action_text="View Results", 
            action_url="https://gyangrit.site/dashboard"
        )
    """
    if not user_email or not getattr(settings, "EMAIL_HOST", "").strip():
        logger.warning("Skipping notification email: Missing destination or Zoho setup.")
        return

    def _deliver_notification():
        try:
            context = {
                "title": title,
                "message": message,
                "greeting": greeting,
                "action_text": action_text,
                "action_url": action_url,
            }
            html_content = render_to_string("emails/notification_email.html", context)
            
            send_mail(
                subject=f"GyanGrit — {subject}",
                message=message,  # Text fallback
                html_message=html_content,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@gyangrit.site"),
                recipient_list=[user_email],
                fail_silently=True,
            )
            masked = user_email[:3] + "***" + user_email[user_email.find("@"):]
            logger.info("Notification email '%s' delivered to %s", subject, masked)
        except Exception as exc:
            logger.error("Failed to send notification email '%s': %s", subject, exc)

    thread = threading.Thread(target=_deliver_notification, daemon=True)
    thread.start()
