from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.accounts.models import Institution, Section, User
import secrets


from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.academics.models import Institution, Section
from apps.accounts.models import User
import secrets


class JoinCode(models.Model):

    ROLE_CHOICES = (
        ("PRINCIPAL", "Principal"),
        ("TEACHER", "Teacher"),
        ("STUDENT", "Student"),
    )

    code = models.CharField(max_length=32, unique=True, editable=False)

    role = models.CharField(max_length=16, choices=ROLE_CHOICES)

    institution = models.ForeignKey(
        Institution,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )

    section = models.ForeignKey(
        Section,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        limit_choices_to={"role__in": ["ADMIN", "PRINCIPAL", "OFFICIAL", "TEACHER"]},
    )

    is_used = models.BooleanField(default=False)

    expires_at = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):

        if self.role in ["PRINCIPAL", "TEACHER"] and not self.institution:
            raise ValidationError("Institution required.")

        if self.role == "STUDENT" and not self.section:
            raise ValidationError("Section required.")

    def save(self, *args, **kwargs):

        if not self.code:
            self.code = secrets.token_hex(8)

        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(days=3)

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.role} - {self.code}"

    # -------------------------------------------------
    # VALIDATION
    # -------------------------------------------------

    def clean(self):
        """
        Enforce logical scoping rules.
        """

        # PRINCIPAL must have institution
        if self.role == "PRINCIPAL" and not self.institution:
            raise ValidationError("Principal join code requires institution.")

        # TEACHER must have institution
        if self.role == "TEACHER" and not self.institution:
            raise ValidationError("Teacher join code requires institution.")

        # STUDENT must have section
        if self.role == "STUDENT" and not self.section:
            raise ValidationError("Student join code requires section.")

        # Section must belong to institution if both provided
        if self.section and self.institution:
            if self.section.classroom.institution != self.institution:
                raise ValidationError("Section does not belong to selected institution.")

    # -------------------------------------------------
    # SAVE
    # -------------------------------------------------

    def save(self, *args, **kwargs):

        if not self.code:
            self.code = secrets.token_hex(8)

        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(days=3)

        self.full_clean()
        super().save(*args, **kwargs)

    # -------------------------------------------------
    # HELPERS
    # -------------------------------------------------

    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at

    def mark_as_used(self):
        if not self.is_used:
            self.is_used = True
            self.save(update_fields=["is_used"])

    def __str__(self):
        status = "Used" if self.is_used else f"Expires {self.expires_at.date()}"
        return f"{self.role} - {self.code[:8]}... ({status})"

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Join Code"
        verbose_name_plural = "Join Codes"