from django.contrib import admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin
from .models import ChatRoom, ChatRoomMember, ChatMessage


@admin.register(ChatRoom)
class ChatRoomAdmin(UnfoldModelAdmin):
    list_display  = ("name", "room_type", "member_count", "is_active", "created_at")
    list_filter   = ("room_type", "is_active")
    search_fields = ("name",)
    ordering      = ("room_type", "name")

    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = "Members"


@admin.register(ChatRoomMember)
class ChatRoomMemberAdmin(UnfoldModelAdmin):
    list_display  = ("room", "user", "joined_at")
    list_filter   = ("room__room_type",)
    search_fields = ("room__name", "user__username")
    raw_id_fields = ("room", "user")


@admin.register(ChatMessage)
class ChatMessageAdmin(UnfoldModelAdmin):
    list_display  = ("room", "sender", "content_preview", "is_pinned", "parent", "sent_at")
    list_filter   = ("is_pinned", "room__room_type")
    search_fields = ("sender__username", "content")
    raw_id_fields = ("parent",)

    def content_preview(self, obj):
        return obj.content[:60] if obj.content else "📎 Attachment"
    content_preview.short_description = "Content"
