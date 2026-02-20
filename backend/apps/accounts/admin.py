from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import (
    User,
    Institution,
    ClassRoom,
    Section,
    Subject,
    TeachingAssignment,
    StudentRegistrationRecord,
    OTPVerification,
    DeviceSession,
    AuditLog,
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


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Custom Fields", {"fields": ("role", "institution", "section", "public_id", "district")}),
    )

    list_display = (
        "username", "role", "institution", "section", "public_id",
        "is_staff", "is_active", "date_joined"
    )
    list_filter = ("role", "institution", "section", "is_staff", "is_active")
    search_fields = ("username", "email", "public_id")
    ordering = ("-date_joined",)


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


@admin.register(StudentRegistrationRecord)
class StudentRegistrationRecordAdmin(admin.ModelAdmin):
    list_display = (
        "name", "registration_code", "section", "is_registered",
        "created_at", "linked_user"
    )
    list_filter = ("section__classroom__institution", "is_registered")
    search_fields = ("name", "registration_code", "student_uuid")
    ordering = ("-created_at",)


@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):
    list_display = ("user", "otp_code", "is_verified", "attempt_count", "created_at")
    list_filter = ("is_verified", "user__role", "created_at")
    search_fields = ("user__username", "otp_code")
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "last_attempt_at")


@admin.register(DeviceSession)
class DeviceSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "device_fingerprint", "last_login")
    list_filter = ("user__role",)
    search_fields = ("user__username",)
    ordering = ("-last_login",)
    readonly_fields = ("last_login",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("actor", "action", "target_model", "target_id", "timestamp")
    list_filter = ("actor__role", "action", "timestamp")
    search_fields = ("actor__username", "action", "target_model")
    ordering = ("-timestamp",)
    readonly_fields = ("timestamp",)