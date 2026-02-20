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

    code = models.CharField(max_length=32, unique=True)

    role = models.CharField(
        max_length=16,
        choices=ROLE_CHOICES,
    )

    district = models.CharField(max_length=255, blank=True, null=True)

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
    )

    is_used = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    expires_at = models.DateTimeField()

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = secrets.token_hex(8)

        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(days=3)

        super().save(*args, **kwargs)

    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at

    def __str__(self):
        return f"{self.role} - {self.code}"