from django.contrib import admin
from .models import JoinCode


@admin.register(JoinCode)
class JoinCodeAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "role",
        "district",
        "institution",
        "section",
        "created_by",
        "is_used",
        "expires_at",
        "created_at",  # ← added for visibility
    )
    list_filter = ("role", "is_used", "institution", "expires_at")
    search_fields = ("code", "created_by__username", "institution__name")
    readonly_fields = ("code", "created_at", "expires_at")  # ← prevent editing sensitive fields
    ordering = ("-created_at",)
    list_per_page = 25

    fieldsets = (
        ("Code & Status", {
            "fields": ("code", "role", "is_used", "expires_at", "created_at")
        }),
        ("Scope", {
            "fields": ("district", "institution", "section")
        }),
        ("Creator", {
            "fields": ("created_by",)
        }),
    )