from django.db import models
from django.conf import settings
from django.utils import timezone

from apps.content.models import Course


class Enrollment(models.Model):
    """
    Represents a learner being enrolled in a course.

    NOTES:
    - `user` is nullable for now (no auth yet)
    - Progress is DERIVED from content app
    """

    STATUS_CHOICES = (
        ("enrolled", "Enrolled"),
        ("completed", "Completed"),
        ("dropped", "Dropped"),
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
        default="enrolled",
    )

    enrolled_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "course"],
                name="unique_enrollment_per_user_course",
            )
        ]

    def mark_completed(self):
        """Marks enrollment as completed."""
        self.status = "completed"
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "completed_at"])

    def mark_dropped(self):
        """Marks enrollment as dropped."""
        self.status = "dropped"
        self.save(update_fields=["status"])

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
