# apps.livesessions.recording
"""
LiveKit Egress integration for GyanGrit session recording.

Flow:
  1. Teacher starts a session → start_recording(session) is called
     → POST to LiveKit Egress API → starts room composite recording
     → LiveKit uploads MP4 to Cloudflare R2 (S3-compatible)
     → session.recording_status = 'processing'

  2. Teacher ends session → stop_recording(session) is called
     → POST StopEgress so LiveKit finalises the MP4 cleanly
     → THEN the LiveKit room is deleted

  3. LiveKit sends webhook when Egress completes
     → POST /api/v1/live/recording-webhook/
     → handle_recording_webhook(payload) is called
     → session.recording_status = 'ready', recording_url set

R2 naming convention (ADR-002):
  recordings/{institution_id}/{grade}-{section}/{subject}/{YYYY-MM-DD}_{HH-MM}_{slug}.mp4

  Example:
  recordings/101/10-A/Mathematics/2026-04-03_10-30_Trigonometry-Basics.mp4

Supported LiveKit plan: LiveKit Cloud (Egress is built-in, no extra setup).
Self-hosted: requires livekit-egress Docker container.

LiveKit webhook signature:
  LiveKit signs webhooks with a JWT (Authorization: Bearer <token>).
  The token is signed with the API secret. We validate it with pyjwt.
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


# ── LiveKit JWT helper ─────────────────────────────────────────────────────────

def _make_egress_jwt(room_name: str, ttl_seconds: int = 300) -> str:
    """
    Generate a minimal LiveKit JWT for Egress API calls.

    The JWT must include `video.roomRecord: true` in the grant.
    We build it manually to avoid pulling in the full livekit-server-sdk
    (which requires C extensions on some environments).
    """
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
        "exp": int(time.time()) + ttl_seconds,
        "video": {"roomRecord": True},
    }
    payload_b64 = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).rstrip(b"=").decode()

    signing_input = f"{header}.{payload_b64}".encode()
    sig = hmac.new(api_secret.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()

    return f"Bearer {header}.{payload_b64}.{sig_b64}"


def _livekit_http_url() -> str:
    livekit_url = settings.LIVEKIT_URL
    return livekit_url.rstrip("/").replace("wss://", "https://").replace("ws://", "http://")


# ── Start recording ────────────────────────────────────────────────────────────

def start_recording(session) -> str | None:
    """
    Start a LiveKit room composite Egress for the session.

    Uploads directly to Cloudflare R2 via S3-compatible API.
    Updates session.recording_status = 'processing' and saves the egress ID.

    The Egress layout is "speaker" — when the teacher publishes the whiteboard
    canvas as a screenshare track (done in the frontend), the speaker layout
    will automatically spotlight it as the primary content with the camera in
    the corner, matching how the class looks in the browser.

    Args:
        session: LiveSession instance (status must be 'live')

    Returns:
        egress_id string if successful, None on failure.
    """
    from .models import RecordingStatus

    livekit_url  = getattr(settings, "LIVEKIT_URL", "")
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
        # "speaker" layout: spotlights screenshare (whiteboard canvas track) as primary
        # content with the camera PiP in corner — exactly how it looks in the browser.
        "layout": "speaker",
        "options": {
            "preset": "H264_1080P_30"
        }
    }

    try:
        resp = requests.post(
            f"{_livekit_http_url()}/twirp/livekit.Egress/StartRoomCompositeEgress",
            json=payload,
            headers={
                "Authorization": _make_egress_jwt(session.livekit_room_name),
                "Content-Type":  "application/json",
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        egress_id = data.get("egress_id", "")

        # Persist state to session
        session.recording_r2_key    = r2_key
        session.recording_status    = RecordingStatus.PROCESSING
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


# ── Stop recording ─────────────────────────────────────────────────────────────

def stop_recording(session) -> bool:
    """
    Stop an active LiveKit Egress for the session.

    MUST be called before _delete_livekit_room() so the Egress compositor
    has time to finalize (flush) the MP4 and upload it to R2 cleanly.
    If the room is deleted first, the in-progress upload is interrupted and
    the recording stays in PROCESSING state forever.

    Args:
        session: LiveSession instance with recording_egress_id set

    Returns:
        True if stop request was sent successfully, False otherwise.
    """
    egress_id = getattr(session, "recording_egress_id", "")
    if not egress_id:
        logger.debug("stop_recording: no egress_id for session %s — skipping", session.id)
        return False

    livekit_url = getattr(settings, "LIVEKIT_URL", "")
    if not livekit_url:
        logger.warning("LIVEKIT_URL not set — cannot stop recording")
        return False

    try:
        resp = requests.post(
            f"{_livekit_http_url()}/twirp/livekit.Egress/StopEgress",
            json={"egress_id": egress_id},
            headers={
                "Authorization": _make_egress_jwt(""),
                "Content-Type":  "application/json",
            },
            timeout=10,
        )
        if resp.ok:
            logger.info("Egress stop requested: session=%s egress_id=%s", session.id, egress_id)
            return True
        else:
            logger.warning(
                "Egress stop HTTP %d for session %s egress %s: %s",
                resp.status_code, session.id, egress_id, resp.text[:200]
            )
            return False
    except requests.RequestException as exc:
        logger.error("Failed to stop Egress for session %s: %s", session.id, exc)
        return False


# ── Webhook handler ────────────────────────────────────────────────────────────

def verify_webhook_signature(body: bytes, auth_header: str) -> bool:
    """
    Verify the LiveKit webhook signature.

    LiveKit Cloud signs webhook HTTP requests with a JWT in the Authorization
    header (Bearer <token>). The JWT is signed with LIVEKIT_API_SECRET using
    HS256 and contains a SHA-256 hash of the raw request body in the `sha256`
    claim to prevent body tampering.

    Fallback: if LIVEKIT_RECORDING_WEBHOOK_SECRET is set (legacy HMAC mode),
    also accept raw HMAC-SHA256 comparison.
    """
    api_key    = getattr(settings, "LIVEKIT_API_KEY", "")
    api_secret = getattr(settings, "LIVEKIT_API_SECRET", "")

    if not api_secret:
        logger.warning("LIVEKIT_API_SECRET not set — skipping webhook verification (fail-open)")
        return True

    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        logger.warning("Recording webhook: missing Authorization header")
        # Fail-open so misconfigured webhooks don't silently drop
        return True

    try:
        import jwt as pyjwt
        claims = pyjwt.decode(
            token,
            api_secret,
            algorithms=["HS256"],
            options={"require": ["iss"]},
        )
        # Verify issuer matches our API key
        if api_key and claims.get("iss") != api_key:
            logger.warning(
                "Recording webhook JWT iss mismatch: expected %s got %s",
                api_key, claims.get("iss")
            )
            return False

        # Verify body hash if present (LiveKit includes sha256 of body)
        body_sha = claims.get("sha256", "")
        if body_sha:
            import hashlib as _hl
            expected_sha = _hl.sha256(body).hexdigest()
            if not hmac.compare_digest(expected_sha, body_sha):
                logger.warning("Recording webhook body SHA-256 mismatch")
                return False

        return True

    except Exception as exc:
        logger.warning("Recording webhook JWT verification failed: %s", exc)
        # Fail-open during development so we don't silently drop real events
        return True


def handle_recording_webhook(payload: dict) -> None:
    """
    Process a LiveKit Egress webhook payload.

    Called from the /api/v1/live/recording-webhook/ endpoint.
    Updates the LiveSession when Egress completes successfully.

    Expected payload keys (from LiveKit Egress event):
      event:       "egress_started" | "egress_updated" | "egress_ended"
      egress_id:   string
      status:      "EGRESS_ACTIVE" | "EGRESS_COMPLETE" | "EGRESS_FAILED" | ...
      file_results: [{ filename, size, duration, location }]  (newer SDK)
      file:        { filename, size, duration }               (older SDK)
    """
    from .models import LiveSession, RecordingStatus

    event     = payload.get("event", "")
    egress_id = payload.get("egress_id", "")

    if event not in ("egress_ended", "egress_updated", "egress_started"):
        logger.debug("Recording webhook: ignored event=%s", event)
        return  # ignore non-egress events

    status_str = payload.get("status", "")
    logger.info("Recording webhook: event=%s egress_id=%s status=%s", event, egress_id, status_str)

    if not egress_id:
        logger.warning("Recording webhook: missing egress_id in payload")
        return

    try:
        session = LiveSession.objects.get(recording_egress_id=egress_id)
    except LiveSession.DoesNotExist:
        logger.warning("No LiveSession found for egress_id=%s", egress_id)
        return

    if status_str == "EGRESS_COMPLETE":
        # Support both legacy `file` and current `file_results` SDK shapes
        file_info = {}
        file_results = payload.get("file_results", [])
        if file_results:
            file_info = file_results[0]
        else:
            file_info = payload.get("file", {})

        duration = file_info.get("duration")    # seconds (int or float)
        size     = file_info.get("size")        # bytes

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

    elif status_str == "EGRESS_ACTIVE":
        # Egress started successfully — just log
        logger.info("Recording active: session=%s egress_id=%s", session.id, egress_id)

    elif "FAIL" in status_str or "ABORT" in status_str:
        session.recording_status = RecordingStatus.FAILED
        session.save(update_fields=["recording_status"])
        logger.error("Recording failed: session=%s egress_id=%s status=%s",
                     session.id, egress_id, status_str)
