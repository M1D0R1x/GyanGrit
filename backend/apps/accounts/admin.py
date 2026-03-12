from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django import forms

from .models import (
    User, StudentRegistrationRecord, OTPVerification,
    DeviceSession, AuditLog, JoinCode,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    autocomplete_fields = ("institution", "section")
    list_select_related = ("institution", "section")
    list_per_page = 50

    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Custom Fields", {
            "fields": ("role", "institution", "section", "public_id", "district")
        }),
    )

    list_display = ("username", "role", "institution", "section", "public_id", "is_staff", "is_active", "date_joined")
    list_filter = ("role", "is_staff", "is_active")
    search_fields = ("username", "email", "public_id")
    ordering = ("-date_joined",)
    readonly_fields = ("district",)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        qs = qs.defer("password")  # Skip heavy fields
        return qs


class JoinCodeForm(forms.ModelForm):
    class Meta:
        model = JoinCode
        fields = "__all__"


@admin.register(JoinCode)
class JoinCodeAdmin(admin.ModelAdmin):
    form = JoinCodeForm

    list_display = ("code", "role", "institution", "section", "district", "created_by", "is_used", "expires_at")
    list_filter = ("role", "is_used")
    search_fields = ("code", "created_by__username", "institution__name", "district__name")
    readonly_fields = ("code", "created_at", "expires_at", "is_used")
    ordering = ("-created_at",)
    autocomplete_fields = ("institution", "section", "district", "created_by")

    class Media:
        js = ('admin/js/joincode_dynamic.js',)


admin.site.register(StudentRegistrationRecord)
admin.site.register(OTPVerification)
admin.site.register(DeviceSession)
admin.site.register(AuditLog)