# apps.ai_assistant.models
"""
AI chatbot conversations — stored for teacher analytics.

ChatConversation — one per student per subject session.
ChatMessage      — individual messages within a conversation.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


class ChatConversation(models.Model):
    student    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="ai_conversations",
    )
    subject    = models.ForeignKey(
        "academics.Subject", on_delete=models.CASCADE,
        null=True, blank=True, related_name="ai_conversations",
    )
    started_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes  = [models.Index(fields=["student", "subject"])]

    def __str__(self):
        return f"{self.student.username} — {self.subject}"


class AIChatMessage(models.Model):
    ROLE_CHOICES = [("user", "User"), ("assistant", "Assistant")]

    conversation = models.ForeignKey(
        ChatConversation, on_delete=models.CASCADE, related_name="messages",
    )
    role         = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content      = models.TextField()
    created_at   = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.role}] {self.content[:60]}"
