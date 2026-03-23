# apps.notifications.admin
from django.contrib import admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin
from apps.notifications.models import Broadcast, Notification


@admin.register(Broadcast)
class BroadcastAdmin(UnfoldModelAdmin):
    list_display  = ("id", "sender", "subject", "notification_type", "audience_type", "audience_label", "recipient_count", "sent_at")
    list_filter   = ("notification_type", "audience_type", "sent_at")
    search_fields = ("sender__username", "subject", "message", "audience_label")
    ordering      = ("-sent_at",)
    readonly_fields = ("sent_at", "recipient_count")


@admin.register(Notification)
class NotificationAdmin(UnfoldModelAdmin):
    list_display  = ("id", "user", "notification_type", "subject", "is_read", "created_at", "broadcast")
    list_filter   = ("notification_type", "is_read")
    search_fields = ("user__username", "subject", "message")
    ordering      = ("-created_at",)
    readonly_fields = ("created_at",)
    raw_id_fields = ("broadcast",)