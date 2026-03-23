# apps.gamification.admin
from django.contrib import admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin
from apps.gamification.models import PointEvent, StudentPoints, StudentBadge, StudentStreak


@admin.register(PointEvent)
class PointEventAdmin(UnfoldModelAdmin):
    list_display  = ("user", "points", "reason", "lesson_id", "assessment_id", "created_at")
    list_filter   = ("reason",)
    search_fields = ("user__username",)
    readonly_fields = ("user", "points", "reason", "lesson_id", "assessment_id", "created_at")
    ordering      = ("-created_at",)

    def has_add_permission(self, request):
        return False  # Ledger — never create via admin

    def has_change_permission(self, request, obj=None):
        return False  # Ledger — never edit


@admin.register(StudentPoints)
class StudentPointsAdmin(UnfoldModelAdmin):
    list_display  = ("user", "total_points", "updated_at")
    search_fields = ("user__username",)
    readonly_fields = ("updated_at",)
    ordering      = ("-total_points",)


@admin.register(StudentBadge)
class StudentBadgeAdmin(UnfoldModelAdmin):
    list_display  = ("user", "badge_code", "earned_at")
    list_filter   = ("badge_code",)
    search_fields = ("user__username",)
    ordering      = ("-earned_at",)


@admin.register(StudentStreak)
class StudentStreakAdmin(UnfoldModelAdmin):
    list_display  = ("user", "current_streak", "longest_streak", "last_activity_date")
    search_fields = ("user__username",)
    ordering      = ("-current_streak",)