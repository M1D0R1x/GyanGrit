from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.utils import timezone
import uuid
import secrets


# =========================================================
# INSTITUTION
# =========================================================

class Institution(models.Model):
    name = models.CharField(max_length=255)
    district = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# =========================================================
# CLASS (e.g., Grade 10)
# =========================================================

class ClassRoom(models.Model):
    name = models.CharField(max_length=100)

    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="classes",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("name", "institution")

    def __str__(self):
        return f"{self.name} - {self.institution.name}"


# =========================================================
# SECTION (e.g., 10A, 10B)
# =========================================================

class Section(models.Model):
    name = models.CharField(max_length=20)

    classroom = models.ForeignKey(
        ClassRoom,
        on_delete=models.CASCADE,
        related_name="sections",
    )

    class Meta:
        unique_together = ("name", "classroom")

    def __str__(self):
        return f"{self.classroom.name} {self.name}"


# =========================================================
# SUBJECT
# =========================================================

class Subject(models.Model):
    name = models.CharField(max_length=100)

    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="subjects",
    )

    def __str__(self):
        return f"{self.name} ({self.institution.name})"


# =========================================================
# USER
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

    # 🔴 NEW: Public readable ID
    public_id = models.CharField(
        max_length=32,
        unique=True,
        blank=True,
        null=True,
    )

    # 🔴 NEW: Only used for OFFICIAL role
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
        if self.section:
            if not self.institution:
                raise ValidationError(
                    "User must belong to an institution if assigned to a section."
                )
            if self.section.classroom.institution != self.institution:
                raise ValidationError(
                    "Section institution must match user's institution."
                )

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = self.generate_public_id()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.role})"


# =========================================================
# TEACHING ASSIGNMENT
# =========================================================

class TeachingAssignment(models.Model):
    teacher = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        limit_choices_to={"role": "TEACHER"},
        related_name="assignments",
    )

    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="teaching_assignments",
    )

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="teaching_assignments",
    )

    class Meta:
        unique_together = ("teacher", "section", "subject")

    def clean(self):
        if self.teacher.institution != self.section.classroom.institution:
            raise ValidationError(
                "Teacher must belong to same institution as section."
            )

    def __str__(self):
        return f"{self.teacher.username} - {self.subject.name} - {self.section}"


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

# =========================================================
# OTP VERIFICATION
# =========================================================

class OTPVerification(models.Model):

    user = models.ForeignKey(User, on_delete=models.CASCADE)

    otp_code = models.CharField(max_length=6)

    date = models.DateField(auto_now_add=True)

    is_verified = models.BooleanField(default=False)

    attempt_count = models.IntegerField(default=0)

    last_attempt_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "date")

    def is_valid_today(self):
        return self.date == timezone.now().date()

    def is_expired(self):
        return timezone.now() > self.created_at + timezone.timedelta(minutes=10)

    def can_attempt(self):
        if self.attempt_count >= 5:
            return False
        return True

# =========================================================
# DEVICE SESSION (Single Device Enforcement)
# =========================================================

class DeviceSession(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    device_fingerprint = models.CharField(max_length=255)
    last_login = models.DateTimeField(auto_now=True)


# =========================================================
# AUDIT LOG
# =========================================================

class AuditLog(models.Model):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=255)
    target_model = models.CharField(max_length=255)
    target_id = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.actor} - {self.action}"


