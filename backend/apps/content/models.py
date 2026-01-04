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


from django.db import models
from django.conf import settings
from django.utils import timezone


class LessonProgress(models.Model):
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

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["lesson", "user"],
                name="unique_lesson_progress_per_user",
            )
        ]

    def mark_opened(self):
        """
        Updates last_opened_at for resume logic.
        Called whenever a lesson is opened.
        """
        self.last_opened_at = timezone.now()
        self.save(update_fields=["last_opened_at"])

    def __str__(self):
        return f"{self.lesson.title} – {'done' if self.completed else 'in progress'}"
