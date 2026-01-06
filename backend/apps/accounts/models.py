from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """
    Custom user model.

    DESIGN DECISIONS:
    - Extend AbstractUser (not AbstractBaseUser)
      → avoids auth complexity
      → admin works out of the box
    - Role-based access via a single field
    """

    ROLE_CHOICES = (
        ("STUDENT", "Student"),
        ("TEACHER", "Teacher"),
        ("ADMIN", "Admin"),
    )

    role = models.CharField(
        max_length=16,
        choices=ROLE_CHOICES,
        default="STUDENT",
    )

    def __str__(self):
        return f"{self.username} ({self.role})"
