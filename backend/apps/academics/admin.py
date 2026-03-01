from django.contrib import admin
from .models import (
    Institution,
    ClassRoom,
    Section,
    Subject,
    TeachingAssignment,
)


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "district", "created_at")
    search_fields = ("name", "district")
    ordering = ("-created_at",)


@admin.register(ClassRoom)
class ClassRoomAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "institution", "created_at")
    list_filter = ("institution",)
    search_fields = ("name",)
    ordering = ("institution", "name")


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "classroom")
    list_filter = ("classroom__institution", "classroom")
    search_fields = ("name",)
    ordering = ("classroom", "name")


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "institution")
    list_filter = ("institution",)
    search_fields = ("name",)
    ordering = ("institution", "name")


@admin.register(TeachingAssignment)
class TeachingAssignmentAdmin(admin.ModelAdmin):
    list_display = ("teacher", "subject", "section")
    list_filter = ("teacher__institution", "subject", "section")
    search_fields = ("teacher__username", "subject__name", "section__name")
    ordering = ("-id",)