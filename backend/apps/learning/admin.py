from django.contrib import admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin
from .models import Enrollment, LearningPath, LearningPathCourse


class LearningPathCourseInline(admin.TabularInline):
    model = LearningPathCourse
    extra = 1
    fields = ("course", "order")


@admin.register(LearningPath)
class LearningPathAdmin(UnfoldModelAdmin):
    list_display = ("name", "course_count", "created_at")
    search_fields = ("name", "description")
    ordering = ("name",)
    inlines = [LearningPathCourseInline]

    def course_count(self, obj):
        return obj.path_courses.count()
    course_count.short_description = "Courses"


@admin.register(LearningPathCourse)
class LearningPathCourseAdmin(UnfoldModelAdmin):
    list_display = ("learning_path", "course", "order")
    list_filter = ("learning_path", "course")
    search_fields = ("learning_path__name", "course__title")
    ordering = ("learning_path", "order")


@admin.register(Enrollment)
class EnrollmentAdmin(UnfoldModelAdmin):
    list_display = (
        "user",
        "course",
        "status",
        "enrolled_at",
        "completed_at",
    )
    list_filter = ("status", "course")
    search_fields = ("user__username", "course__title")
    readonly_fields = ("enrolled_at", "completed_at")
    ordering = ("-enrolled_at",)