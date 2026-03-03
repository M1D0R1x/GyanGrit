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


class OTPVerification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otp_records")
    otp_code = models.CharField(max_length=6)
    is_verified = models.BooleanField(default=False)
    attempt_count = models.IntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_expired(self):
        # Changed to 10 minutes expiry (much better UX than end of day)
        return timezone.now() > self.created_at + timezone.timedelta(minutes=10)

    def can_attempt(self):
        return self.attempt_count < 5

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        status = "Verified" if self.is_verified else f"{self.attempt_count} attempts"
        return f"OTP for {self.user.username} - {status}"

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


from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.academics.models import Institution, Section
from apps.accounts.models import User
import secrets


# =========================================================
# JOIN CODE
# =========================================================

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

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Join Code"
        verbose_name_plural = "Join Codes"

    def clean(self):
        if self.role in ["PRINCIPAL", "TEACHER"] and not self.institution:
            raise ValidationError("Institution required.")

        if self.role == "STUDENT" and not self.section:
            raise ValidationError("Section required.")

        if self.section and self.institution:
            if self.section.classroom.institution != self.institution:
                raise ValidationError("Section does not belong to selected institution.")

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = secrets.token_hex(8)

        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(days=3)

        self.full_clean()
        super().save(*args, **kwargs)

    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at

    def mark_as_used(self):
        if not self.is_used:
            self.is_used = True
            self.save(update_fields=["is_used"])

    def __str__(self):
        status = "Used" if self.is_used else f"Expires {self.expires_at.date()}"
        return f"{self.role} - {self.code[:8]}... ({status})"