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


class ClassRoom(models.Model):
    """
    Represents a class inside an institution.
    Example: 8A, 10-B, Grade 9 Science
    """

    name = models.CharField(max_length=100)

    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="classes",
    )

    teachers = models.ManyToManyField(
        "User",
        blank=True,
        related_name="teaching_classes",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("name", "institution")

    def clean(self):
        """
        Ensure teachers belong to same institution.
        """
        for teacher in self.teachers.all():
            if teacher.institution != self.institution:
                raise ValueError(
                    f"Teacher {teacher.username} does not belong to this institution."
                )

    def __str__(self):
        return f"{self.name} - {self.institution.name}"


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

    classroom = models.ForeignKey(
        ClassRoom,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="students",
    )

    def clean(self):
        """
        Ensure classroom and institution consistency.
        """

        if self.classroom:
            if not self.institution:
                raise ValueError(
                    "User must belong to an institution if assigned to a classroom."
                )

            if self.classroom.institution != self.institution:
                raise ValueError(
                    "Classroom institution must match user's institution."
                )

    def __str__(self):
        return f"{self.username} ({self.role})"
