from django.contrib import admin
from .models import (
    Assessment,
    Question,
    QuestionOption,
    AssessmentAttempt,
)


class QuestionOptionInline(admin.TabularInline):
    model = QuestionOption
    extra = 4
    fields = ("text", "is_correct")
    readonly_fields = ("id",)


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1
    fields = ("text", "marks", "order")
    inlines = [QuestionOptionInline]  # nested inline for options



from django.contrib.admin import SimpleListFilter


class InstitutionFilter(SimpleListFilter):
    title = "Institution"
    parameter_name = "institution"

    def lookups(self, request, model_admin):
        from apps.accounts.models import Institution
        return [(i.id, i.name) for i in Institution.objects.all()]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(course__institution_id=self.value())
        return queryset



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
    list_filter = ("is_published", "course", InstitutionFilter) # ← fixed: removed invalid course__institution
    search_fields = ("title", "description", "course__title")
    ordering = ("-created_at",)
    readonly_fields = ("total_marks", "created_at")
    inlines = [QuestionInline]

    fieldsets = (
        ("Basic Info", {"fields": ("course", "title", "description")}),
        ("Marks & Status", {"fields": ("total_marks", "pass_marks", "is_published", "created_at")}),
    )


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "assessment",
        "text_short",
        "marks",
        "order",
    )
    list_filter = ("assessment__course", "assessment")
    search_fields = ("text", "assessment__title")
    ordering = ("assessment", "order")
    inlines = [QuestionOptionInline]

    def text_short(self, obj):
        return obj.text[:50] + "..." if len(obj.text) > 50 else obj.text
    text_short.short_description = "Question"


@admin.register(QuestionOption)
class QuestionOptionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "question",
        "text_short",
        "is_correct",
    )
    list_filter = ("is_correct", "question__assessment")
    search_fields = ("text", "question__text")
    ordering = ("question", "id")

    def text_short(self, obj):
        return obj.text[:50] + "..." if len(obj.text) > 50 else obj.text



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
    list_filter = ("passed", "assessment__course", "submitted_at")
    search_fields = ("user__username", "assessment__title")
    readonly_fields = ("started_at", "submitted_at", "score", "passed", "selected_options")
    ordering = ("-started_at",)