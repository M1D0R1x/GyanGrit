# apps.livesessions.recording
"""
LiveKit Egress integration for GyanGrit session recording.

Flow:
  1. Teacher starts a session → start_recording(session) is called
     → POST to LiveKit Egress API → starts room composite recording
     → LiveKit uploads MP4 to Cloudflare R2 (S3-compatible)
     → session.recording_status = 'processing'

  2. LiveKit sends webhook when Egress completes
     → POST /api/v1/live/recording-webhook/
     → handle_recording_webhook(payload) is called
     → session.recording_status = 'ready', recording_url set

R2 naming convention (ADR-002):
  recordings/{institution_id}/{grade}-{section}/{subject}/{YYYY-MM-DD}_{HH-MM}_{slug}.mp4

  Example:
  recordings/101/10-A/Mathematics/2026-04-03_10-30_Trigonometry-Basics.mp4

Supported LiveKit plan: LiveKit Cloud (Egress is built-in, no extra setup).
Self-hosted: requires livekit-egress Docker container.
"""
import hashlib
import hmac
import json
import logging
import re
from datetime import timezone as dt_tz

import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


# ── Naming convention ──────────────────────────────────────────────────────────

def _slugify(text: str, max_len: int = 60) -> str:
    """Convert a title to a URL-safe slug for R2 key naming."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text[:max_len]


def build_r2_key(session) -> str:
    """
    Build the R2 object key for a session recording.

    Format: recordings/{institution_id}/{grade}-{section_name}/{subject}/{YYYY-MM-DD}_{HH-MM}_{slug}.mp4

    Args:
        session: LiveSession instance (must have section + subject loaded)

    Returns:
        R2 key string, e.g.
        "recordings/101/10-A/Mathematics/2026-04-03_10-30_Trigonometry-Basics.mp4"
    """
    section  = session.section
    subject  = session.subject

    institution_id = getattr(section, "institution_id", "0")
    grade          = getattr(section, "grade", "")
    section_name   = getattr(section, "name", str(section.id))
    subject_name   = subject.name if subject else "General"

    # Use started_at (IST) if available, otherwise scheduled_at
    ts = session.started_at or session.scheduled_at
    # Convert to IST for human-readable key
    ts_ist = ts.astimezone(dt_tz.utc)  # stored as UTC in DB
    date_str = ts_ist.strftime("%Y-%m-%d")
    time_str = ts_ist.strftime("%H-%M")

    slug = _slugify(session.title)
    grade_section = f"{grade}-{section_name}" if grade else section_name

    prefix = getattr(settings, "CLOUDFLARE_R2_RECORDINGS_PREFIX", "recordings/").rstrip("/")
    return (
        f"{prefix}/{institution_id}/{grade_section}/"
        f"{subject_name}/{date_str}_{time_str}_{slug}.mp4"
    )


# ── LiveKit Egress API ─────────────────────────────────────────────────────────

def _livekit_auth_header(room_name: str) -> str:
    """Generate a JWT access token for LiveKit Egress API calls."""
    import base64
    import time

    api_key    = settings.LIVEKIT_API_KEY
    api_secret = settings.LIVEKIT_API_SECRET

    if not api_key or not api_secret:
        raise ValueError("LIVEKIT_API_KEY / LIVEKIT_API_SECRET not configured")

    # Build minimal JWT (header.payload.signature)
    header  = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').rstrip(b"=").decode()
    payload = {
        "iss": api_key,
        "exp": int(time.time()) + 300,   # 5-minute window
        "video": {"roomRecord": True},
    }
    import json as _json
    payload_b64 = base64.urlsafe_b64encode(
        _json.dumps(payload, separators=(",", ":")).encode()
    ).rstrip(b"=").decode()

    signing_input = f"{header}.{payload_b64}".encode()
    sig = hmac.new(api_secret.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()

    return f"Bearer {header}.{payload_b64}.{sig_b64}"


def start_recording(session) -> str | None:
    """
    Start a LiveKit room composite Egress for the session.

    Uploads directly to Cloudflare R2 via S3-compatible API.
    Updates session.recording_status = 'processing' and saves the egress ID.

    Args:
        session: LiveSession instance (status must be 'live')

    Returns:
        egress_id string if successful, None on failure.
    """
    from .models import RecordingStatus

    livekit_url  = settings.LIVEKIT_URL
    account_id   = getattr(settings, "CLOUDFLARE_R2_ACCOUNT_ID", "")
    access_key   = getattr(settings, "CLOUDFLARE_R2_ACCESS_KEY_ID", "")
    secret_key   = getattr(settings, "CLOUDFLARE_R2_SECRET_ACCESS_KEY", "")
    bucket       = getattr(settings, "CLOUDFLARE_R2_BUCKET_NAME", "gyangrit-media")

    if not livekit_url:
        logger.error("LIVEKIT_URL not set — cannot start recording")
        return None

    r2_key = build_r2_key(session)
    s3_endpoint = f"https://{account_id}.r2.cloudflarestorage.com"

    payload = {
        "room_name": session.livekit_room_name,
        "file": {
            "filepath": r2_key,
            "s3": {
                "access_key":  access_key,
                "secret":      secret_key,
                "region":      "auto",
                "endpoint":    s3_endpoint,
                "bucket":      bucket,
                "force_path_style": True,
            }
        },
        # Composite layout for Whiteboard + Teacher Video natively handled
        "layout": "speaker",
        "options": {
            "preset": "H264_1080P_30"
        }
    }

    try:
        http_url = livekit_url.rstrip('/').replace("wss://", "https://").replace("ws://", "http://")
        resp = requests.post(
            f"{http_url}/twirp/livekit.Egress/StartRoomCompositeEgress",
            json=payload,
            headers={
                "Authorization": _livekit_auth_header(session.livekit_room_name),
                "Content-Type":  "application/json",
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        egress_id = data.get("egress_id", "")

        # Persist state to session
        session.recording_r2_key   = r2_key
        session.recording_status   = RecordingStatus.PROCESSING
        session.recording_egress_id = egress_id
        session.save(update_fields=[
            "recording_r2_key",
            "recording_status",
            "recording_egress_id",
        ])

        logger.info("Egress started: session=%s egress_id=%s key=%s", session.id, egress_id, r2_key)
        return egress_id

    except requests.RequestException as exc:
        logger.error("Failed to start Egress for session %s: %s", session.id, exc)
        session.recording_status = RecordingStatus.FAILED
        session.save(update_fields=["recording_status"])
        return None


# ── Webhook handler ────────────────────────────────────────────────────────────

def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """
    Verify the LiveKit webhook signature using HMAC-SHA256.
    Header: Authorization: <HMAC-SHA256 of raw body with webhook secret>
    """
    secret = getattr(settings, "LIVEKIT_RECORDING_WEBHOOK_SECRET", "")
    if not secret:
        logger.warning("LIVEKIT_RECORDING_WEBHOOK_SECRET not set — skipping webhook verification")
        return True  # fail-open during development

    expected = hmac.new(
        secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    # Constant-time comparison
    return hmac.compare_digest(expected, signature)


def handle_recording_webhook(payload: dict) -> None:
    """
    Process a LiveKit Egress webhook payload.

    Called from the /api/v1/live/recording-webhook/ endpoint.
    Updates the LiveSession when Egress completes successfully.

    Expected payload keys (from LiveKit Egress event):
      event:       "egress_updated" | "egress_ended"
      egress_id:   string
      status:      "EGRESS_COMPLETE" | "EGRESS_FAILED" | ...
      file:        { filename, size, duration }
    """
    from .models import LiveSession, RecordingStatus

    event     = payload.get("event", "")
    egress_id = payload.get("egress_id", "")

    if event not in ("egress_ended", "egress_updated"):
        return  # ignore non-egress events

    status_str = payload.get("status", "")
    logger.info("Recording webhook: event=%s egress_id=%s status=%s", event, egress_id, status_str)

    try:
        session = LiveSession.objects.get(recording_egress_id=egress_id)
    except LiveSession.DoesNotExist:
        logger.warning("No LiveSession found for egress_id=%s", egress_id)
        return

    if status_str == "EGRESS_COMPLETE":
        file_info = payload.get("file", {})
        duration  = file_info.get("duration")    # seconds (int or float)
        size      = file_info.get("size")        # bytes

        public_url = getattr(settings, "CLOUDFLARE_R2_PUBLIC_URL", "").rstrip("/")
        recording_url = (
            f"{public_url}/{session.recording_r2_key}" if public_url else ""
        )

        session.recording_status           = RecordingStatus.READY
        session.recording_url              = recording_url
        session.recording_duration_seconds = int(duration) if duration else None
        session.recording_size_bytes       = int(size)     if size else None
        session.save(update_fields=[
            "recording_status",
            "recording_url",
            "recording_duration_seconds",
            "recording_size_bytes",
        ])
        logger.info(
            "Recording ready: session=%s url=%s duration=%ss",
            session.id, recording_url, duration,
        )

    elif "FAIL" in status_str:
        session.recording_status = RecordingStatus.FAILED
        session.save(update_fields=["recording_status"])
        logger.error("Recording failed: session=%s egress_id=%s", session.id, egress_id)
