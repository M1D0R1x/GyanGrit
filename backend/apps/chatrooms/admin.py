from django.contrib import admin
from .models import ChatRoom, ChatMessage


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display  = ("name", "room_type", "is_active", "created_at")
    list_filter   = ("room_type", "is_active")
    search_fields = ("name",)
    ordering      = ("room_type", "name")


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display  = ("room", "sender", "content", "is_pinned", "parent", "sent_at")
    list_filter   = ("is_pinned", "room__room_type")
    search_fields = ("sender__username", "content")
    raw_id_fields = ("parent",)
