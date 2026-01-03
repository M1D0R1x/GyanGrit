from django.db import models

class Course(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Lesson(models.Model):
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
from django.utils import timezone

class LessonProgress(models.Model):
    lesson = models.ForeignKey("Lesson", on_delete=models.CASCADE)
    completed = models.BooleanField(default=False)
    last_position = models.IntegerField(default=0)
    last_opened_at = models.DateTimeField(null=True, blank=True)

    def mark_opened(self):
        self.last_opened_at = timezone.now()
        self.save(update_fields=["last_opened_at"])
