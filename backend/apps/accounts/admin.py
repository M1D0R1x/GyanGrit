from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import (
    User,
    StudentRegistrationRecord,
    OTPVerification,
    DeviceSession,
    AuditLog,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Custom Fields", {"fields": ("role", "institution", "section", "public_id", "district")}),
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

    list_filter = ("role", "institution", "section", "is_staff", "is_active")
    search_fields = ("username", "email", "public_id")
    ordering = ("-date_joined",)


admin.site.register(StudentRegistrationRecord)
admin.site.register(OTPVerification)
admin.site.register(DeviceSession)
admin.site.register(AuditLog)