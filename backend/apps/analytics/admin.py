from django.contrib import admin
from .models import EngagementEvent, DailyEngagementSummary


@admin.register(EngagementEvent)
class EngagementEventAdmin(admin.ModelAdmin):
    list_display = ("user", "event_type", "resource_label", "duration_seconds", "event_date", "created_at")
    list_filter  = ("event_type", "event_date")
    search_fields = ("user__username", "resource_label")
    date_hierarchy = "event_date"
    readonly_fields = ("created_at",)


@admin.register(DailyEngagementSummary)
class DailyEngagementSummaryAdmin(admin.ModelAdmin):
    list_display = ("user", "date", "total_minutes", "lesson_minutes", "live_session_minutes", "assessment_minutes", "ai_messages")
    list_filter  = ("date",)
    search_fields = ("user__username",)
    date_hierarchy = "date"
