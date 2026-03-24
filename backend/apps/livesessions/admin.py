from django.contrib import admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin
from .models import LiveSession, LiveAttendance


@admin.register(LiveSession)
class LiveSessionAdmin(UnfoldModelAdmin):
    list_display  = ("title", "teacher", "section", "status", "scheduled_at", "started_at", "ended_at")
    list_filter   = ("status",)
    search_fields = ("title", "teacher__username")


@admin.register(LiveAttendance)
class LiveAttendanceAdmin(UnfoldModelAdmin):
    list_display  = ("session", "student", "joined_at", "is_present")
    list_filter   = ("is_present",)
    search_fields = ("student__username",)
