from django.contrib import admin
from .models import ChatRoom, ChatMessage


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ("section", "is_active", "created_at")
    list_filter  = ("is_active",)


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display  = ("room", "sender", "content", "is_pinned", "sent_at")
    list_filter   = ("is_pinned",)
    search_fields = ("sender__username", "content")
