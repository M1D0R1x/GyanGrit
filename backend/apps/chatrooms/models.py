# apps.chatrooms.models
"""
Chat Rooms — redesigned for GyanGrit school context.

Room types:
  class_general — One per Section. All students + teachers + principal + admin.
                  Room name: "6A — General" (section short_label)
  subject       — One per Section × Subject. Students + that subject's teacher + admin.
                  Room name: "6A English" (section short_label + subject name)
  staff         — One per Institution. All teachers + principal + admin.
                  Room name: "<School Name> — Staff"
  officials     — One platform-wide. All officials + principals + admin.
                  Room name: "Officials"

Permissions (enforced in views):
  ADMIN         → member of ALL rooms, shown as "Chat Moderator" (name hidden)
  TEACHER       → can post in their rooms; students can only reply
  STUDENT       → reply-only in class_general + subject rooms
  PRINCIPAL     → can post in staff + class_general of their school
  OFFICIAL      → can post in officials room only

File/image sharing:
  Only TEACHER and ADMIN (moderator) can share files/images.
  Students can only send text.

Thread/replies:
  ChatMessage.parent FK (nullable self-reference).
  Top-level messages: parent=None.
  Replies: parent=<message>.

Lazy creation:
  Rooms are NOT created upfront. They are created on first access (get_or_create).
  Signals trigger creation when relevant users are added.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


class RoomType(models.TextChoices):
    CLASS_GENERAL = "class_general", "Class General"
    SUBJECT       = "subject",       "Subject"
    STAFF         = "staff",         "Staff"
    OFFICIALS     = "officials",     "Officials"


class ChatRoom(models.Model):
    room_type    = models.CharField(
        max_length=16,
        choices=RoomType.choices,
        db_index=True,
    )
    name         = models.CharField(max_length=200, db_index=True)

    # For class_general + subject rooms
    section      = models.ForeignKey(
        "academics.Section",
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="chat_rooms",
    )
    # For subject rooms only
    subject      = models.ForeignKey(
        "academics.Subject",
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="chat_rooms",
    )
    # For staff rooms
    institution  = models.ForeignKey(
        "academics.Institution",
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="staff_chat_rooms",
    )

    is_active    = models.BooleanField(default=True)
    created_at   = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["room_type", "name"]
        indexes  = [
            models.Index(fields=["room_type", "section"]),
            models.Index(fields=["room_type", "institution"]),
        ]
        # Unique constraints per room type
        constraints = [
            models.UniqueConstraint(
                fields=["section"],
                condition=models.Q(room_type="class_general"),
                name="unique_class_general_per_section",
            ),
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
        """Ably channel name for this room."""
        return f"chat:{self.id}"


class ChatMessage(models.Model):
    room         = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_messages",
    )
    content      = models.TextField(blank=True)

    # File/image attachment (R2 URL or null)
    attachment_url  = models.URLField(max_length=1000, blank=True, null=True)
    attachment_type = models.CharField(
        max_length=10,
        choices=[("image", "Image"), ("file", "File")],
        blank=True, null=True,
    )
    attachment_name = models.CharField(max_length=255, blank=True, null=True)

    # Thread support — null = top-level message, set = reply
    parent       = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="replies",
    )

    is_pinned    = models.BooleanField(default=False, db_index=True)
    sent_at      = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["sent_at"]
        indexes  = [
            models.Index(fields=["room", "sent_at"]),
            models.Index(fields=["room", "parent"]),
            models.Index(fields=["room", "is_pinned"]),
        ]

    def __str__(self):
        return f"{self.sender.username}: {self.content[:40]}"
