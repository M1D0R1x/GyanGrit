from django.db import models
from django.utils import timezone
from apps.accounts.models import Institution, Section, User
import secrets


class JoinCode(models.Model):
    ROLE_CHOICES = (
        ("PRINCIPAL", "Principal"),
        ("TEACHER", "Teacher"),
        ("STUDENT", "Student"),
    )

    code = models.CharField(
        max_length=32,
        unique=True,
        editable=False,           # Prevent changing code after creation
    )

    role = models.CharField(
        max_length=16,
        choices=ROLE_CHOICES,
    )

    district = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )

    institution = models.ForeignKey(
        Institution,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="join_codes",
    )

    section = models.ForeignKey(
        Section,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="join_codes",
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_join_codes",
    )

    is_used = models.BooleanField(
        default=False,
        editable=False,           # Prevent manual toggle in admin
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        editable=False,
    )

    expires_at = models.DateTimeField(
        editable=False,
    )

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = secrets.token_hex(8)

        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(days=3)

        super().save(*args, **kwargs)

    def is_valid(self):
        """Check if code is still usable"""
        return not self.is_used and timezone.now() < self.expires_at

    def mark_as_used(self):
        """Mark code as used after successful registration"""
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
        # Optional: uncomment if you want one code per role + scope
        # unique_together = ("role", "institution", "section")