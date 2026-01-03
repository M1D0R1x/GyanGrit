from django.contrib import admin
from .models import Course, Lesson, LessonProgress


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "created_at")


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "course", "order")
    list_filter = ("course",)


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = (
        "lesson",
        "completed",
        "last_position",
        "last_opened_at",
    )
    list_filter = ("completed",)
