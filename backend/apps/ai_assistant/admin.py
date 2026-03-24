from django.contrib import admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin
from .models import ChatConversation, AIChatMessage


@admin.register(ChatConversation)
class ChatConversationAdmin(UnfoldModelAdmin):
    list_display  = ("student", "subject", "started_at", "updated_at")
    search_fields = ("student__username",)
    raw_id_fields = ("student",)


@admin.register(AIChatMessage)
class AIChatMessageAdmin(UnfoldModelAdmin):
    list_display  = ("conversation", "role", "content_preview", "created_at")
    list_filter   = ("role",)

    def content_preview(self, obj):
        return obj.content[:80]
    content_preview.short_description = "Content"
