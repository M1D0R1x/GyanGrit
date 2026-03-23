# apps.chatrooms.models
"""
Chat Rooms — GyanGrit school messaging.

Room types:
  subject  — One per Section × Subject. e.g. "Class 10A Computer Science"
             Members: all students of that section + teacher of that subject + ADMIN
  staff    — One per Institution. e.g. "Government SSS Amritsar — Staff"
             Members: all teachers + principal of that institution + ADMIN
  officials — One platform-wide. Members: officials + principals + ADMIN

Key design decisions:
  - ChatRoomMember tracks explicit membership.
    This enables: push notifications (who to ping), member counts,
    signal-based auto-enroll, and admin moderation.
  - ADMIN is always a member of every room, shown as "Chat Moderator".
  - class_general rooms are NOT used — removed from creation logic.
  - Lazy creation: rooms created on first relevant signal/access.
  - All 12 subjects × 5 classes = 60 subject rooms per school (only for schools
    with actual teaching assignments).

Permissions:
  TEACHER  → full post + reply + pin + file share in their subject rooms
  STUDENT  → reply-only in subject rooms; no file sharing
  PRINCIPAL → post in staff + all subject rooms of their school
  OFFICIAL  → post in officials room
  ADMIN    → post anywhere, shown as "Chat Moderator"

Push notifications:
  On every new message, backend publishes to Ably channel
  notifications:{user_id} for each member of the room.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


class RoomType(models.TextChoices):
    SUBJECT   = "subject",   "Subject"
    STAFF     = "staff",     "Staff"
    OFFICIALS = "officials", "Officials"


class ChatRoom(models.Model):
    room_type   = models.CharField(max_length=16, choices=RoomType.choices, db_index=True)
    name        = models.CharField(max_length=200, db_index=True)

    # For subject rooms
    section     = models.ForeignKey(
        "academics.Section", on_delete=models.CASCADE,
        null=True, blank=True, related_name="chat_rooms",
    )
    subject     = models.ForeignKey(
        "academics.Subject", on_delete=models.CASCADE,
        null=True, blank=True, related_name="chat_rooms",
    )
    # For staff rooms
    institution = models.ForeignKey(
        "academics.Institution", on_delete=models.CASCADE,
        null=True, blank=True, related_name="staff_chat_rooms",
    )

    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["room_type", "name"]
        indexes  = [
            models.Index(fields=["room_type", "section"]),
            models.Index(fields=["room_type", "institution"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["section", "subject"],
                condition=models.Q(room_type="subject"),
                name="unique_subject_room_per_section_subject",
            ),
            models.UniqueConstraint(
                fields=["institution"],
                condition=models.Q(room_type="staff"),
                name="unique_staff_room_per_institution",
            ),
        ]

    def __str__(self):
        return self.name

    @property
    def ably_channel(self) -> str:
        return f"chat:{self.id}"


class ChatRoomMember(models.Model):
    """
    Explicit membership record.
    Enables push notifications, member counts, and admin visibility.
    """
    room      = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="members")
    user      = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_memberships",
    )
    joined_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("room", "user")
        indexes = [models.Index(fields=["user", "room"])]

    def __str__(self):
        return f"{self.user.username} in {self.room.name}"


class ChatMessage(models.Model):
    room            = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="messages")
    sender          = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_messages",
    )
    content         = models.TextField(blank=True)

    # Attachments (R2 URL — teacher/admin only)
    attachment_url  = models.URLField(max_length=1000, blank=True, null=True)
    attachment_type = models.CharField(
        max_length=10, choices=[("image", "Image"), ("file", "File")],
        blank=True, null=True,
    )
    attachment_name = models.CharField(max_length=255, blank=True, null=True)

    # Thread: null = top-level, set = reply
    parent          = models.ForeignKey(
        "self", on_delete=models.CASCADE,
        null=True, blank=True, related_name="replies",
    )

    is_pinned       = models.BooleanField(default=False, db_index=True)
    sent_at         = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["sent_at"]
        indexes  = [
            models.Index(fields=["room", "sent_at"]),
            models.Index(fields=["room", "parent"]),
            models.Index(fields=["room", "is_pinned"]),
        ]

    def __str__(self):
        return f"{self.sender.username}: {self.content[:40]}"
