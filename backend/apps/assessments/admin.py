from django.contrib import admin

from .models import (
    Assessment,
    Question,
    QuestionOption,
    AssessmentAttempt,
)


@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "course",
        "total_marks",
        "pass_marks",
        "is_published",
        "created_at",
    )
    list_filter = ("is_published", "course")
    search_fields = ("title",)
    ordering = ("-created_at",)


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "assessment",
        "marks",
        "order",
    )
    list_filter = ("assessment",)
    ordering = ("assessment", "order")


@admin.register(QuestionOption)
class QuestionOptionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "question",
        "text",
        "is_correct",
    )
    list_filter = ("is_correct",)


@admin.register(AssessmentAttempt)
class AssessmentAttemptAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "assessment",
        "user",
        "score",
        "passed",
        "started_at",
        "submitted_at",
    )
    list_filter = ("passed", "assessment")
