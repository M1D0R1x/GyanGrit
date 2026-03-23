from django.contrib import admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin
from .models import CompetitionRoom, CompetitionParticipant, CompetitionAnswer


@admin.register(CompetitionRoom)
class CompetitionRoomAdmin(UnfoldModelAdmin):
    list_display  = ("title", "host", "section", "status", "scheduled_at", "created_at")
    list_filter   = ("status",)
    search_fields = ("title", "host__username")


@admin.register(CompetitionParticipant)
class CompetitionParticipantAdmin(UnfoldModelAdmin):
    list_display = ("room", "student", "score", "rank", "joined_at")


@admin.register(CompetitionAnswer)
class CompetitionAnswerAdmin(UnfoldModelAdmin):
    list_display = ("room", "student", "question", "is_correct", "marks_earned")
