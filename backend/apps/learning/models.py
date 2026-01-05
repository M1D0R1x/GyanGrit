from django.db import models
from django.conf import settings
from django.utils import timezone

from apps.content.models import Course


class Enrollment(models.Model):
    """
    Represents a learner being enrolled in a course.

    NOTE:
    - `user` is nullable for now (no auth yet)
    - When auth is added, this becomes mandatory without breaking data
    """

    STATUS_CHOICES = (
        ("ENROLLED", "Enrolled"),
        ("COMPLETED", "Completed"),
        ("DROPPED", "Dropped"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="enrollments",
    )

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="enrollments",
    )

    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default="ENROLLED",
    )

    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "course"],
                name="unique_enrollment_per_user_course",
            )
        ]

    def __str__(self):
        return f"{self.course.title} – {self.status}"


class LearningPath(models.Model):
    """
    Represents a structured learning path (curriculum).
    Example: 'Class 10 Science', 'Govt Exam Prep'
    """

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class LearningPathCourse(models.Model):
    """
    Orders courses inside a learning path.
    """

    learning_path = models.ForeignKey(
        LearningPath,
        on_delete=models.CASCADE,
        related_name="courses",
    )

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="learning_paths",
    )

    order = models.PositiveIntegerField()

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["learning_path", "course"],
                name="unique_course_per_learning_path",
            )
        ]

    def __str__(self):
        return f"{self.learning_path.name} → {self.course.title}"
