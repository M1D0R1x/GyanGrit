import logging

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.academics.models import Subject, Section

logger = logging.getLogger(__name__)


class Course(models.Model):
    """
    Global curriculum unit.
    One Course per (subject, grade). Government-curated content lives here.
    60 total: 5 grades × 12 subjects.
    """
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
    """
    Global lesson belonging to a Course.
    Visible to ALL students enrolled in this course's grade+subject.
    Government-curated content.
    """
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="lessons",
    )
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=1)

    # Content types — any combination can be set on a single lesson
    content = models.TextField(blank=True)
    video_url = models.URLField(blank=True, null=True)
    video_thumbnail_url = models.URLField(blank=True, null=True)
    video_duration = models.CharField(max_length=20, blank=True)
    hls_manifest_url = models.URLField(blank=True, null=True)
    pdf_url = models.URLField(blank=True, null=True)
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


class SectionLesson(models.Model):
    """
    Section-specific supplemental lesson added by a teacher.

    Design rationale:
    - Global Lesson rows are government content, shared across all sections.
    - SectionLesson allows a teacher to add extra lessons visible ONLY to
      their specific section (class).
    - Satisfies SRS requirement that teachers can upload and create custom
      content without modifying the global curriculum.
    - Additive model — no existing Lesson rows are touched.

    Visibility rule:
    - A student sees: all global Lesson rows for their course
                    + all SectionLesson rows for their section + course
    """
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="section_lessons",
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="section_lessons",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_section_lessons",
    )

    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    content = models.TextField(blank=True)
    video_url = models.URLField(blank=True, null=True)
    video_thumbnail_url = models.URLField(blank=True, null=True)
    video_duration = models.CharField(max_length=20, blank=True)
    hls_manifest_url = models.URLField(blank=True, null=True)
    pdf_url = models.URLField(blank=True, null=True)

    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"[Section {self.section}] {self.course} — {self.title}"


class LessonProgress(models.Model):
    """
    Tracks a single student's progress on a single global Lesson.
    NOTE: field is `user` (not `student`) — matches the existing DB schema.
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
    Sits on top of the shared curriculum — teachers add context,
    local examples, or corrections without editing global content.
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