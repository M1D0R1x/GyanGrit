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


# =========================================================
# INSTITUTION
# =========================================================

@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "district", "created_at")
    search_fields = ("name",)


# =========================================================
# CLASSROOM
# =========================================================

@admin.register(ClassRoom)
class ClassRoomAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "institution")
    list_filter = ("institution",)
    search_fields = ("name",)


# =========================================================
# SECTION
# =========================================================

@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "classroom")
    list_filter = ("classroom",)
    search_fields = ("name",)


# =========================================================
# USER
# =========================================================

@admin.register(User)
class UserAdmin(DjangoUserAdmin):

    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Institution & Role", {"fields": ("role", "institution", "section")}),
    )

    list_display = (
        "username",
        "role",
        "institution",
        "section",
        "is_staff",
        "is_active",
    )

    list_filter = ("role", "institution", "section", "is_staff", "is_active")
    search_fields = ("username", "email")


# =========================================================
# SUBJECT
# =========================================================

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "institution")
    list_filter = ("institution",)


# =========================================================
# TEACHING ASSIGNMENT
# =========================================================

@admin.register(TeachingAssignment)
class TeachingAssignmentAdmin(admin.ModelAdmin):
    list_display = ("teacher", "subject", "section")
    list_filter = ("teacher", "subject", "section")


# =========================================================
# STUDENT REGISTRATION RECORD
# =========================================================

@admin.register(StudentRegistrationRecord)
class StudentRegistrationRecordAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "student_uuid",
        "registration_code",
        "section",
        "is_registered",
    )
    list_filter = ("section", "is_registered")


# =========================================================
# OTP
# =========================================================

@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):
    list_display = ("user", "otp_code", "is_verified", "created_at")
    list_filter = ("is_verified",)


# =========================================================
# DEVICE SESSION
# =========================================================

@admin.register(DeviceSession)
class DeviceSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "device_fingerprint", "last_login")


# =========================================================
# AUDIT LOG
# =========================================================

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("actor", "action", "target_model", "target_id", "timestamp")
    list_filter = ("actor", "target_model")