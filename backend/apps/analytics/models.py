# apps.analytics.models
"""
Engagement metrics for GyanGrit.

Tracks time-on-task for lessons, live sessions, and AI chat.
Designed to produce measurable data for the research paper:
  - lesson_duration: how long a student spent reading a lesson
  - session_watch_time: how long a student was in a live session
  - assessment_time: how long a student spent on an assessment attempt
  - ai_chat_count: number of AI chat messages per day per student

All events are append-only — no updates or deletes. This makes the data
suitable for time-series analysis and before/after comparisons.

The frontend sends a "heartbeat" every 30 seconds while a student is
actively viewing a lesson. The backend accumulates these into EngagementEvent
records. This is more accurate than tracking page-open-to-close because
it filters out idle tabs.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


class EventType(models.TextChoices):
    LESSON_VIEW      = "lesson_view",      "Lesson View"
    LIVE_SESSION     = "live_session",      "Live Session Watch"
    ASSESSMENT       = "assessment",        "Assessment Attempt"
    AI_CHAT          = "ai_chat",           "AI Chat Message"
    FLASHCARD_STUDY  = "flashcard_study",   "Flashcard Study"


class EngagementEvent(models.Model):
    """
    Single engagement event. Created when the frontend sends a heartbeat
    or when a trackable action completes (assessment submitted, AI message sent).

    For lesson_view and live_session, `duration_seconds` accumulates via
    heartbeats (each heartbeat adds 30s). For assessment and ai_chat,
    it's a one-shot event with the total duration.
    """
    user             = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="engagement_events", db_index=True,
    )
    event_type       = models.CharField(max_length=20, choices=EventType.choices, db_index=True)
    # Polymorphic reference: lesson_id, session_id, assessment_id, etc.
    resource_id      = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    resource_label   = models.CharField(max_length=200, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)
    created_at       = models.DateTimeField(default=timezone.now, db_index=True)
    # Date partition for efficient aggregation queries
    event_date       = models.DateField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "event_type", "event_date"]),
            models.Index(fields=["event_type", "event_date"]),
            models.Index(fields=["user", "resource_id", "event_type"]),
        ]

    def __str__(self):
        return f"{self.user_id} {self.event_type} {self.resource_id} {self.duration_seconds}s"


class DailyEngagementSummary(models.Model):
    """
    Pre-aggregated daily summary per user. Updated by a nightly cron or
    on-the-fly when queried (lazy aggregation).

    This avoids scanning millions of EngagementEvent rows for dashboard
    queries. One row per user per day.
    """
    user               = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="daily_engagement",
    )
    date               = models.DateField(db_index=True)
    lesson_minutes     = models.PositiveIntegerField(default=0)
    live_session_minutes = models.PositiveIntegerField(default=0)
    assessment_minutes = models.PositiveIntegerField(default=0)
    ai_messages        = models.PositiveIntegerField(default=0)
    flashcard_minutes  = models.PositiveIntegerField(default=0)
    total_minutes      = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("user", "date")
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["date"]),
        ]

    def __str__(self):
        return f"{self.user_id} {self.date} {self.total_minutes}min"
