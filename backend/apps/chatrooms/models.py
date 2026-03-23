# apps.chatrooms.models
"""
Chat Rooms — class-based real-time chat using Ably Chat SDK.

Design:
- ChatRoom: one room per Section. Auto-created on first access.
  A section's room is permanent — it's their class chat channel.
- ChatMessage: persisted to DB for history (last 50 messages on load).
  Ably Chat SDK handles live delivery; backend stores the record.

Ably channel:  chat:{section_id}
  All Ably Chat messages are sent client→client via Ably.
  Backend only stores messages for history (POST /api/v1/chat/rooms/<id>/message/).

Roles:
  Student  → can read + send in their section's room only.
  Teacher  → can read + send in any room for their assigned sections.
             Can also pin messages (is_pinned=True).
  Principal/Admin → read + send in all rooms of their institution.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


class ChatRoom(models.Model):
    section    = models.OneToOneField(
        "academics.Section",
        on_delete=models.CASCADE,
        related_name="chat_room",
    )
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["section__classroom__name", "section__name"]

    def __str__(self):
        return f"Chat: {self.section}"


class ChatMessage(models.Model):
    room       = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender     = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_messages",
    )
    content    = models.TextField()
    is_pinned  = models.BooleanField(default=False, db_index=True)
    sent_at    = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["sent_at"]
        indexes  = [
            models.Index(fields=["room", "sent_at"]),
            models.Index(fields=["room", "is_pinned"]),
        ]

    def __str__(self):
        return f"{self.sender.username}: {self.content[:40]}"
