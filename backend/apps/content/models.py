from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.accounts.models import User  # for type hinting


class Course(models.Model):
    """
    A learning course (e.g., Math Grade 10) — universal across institutions.
    """

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["title"]
        verbose_name = "Course"
        verbose_name_plural = "Courses"


class Lesson(models.Model):
    """
    A single lesson inside a course.
    Ordered within the course.
    """

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="lessons",
    )

    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=1)
    content = models.TextField(blank=True)  # Markdown/HTML/text content

    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order"]
        unique_together = ["course", "order"]  # No duplicate order per course

    def __str__(self):
        return f"{self.course.title} – {self.title} (Order {self.order})"

    def clean(self):
        if self.order <= 0:
            raise ValidationError("Order must be positive.")


class LessonProgress(models.Model):
    """
    Tracks a user's progress on a specific lesson.
    One row per user per lesson.
    """

    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name="progress_records",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lesson_progress",
    )

    completed = models.BooleanField(default=False)
    last_position = models.IntegerField(default=0)  # e.g., video seconds or scroll %
    last_opened_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["lesson", "user"],
                name="unique_progress_per_user_lesson",
            )
        ]
        ordering = ["-last_opened_at"]

    def __str__(self):
        status = "Completed" if self.completed else "In Progress"
        return f"{self.lesson.title} – {self.user.username} ({status})"

    def mark_opened(self):
        self.last_opened_at = timezone.now()
        self.save(update_fields=["last_opened_at"])

    def mark_completed(self):
        self.completed = True
        self.last_opened_at = timezone.now()
        self.save(update_fields=["completed", "last_opened_at"])