from django.contrib import admin
from .models import Enrollment, LearningPath, LearningPathCourse


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


class LearningPathCourseInline(admin.TabularInline):
    model = LearningPathCourse
    extra = 1
    fields = ("course", "order")


@admin.register(LearningPath)
class LearningPathAdmin(admin.ModelAdmin):
    list_display = ("name", "course_count", "created_at")
    search_fields = ("name", "description")
    ordering = ("name",)
    inlines = [LearningPathCourseInline]

    def course_count(self, obj):
        return obj.path_courses.count()
    course_count.short_description = "Courses"


@admin.register(LearningPathCourse)
class LearningPathCourseAdmin(admin.ModelAdmin):
    list_display = ("learning_path", "course", "order")
    list_filter = ("learning_path", "course")  # ← fixed: removed invalid course__institution
    search_fields = ("learning_path__name", "course__title")
    ordering = ("learning_path", "order")


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "course",
        "status",
        "enrolled_at",
        "completed_at",
    )
    list_filter = ("status", "course")  # ← fixed: removed invalid course__institution
    search_fields = ("user__username", "course__title")
    readonly_fields = ("enrolled_at", "completed_at")
    ordering = ("-enrolled_at",)