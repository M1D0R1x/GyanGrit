import logging
from typing import Any

from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.http import HttpRequest

from .models import (
    AuditLog,
    DeviceSession,
    JoinCode,
    OTPVerification,
    StudentRegistrationRecord,
    User,
)
from apps.academics.models import Subject
from .services import assign_teacher_to_classes

logger = logging.getLogger(__name__)


# =========================================================
# USER ADMIN FORM
# =========================================================

class TeacherUserForm(forms.ModelForm):
    """
    Adds a transient 'subject' field to the User admin form.

    IMPORTANT: 'subject' is NOT a field on the User model.
    It is a workflow-only field that triggers TeachingAssignment
    creation inside save_model() via assign_teacher_to_classes().
    It must NOT be listed alongside real model fields in fieldsets.
    """
    subject = forms.ModelChoiceField(
        queryset=Subject.objects.all(),
        required=False,
        help_text=(
            "Select subject taught by this teacher. "
            "Auto-creates TeachingAssignments for grades 6–10 "
            "in their institution."
        ),
    )

    class Meta:
        model = User
        fields = "__all__"


# =========================================================
# USER ADMIN
# =========================================================

# PyCharm cannot infer the correct type for DjangoUserAdmin.fieldsets
# concatenation. We build the extra fieldsets separately and annotate
# the final assignment explicitly to silence the type warning.
_GYANGRIT_PROFILE_FIELDSET: tuple = (
    "GyanGrit Profile",
    {
        "fields": (
            "role",
            "institution",
            "section",
            "public_id",
            "district",
        ),
    },
)

# subject is a form-only field — not on the User model.
# PyCharm warns "Cannot resolve admin field 'subject'" because it checks
# fieldsets against model fields. Keeping this in a separate variable with
# a comment makes the intent explicit and keeps the warning localised.
_TEACHER_ASSIGNMENT_FIELDSET: tuple = (
    "Teacher Assignment (workflow only — not stored on User)",
    {
        # noinspection PyUnresolvedReferences
        # 'subject' is declared on TeacherUserForm, not on User model.
        # This is intentional — it triggers TeachingAssignment creation.
        "fields": ("subject",),
        "description": (
            "Selecting a subject here will auto-create TeachingAssignment "
            "records for this teacher across all sections of grades 6–10 "
            "in their institution. This field is not stored on the User model."
        ),
    },
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):

    form = TeacherUserForm
    autocomplete_fields = ("institution", "section")
    list_select_related = ("institution", "section")
    list_per_page = 50

    # Explicitly typed to satisfy PyCharm's type checker for fieldsets
    fieldsets = (  # type: ignore[assignment]
        *DjangoUserAdmin.fieldsets,
        _GYANGRIT_PROFILE_FIELDSET,
        _TEACHER_ASSIGNMENT_FIELDSET,
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
    readonly_fields = ("district",)

    def get_queryset(self, request: HttpRequest):
        return super().get_queryset(request).defer("password")

    def save_model(
        self,
        request: HttpRequest,
        obj: Any,
        form: TeacherUserForm,
        change: bool,
    ) -> None:
        super().save_model(request, obj, form, change)

        # Explicitly cast to User so PyCharm resolves .role and .institution
        user: User = obj  # type: ignore[assignment]

        subject = form.cleaned_data.get("subject")

        if user.role == "TEACHER" and subject and user.institution:
            assign_teacher_to_classes(user, subject, user.institution)


# =========================================================
# JOIN CODE ADMIN FORM
# =========================================================

class JoinCodeForm(forms.ModelForm):
    class Meta:
        model = JoinCode
        fields = "__all__"


# =========================================================
# JOIN CODE ADMIN
# =========================================================

@admin.register(JoinCode)
class JoinCodeAdmin(admin.ModelAdmin):

    form = JoinCodeForm

    list_display = (
        "code",
        "role",
        "institution",
        "section",
        "district",
        "subject",
        "created_by",
        "is_used",
        "expires_at",
    )

    list_filter = ("role", "is_used")

    search_fields = (
        "code",
        "created_by__username",
        "institution__name",
        "district__name",
    )

    readonly_fields = (
        "code",
        "created_at",
        "expires_at",
        "is_used",
    )

    ordering = ("-created_at",)

    autocomplete_fields = (
        "institution",
        "section",
        "district",
        "created_by",
        "subject",
    )

    class Media:
        js = ("admin/js/joincode_dynamic.js",)


# =========================================================
# OTHER MODELS
# =========================================================

admin.site.register(StudentRegistrationRecord)
admin.site.register(OTPVerification)
admin.site.register(DeviceSession)
admin.site.register(AuditLog)