from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User, Institution


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "district", "created_at")
    search_fields = ("name",)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """
    Admin configuration for custom User.
    """

    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Institution & Role", {"fields": ("role", "institution")}),
    )

    list_display = (
        "username",
        "email",
        "role",
        "institution",
        "is_staff",
        "is_active",
    )

    list_filter = ("role", "institution", "is_staff", "is_active")
    search_fields = ("username", "email")
