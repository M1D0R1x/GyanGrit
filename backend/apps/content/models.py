import logging

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.academics.models import Subject

logger = logging.getLogger(__name__)


class Course(models.Model):
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="courses",
    )
    grade = models.IntegerField()
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_core = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["grade", "title"]
        indexes = [models.Index(fields=["subject", "grade"])]

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

    # Content types — any combination can be set on a single lesson
    content = models.TextField(blank=True)          # markdown/text
    video_url = models.URLField(blank=True, null=True)        # YouTube/Vimeo URL
    video_thumbnail_url = models.URLField(blank=True, null=True)
    video_duration = models.CharField(max_length=20, blank=True)  # e.g. "12:34"
    hls_manifest_url = models.URLField(blank=True, null=True)
    pdf_url = models.URLField(blank=True, null=True)          # R2 URL
    thumbnail_url = models.URLField(blank=True, null=True)

    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order"]
        unique_together = ["course", "order"]
        indexes = [models.Index(fields=["course", "order"])]

    def clean(self):
        if self.order <= 0:
            raise ValidationError("Order must be positive.")

    def __str__(self):
        return f"{self.course.title} — {self.title} (Order {self.order})"


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
        indexes = [models.Index(fields=["lesson", "user"])]

    def mark_opened(self):
        self.last_opened_at = timezone.now()
        self.save(update_fields=["last_opened_at"])

    def mark_completed(self):
        self.completed = True
        self.last_opened_at = timezone.now()
        self.save(update_fields=["completed", "last_opened_at"])

    def __str__(self):
        status = "Completed" if self.completed else "In Progress"
        return f"{self.lesson.title} — {self.user.username} ({status})"


class LessonNote(models.Model):
    """
    Teacher-authored supplemental notes attached to a lesson.
    These sit on top of the shared curriculum — teachers can add
    context, local examples, or corrections without editing the
    global lesson content.
    """
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name="notes",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lesson_notes",
    )
    content = models.TextField()
    is_visible_to_students = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Note by {self.author.username} on {self.lesson.title}"