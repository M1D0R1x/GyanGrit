from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.utils import timezone
import uuid
import secrets
from datetime import time

# Import academic models
from apps.academics.models import Institution, Section


# =========================================================
# USER (IDENTITY ONLY)
# =========================================================

class User(AbstractUser):

    ROLE_CHOICES = (
        ("STUDENT", "Student"),
        ("TEACHER", "Teacher"),
        ("PRINCIPAL", "Principal"),
        ("OFFICIAL", "Official"),
        ("ADMIN", "Admin"),
    )

    role = models.CharField(
        max_length=16,
        choices=ROLE_CHOICES,
        default="STUDENT",
    )

    institution = models.ForeignKey(
        Institution,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users",
    )

    section = models.ForeignKey(
        Section,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="students",
    )

    public_id = models.CharField(
        max_length=32,
        unique=True,
        blank=True,
        null=True,
    )

    district = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )

    def generate_public_id(self):
        year = timezone.now().year
        if self.role == "STUDENT":
            return f"S-{year}-{secrets.token_hex(4)}"
        elif self.role == "TEACHER":
            return f"T-{secrets.token_hex(6)}"
        elif self.role == "PRINCIPAL":
            return f"P-{secrets.token_hex(6)}"
        elif self.role == "OFFICIAL":
            return f"O-{secrets.token_hex(6)}"
        elif self.role == "ADMIN":
            return f"A-{secrets.token_hex(6)}"
        return secrets.token_hex(8)

    def clean(self):
        if self.section and not self.institution:
            raise ValidationError("User must belong to an institution if assigned to a section.")
        if self.section and self.section.classroom.institution != self.institution:
            raise ValidationError("Section institution must match user's institution.")

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = self.generate_public_id()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.role})"


# =========================================================
# STUDENT REGISTRATION RECORD
# =========================================================

class StudentRegistrationRecord(models.Model):
    student_uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    registration_code = models.CharField(max_length=32, unique=True)

    name = models.CharField(max_length=255)
    dob = models.DateField()

    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="registration_records",
    )

    is_registered = models.BooleanField(default=False)

    linked_user = models.OneToOneField(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="registration_record",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.registration_code:
            self.registration_code = secrets.token_hex(8)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.section})"


# =========================================================
# OTP VERIFICATION
# =========================================================

class OTPVerification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otp_records")
    otp_code = models.CharField(max_length=6)
    is_verified = models.BooleanField(default=False)
    attempt_count = models.IntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_expired(self):
        creation_date = self.created_at.date()
        day_end = timezone.datetime.combine(creation_date, time(23, 59, 59, 999999))
        day_end = timezone.make_aware(day_end)
        return timezone.now() > day_end

    def can_attempt(self):
        return self.attempt_count < 5

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        status = "Verified" if self.is_verified else f"{self.attempt_count} attempts"
        return f"OTP for {self.user.username} - {status} ({self.created_at.date()})"


# =========================================================
# DEVICE SESSION
# =========================================================

class DeviceSession(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="device_session")
    device_fingerprint = models.CharField(max_length=255)
    last_login = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.device_fingerprint[:16]}..."


# =========================================================
# AUDIT LOG
# =========================================================

class AuditLog(models.Model):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="audit_logs")
    action = models.CharField(max_length=255)
    target_model = models.CharField(max_length=255)
    target_id = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.actor} - {self.action}"