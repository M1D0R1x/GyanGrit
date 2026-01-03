from django.db import models
from django.conf import settings
from django.utils import timezone


class Course(models.Model):
    """
    Represents a learning course.
    """
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Lesson(models.Model):
    """
    Represents a lesson inside a course.
    Lessons are ordered within a course.
    """
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="lessons",
    )
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField()
    content = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.course.title} – {self.title}"


class LessonProgress(models.Model):
    """
    Tracks progress for a lesson.

    Currently user is nullable because:
    - auth is not implemented yet
    - later this will become user-scoped progress
    """
    time_spent_seconds = models.PositiveIntegerField(default=0)
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name="progress",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )

    completed = models.BooleanField(default=False)
    last_position = models.IntegerField(default=0)
    last_opened_at = models.DateTimeField(null=True, blank=True)

    def mark_opened(self):
        """
        Update the last time the lesson was accessed.
        Used for resume logic.
        """
        self.last_opened_at = timezone.now()
        self.save(update_fields=["last_opened_at"])

    def __str__(self):
        status = "done" if self.completed else "in progress"
        return f"{self.lesson.title} – {status}"
