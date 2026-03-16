# apps.notifications.models
"""
Notification system for GyanGrit.

Two models:

1. Broadcast — the "sent message" record created by the sender.
   Represents one communication event with a defined audience scope.
   This is what teachers/principals/officials see in their sent history.

2. Notification — one row per recipient per Broadcast.
   This is what students/staff see in their notification panel.

Why two models?
Sending to a class of 40 students creates 1 Broadcast + 40 Notification rows.
The sender sees 1 sent item in their history, not 40. Recipients each get
their own is_read state. Deleting a Notification does not delete the Broadcast.
"""

import logging

from django.conf import settings
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


class AudienceType(models.TextChoices):
    # Direct — one specific user
    DIRECT          = "direct",          "Direct (single user)"
    # Class-level
    CLASS_ALL       = "class_all",       "Entire class (students + teachers)"
    CLASS_STUDENTS  = "class_students",  "Class — students only"
    CLASS_TEACHERS  = "class_teachers",  "Class — teachers only"
    # Institution-level (Principal scope)
    SCHOOL_ALL      = "school_all",      "Whole school"
    SCHOOL_STUDENTS = "school_students", "School — students only"
    SCHOOL_TEACHERS = "school_teachers", "School — teachers only"
    # District-level (Official scope)
    DISTRICT_ALL        = "district_all",        "Entire district"
    DISTRICT_STUDENTS   = "district_students",   "District — students only"
    DISTRICT_TEACHERS   = "district_teachers",   "District — teachers only"
    DISTRICT_PRINCIPALS = "district_principals", "District — principals only"
    # System (Admin / auto)
    SYSTEM = "system", "System-wide"


class NotificationType(models.TextChoices):
    INFO       = "info",        "Info"
    SUCCESS    = "success",     "Success"
    WARNING    = "warning",     "Warning"
    ERROR      = "error",       "Error"
    ANNOUNCEMENT = "announcement", "Announcement"
    ASSESSMENT = "assessment",  "Assessment"
    LESSON     = "lesson",      "Lesson"


class Broadcast(models.Model):
    """
    One record per send action. Tracks the sender, content, scope, and delivery stats.
    """
    sender        = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sent_broadcasts",
    )
    subject       = models.CharField(max_length=255, db_index=True)
    message       = models.TextField(blank=True)
    notification_type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        default=NotificationType.INFO,
        db_index=True,
    )
    audience_type  = models.CharField(
        max_length=30,
        choices=AudienceType.choices,
        default=AudienceType.DIRECT,
    )
    # Human-readable description of the audience scope
    # e.g. "Class 8 · Government Senior Secondary School Amritsar"
    audience_label = models.CharField(max_length=500, blank=True)
    # Optional link for recipients to navigate to
    link           = models.CharField(max_length=500, blank=True)
    # Optional file attachment (Cloudflare R2 URL or any CDN URL)
    attachment_url = models.URLField(blank=True)
    attachment_name = models.CharField(max_length=255, blank=True)
    sent_at        = models.DateTimeField(default=timezone.now, db_index=True)
    recipient_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-sent_at"]
        indexes  = [
            models.Index(fields=["sender", "-sent_at"]),
        ]

    def __str__(self):
        return f"Broadcast by {self.sender}: {self.subject}"


class Notification(models.Model):
    """
    One per-user notification row. Each Broadcast creates N of these.
    """
    broadcast = models.ForeignKey(
        Broadcast,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    user    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    # Denormalised from Broadcast for fast single-query panel load
    subject = models.CharField(max_length=255, db_index=True)
    message = models.TextField(blank=True)
    notification_type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        default=NotificationType.INFO,
        db_index=True,
    )
    is_read    = models.BooleanField(default=False, db_index=True)
    link       = models.CharField(max_length=500, blank=True)
    attachment_url  = models.URLField(blank=True)
    attachment_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["user", "is_read", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"[{self.notification_type}] {self.user.username}: {self.subject}"

    @classmethod
    def send(
        cls,
        user,
        subject,
        message="",
        notification_type=NotificationType.INFO,
        link="",
        attachment_url="",
        attachment_name="",
        broadcast=None,
    ):
        """
        Convenience factory for creating a single direct notification.
        Used internally by other apps (e.g. assessment published, lesson added).
        """
        n = cls.objects.create(
            user=user,
            subject=subject,
            message=message,
            notification_type=notification_type,
            is_read=False,
            link=link,
            attachment_url=attachment_url,
            attachment_name=attachment_name,
            broadcast=broadcast,
        )
        logger.info(
            "Notification created: id=%s user=%s type=%s subject='%s'",
            n.id, user.username, notification_type, subject,
        )
        return n