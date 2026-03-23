from django.contrib import admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin
from .models import Course, Lesson, LessonProgress


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 1
    fields = ("title", "order", "is_published")
    ordering = ["order"]
    show_change_link = True


@admin.register(Course)
class CourseAdmin(UnfoldModelAdmin):
    list_display = (
        "id",
        "title",
        "subject",
        "grade",
        "is_core",
        "lesson_count",
        "created_at",
    )
    list_filter = ("grade", "is_core", "subject")
    search_fields = ("title", "description", "subject__name")
    ordering = ("grade", "subject", "title")
    inlines = [LessonInline]

    def lesson_count(self, obj):
        return obj.lessons.count()
    lesson_count.short_description = "Lessons"


@admin.register(Lesson)
class LessonAdmin(UnfoldModelAdmin):
    list_display = (
        "id",
        "title",
        "course",
        "order",
        "is_published",
        "created_at",
    )
    list_filter = ("course", "is_published")
    search_fields = ("title", "course__title")
    ordering = ("course", "order")


@admin.register(LessonProgress)
class LessonProgressAdmin(UnfoldModelAdmin):
    list_display = (
        "lesson",
        "user",
        "completed",
        "last_position",
        "last_opened_at",
    )
    list_filter = ("completed", "lesson__course")
    search_fields = ("user__username", "lesson__title")
    readonly_fields = ("last_opened_at",)
    ordering = ("-last_opened_at",)