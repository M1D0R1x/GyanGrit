from django.contrib import admin
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
class DistrictAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "district", "created_at")
    search_fields = ("name", "district__name")  # ← FIXED (was broken)
    ordering = ("-created_at",)


@admin.register(ClassRoom)
class ClassRoomAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "institution", "created_at")
    list_filter = ("institution",)
    search_fields = ("name", "institution__name")
    ordering = ("institution", "name")


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "classroom")
    list_filter = ("classroom__institution", "classroom")
    search_fields = ("name",)
    ordering = ("classroom", "name")


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(ClassSubject)
class ClassSubjectAdmin(admin.ModelAdmin):
    list_display = ("id", "classroom", "subject")
    list_filter = ("classroom__institution", "classroom")
    search_fields = ("classroom__name", "subject__name")
    ordering = ("classroom", "subject")


@admin.register(StudentSubject)
class StudentSubjectAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "subject", "classroom")
    list_filter = ("classroom__institution", "subject")
    search_fields = ("student__username", "subject__name")
    ordering = ("-id",)


@admin.register(TeachingAssignment)
class TeachingAssignmentAdmin(admin.ModelAdmin):
    list_display = ("teacher", "subject", "section")
    list_filter = ("teacher__institution", "subject", "section")
    search_fields = ("teacher__username", "subject__name", "section__name")
    ordering = ("-id",)