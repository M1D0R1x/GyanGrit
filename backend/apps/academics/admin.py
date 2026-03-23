from django.contrib import admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin
from .models import (
    District,
    Institution,
    ClassRoom,
    Section,
    Subject,
    ClassSubject,
    StudentSubject,
    TeachingAssignment,
)


@admin.register(District)
class DistrictAdmin(UnfoldModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(Institution)
class InstitutionAdmin(UnfoldModelAdmin):
    list_display = ("id", "name", "district", "created_at")
    search_fields = ("name", "district__name")
    ordering = ("-created_at",)
    autocomplete_fields = ("district",)


@admin.register(ClassRoom)
class ClassRoomAdmin(UnfoldModelAdmin):
    list_display = ("id", "name", "institution")
    list_filter = ("institution",)
    search_fields = ("name", "institution__name")
    ordering = ("institution", "name")
    autocomplete_fields = ("institution",)


@admin.register(Section)
class SectionAdmin(UnfoldModelAdmin):
    list_display = ("id", "name", "classroom")
    list_filter = ("classroom__institution", "classroom")

    # Strong search for autocomplete popup
    search_fields = (
        "name",
        "classroom__name",
        "classroom__institution__name",
    )
    ordering = ("classroom__institution", "classroom", "name")

    # Lightning fast + informative popup
    autocomplete_fields = ("classroom",)


@admin.register(Subject)
class SubjectAdmin(UnfoldModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(ClassSubject)
class ClassSubjectAdmin(UnfoldModelAdmin):
    list_display = ("id", "classroom", "subject")
    list_filter = ("classroom__institution", "classroom")
    search_fields = ("classroom__name", "subject__name")
    ordering = ("classroom", "subject")
    autocomplete_fields = ("classroom", "subject")


@admin.register(StudentSubject)
class StudentSubjectAdmin(UnfoldModelAdmin):
    list_display = ("id", "student", "subject", "classroom")
    list_filter = ("classroom__institution", "subject")
    search_fields = ("student__username", "subject__name")
    ordering = ("-id",)
    autocomplete_fields = ("student", "subject", "classroom")


@admin.register(TeachingAssignment)
class TeachingAssignmentAdmin(UnfoldModelAdmin):
    list_display = ("teacher", "subject", "section")
    list_filter = ("teacher__institution", "subject", "section")
    search_fields = ("teacher__username", "subject__name", "section__name")
    ordering = ("-id",)
    autocomplete_fields = ("teacher", "subject", "section")