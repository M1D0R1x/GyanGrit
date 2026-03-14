from django.contrib import admin
from .models import (
    Assessment,
    AssessmentAttempt,
    Question,
    QuestionOption,
)


class QuestionOptionInline(admin.TabularInline):
    model = QuestionOption
    extra = 4
    fields = ("text", "is_correct")


class QuestionInline(admin.StackedInline):
    """
    StackedInline (instead of Tabular) gives enough vertical space
    to also embed the option inline below each question.
    Note: nested inlines are not natively supported in Django admin.
    Options must be added via the QuestionAdmin separately.
    """
    model = Question
    extra = 1
    fields = ("text", "marks", "order")
    show_change_link = True  # links to QuestionAdmin where options can be added


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
    search_fields = ("title", "course__title")
    ordering = ("-created_at",)
    readonly_fields = ("total_marks", "created_at")
    inlines = [QuestionInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "assessment", "marks", "order")
    list_filter = ("assessment",)
    search_fields = ("text",)
    ordering = ("assessment", "order")
    inlines = [QuestionOptionInline]  # add options here


@admin.register(QuestionOption)
class QuestionOptionAdmin(admin.ModelAdmin):
    list_display = ("id", "question", "text", "is_correct")
    list_filter = ("is_correct",)
    search_fields = ("text",)
    ordering = ("question", "id")


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
    search_fields = ("user__username", "assessment__title")
    readonly_fields = (
        "started_at",
        "submitted_at",
        "score",
        "passed",
        "selected_options",
    )
    ordering = ("-started_at",)