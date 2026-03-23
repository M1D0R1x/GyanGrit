from django.contrib import admin
from .models import CompetitionRoom, CompetitionParticipant, CompetitionAnswer


@admin.register(CompetitionRoom)
class CompetitionRoomAdmin(admin.ModelAdmin):
    list_display  = ("title", "host", "section", "status", "scheduled_at", "created_at")
    list_filter   = ("status",)
    search_fields = ("title", "host__username")


@admin.register(CompetitionParticipant)
class CompetitionParticipantAdmin(admin.ModelAdmin):
    list_display = ("room", "student", "score", "rank", "joined_at")


@admin.register(CompetitionAnswer)
class CompetitionAnswerAdmin(admin.ModelAdmin):
    list_display = ("room", "student", "question", "is_correct", "marks_earned")
