# apps.livesessions.models
"""
Live class sessions via LiveKit WebRTC.

LiveSession — teacher creates a session for a section.
  status: scheduled → live → ended
  livekit_room_name: unique room name in LiveKit (section_id + timestamp)

LiveAttendance — auto-created when a student joins. is_present=True.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


class SessionStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    LIVE      = "live",      "Live"
    ENDED     = "ended",     "Ended"


import uuid

def generate_public_id():
    return str(uuid.uuid4())[:8]

class RecordingStatus(models.TextChoices):
    NONE       = "none",       "None"
    PROCESSING = "processing", "Processing"
    READY      = "ready",      "Ready"
    FAILED     = "failed",     "Failed"


class LiveSession(models.Model):
    public_id       = models.CharField(max_length=20, default=generate_public_id, unique=True, db_index=True)
    title           = models.CharField(max_length=200)
    section         = models.ForeignKey(
        "academics.Section", on_delete=models.CASCADE, related_name="live_sessions",
    )
    subject         = models.ForeignKey(
        "academics.Subject", on_delete=models.CASCADE,
        null=True, blank=True, related_name="live_sessions",
    )
    teacher         = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="hosted_sessions",
    )
    status          = models.CharField(
        max_length=12, choices=SessionStatus.choices,
        default=SessionStatus.SCHEDULED, db_index=True,
    )
    livekit_room_name = models.CharField(max_length=200, unique=True, db_index=True)
    scheduled_at    = models.DateTimeField(default=timezone.now, db_index=True)
    started_at      = models.DateTimeField(null=True, blank=True)
    ended_at        = models.DateTimeField(null=True, blank=True)
    description     = models.TextField(blank=True)
    created_at      = models.DateTimeField(default=timezone.now)

    # ── Recording (LiveKit Egress → Cloudflare R2) ─────────────────────────────
    recording_status   = models.CharField(
        max_length=12,
        choices=RecordingStatus.choices,
        default=RecordingStatus.NONE,
        db_index=True,
    )
    # R2 object key (e.g. recordings/101/10-A/Mathematics/2026-04-03_10-30_slug.mp4)
    recording_r2_key   = models.CharField(max_length=500, blank=True)
    # Public CDN URL served to students
    recording_url      = models.URLField(blank=True)
    # Duration in seconds (filled by webhook callback)
    recording_duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    # File size in bytes (filled by webhook callback)
    recording_size_bytes       = models.BigIntegerField(null=True, blank=True)
    # LiveKit Egress job ID for cancellation / status polling
    recording_egress_id        = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-scheduled_at"]
        indexes  = [
            models.Index(fields=["section", "status"]),
            models.Index(fields=["teacher", "status"]),
            # For "my recordings" queries — students browse section recordings
            models.Index(fields=["section", "recording_status", "-scheduled_at"]),
        ]

    def __str__(self):
        return f"{self.title} [{self.status}]"


class LiveAttendance(models.Model):
    session    = models.ForeignKey(LiveSession, on_delete=models.CASCADE, related_name="attendance")
    student    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="session_attendance",
    )
    joined_at  = models.DateTimeField(default=timezone.now)
    left_at    = models.DateTimeField(null=True, blank=True)
    is_present = models.BooleanField(default=True)

    class Meta:
        unique_together = ("session", "student")
        indexes = [models.Index(fields=["session", "is_present"])]

    def __str__(self):
        return f"{self.student.username} @ {self.session.title}"
