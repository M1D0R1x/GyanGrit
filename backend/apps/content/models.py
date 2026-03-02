from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.academics.models import Subject


class Course(models.Model):
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="courses",
    )

    grade = models.IntegerField()  # 6,7,8,9,10

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    is_core = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["grade", "title"]

    def __str__(self):
        return f"{self.title} (Class {self.grade} - {self.subject.name})"


class Lesson(models.Model):
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="lessons",
    )

    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=1)
    content = models.TextField(blank=True)

    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order"]
        unique_together = ["course", "order"]

    def __str__(self):
        return f"{self.course.title} – {self.title} (Order {self.order})"

    def clean(self):
        if self.order <= 0:
            raise ValidationError("Order must be positive.")


class LessonProgress(models.Model):
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
    last_position = models.IntegerField(default=0)
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