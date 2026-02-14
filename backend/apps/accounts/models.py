from django.db import models
from django.contrib.auth.models import AbstractUser


class Institution(models.Model):
    """
    Represents a school / institution.
    """

    name = models.CharField(max_length=255)
    district = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class User(AbstractUser):
    """
    Custom user model with role-based access.

    Role hierarchy:
    ADMIN > OFFICIAL > TEACHER > STUDENT
    """

    ROLE_CHOICES = (
        ("STUDENT", "Student"),
        ("TEACHER", "Teacher"),
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

    def __str__(self):
        return f"{self.username} ({self.role})"
