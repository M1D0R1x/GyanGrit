from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import (
    User,
    StudentRegistrationRecord,
    OTPVerification,
    DeviceSession,
    AuditLog,
    JoinCode,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Super optimized - fast autocomplete + readonly district"""

    # Lightning fast searchable dropdowns
    autocomplete_fields = ("institution", "section")

    # Performance improvements
    list_select_related = ("institution", "section")
    list_per_page = 50

    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Custom Fields", {
            "fields": ("role", "institution", "section", "public_id", "district")
        }),
    )

    list_display = (
        "username",
        "role",
        "institution",
        "section",
        "public_id",
        "is_staff",
        "is_active",
        "date_joined",
    )

    list_filter = ("role", "is_staff", "is_active")
    search_fields = ("username", "email", "public_id")
    ordering = ("-date_joined",)

    # District is auto-filled from institution, so make it readonly
    readonly_fields = ("district",)


@admin.register(JoinCode)
class JoinCodeAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "role",
        "institution",
        "section",
        "created_by",
        "is_used",
        "expires_at",
        "created_at",
    )

    list_filter = ("role", "is_used")
    search_fields = ("code", "created_by__username", "institution__name")
    readonly_fields = ("code", "created_at", "expires_at", "is_used")
    ordering = ("-created_at",)

    # Fast autocomplete for all foreign keys
    autocomplete_fields = ("institution", "section", "created_by")


# Simple models
admin.site.register(StudentRegistrationRecord)
admin.site.register(OTPVerification)
admin.site.register(DeviceSession)
admin.site.register(AuditLog)