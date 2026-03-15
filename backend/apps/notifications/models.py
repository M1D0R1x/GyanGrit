import logging

from django.conf import settings
from django.db import models

logger = logging.getLogger(__name__)


class Notification(models.Model):
    """
    In-app notification for a single user.

    type choices drive the icon shown in the frontend:
    - info    → ℹ blue
    - success → ✓ green
    - warning → ⚠ amber
    - error   → ✕ red
    """

    TYPE_CHOICES = (
        ("info",    "Info"),
        ("success", "Success"),
        ("warning", "Warning"),
        ("error",   "Error"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    title   = models.CharField(max_length=255)
    message = models.TextField(blank=True)
    type    = models.CharField(max_length=16, choices=TYPE_CHOICES, default="info")
    is_read = models.BooleanField(default=False)
    link    = models.CharField(max_length=500, blank=True)  # optional frontend route
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes  = [models.Index(fields=["user", "is_read", "-created_at"])]

    def __str__(self):
        return f"[{self.type}] {self.user.username}: {self.title}"

    @classmethod
    def send(cls, user, title, message="", type="info", link=""):
        """
        Convenience factory. Called from other apps to notify a user.
        Example:
            Notification.send(user, "Join code created", type="success")
        """
        n = cls.objects.create(
            user=user,
            title=title,
            message=message,
            type=type,
            link=link,
        )
        logger.info(
            "Notification created: id=%s user=%s type=%s title='%s'",
            n.id, user.username, type, title,
        )
        return n