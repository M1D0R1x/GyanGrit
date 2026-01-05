from django.contrib import admin

from .models import Enrollment, LearningPath, LearningPathCourse


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("course", "user", "status", "started_at")
    list_filter = ("status",)
    search_fields = ("course__title",)


@admin.register(LearningPath)
class LearningPathAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at")


@admin.register(LearningPathCourse)
class LearningPathCourseAdmin(admin.ModelAdmin):
    list_display = ("learning_path", "course", "order")
    list_filter = ("learning_path",)
