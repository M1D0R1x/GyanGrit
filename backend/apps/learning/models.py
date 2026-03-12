from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.content.models import Course


# -------------------------------------------------------
# ENROLLMENT
# -------------------------------------------------------

class Enrollment(models.Model):

    STATUS_CHOICES = (
        ("enrolled", "Enrolled"),
        ("completed", "Completed"),
        ("dropped", "Dropped"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
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
        ordering = ["-enrolled_at"]
        indexes = [models.Index(fields=['user', 'course'])]

    def clean(self):
        if self.status == "completed" and not self.completed_at:
            self.completed_at = timezone.now()

    def mark_completed(self):
        self.status = "completed"
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "completed_at"])

    def mark_dropped(self):
        self.status = "dropped"
        self.save(update_fields=["status"])

    def __str__(self):
        return f"{self.user.username} – {self.course.title} ({self.status})"


# -------------------------------------------------------
# LEARNING PATH
# -------------------------------------------------------

class LearningPath(models.Model):

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=['name'])]

    def __str__(self):
        return self.name


# -------------------------------------------------------
# LEARNING PATH COURSE
# -------------------------------------------------------

class LearningPathCourse(models.Model):

    learning_path = models.ForeignKey(
        LearningPath,
        on_delete=models.CASCADE,
        related_name="path_courses",
    )

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="learning_paths",
    )

    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["learning_path", "course"],
                name="unique_course_in_path",
            ),
            models.UniqueConstraint(
                fields=["learning_path", "order"],
                name="unique_order_in_path",
            ),
        ]
        indexes = [models.Index(fields=['learning_path', 'order'])]

    def clean(self):
        if self.order <= 0:
            raise ValidationError("Order must be positive.")

    def __str__(self):
        return f"{self.learning_path.name} → {self.course.title} (Order {self.order})"