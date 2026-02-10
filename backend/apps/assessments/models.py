from django.db import models
from django.conf import settings
from apps.content.models import Course


class Assessment(models.Model):
    """
    A quiz or test attached to a course.
    """

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="assessments",
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    is_published = models.BooleanField(default=False)
    total_marks = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.course.title})"


class Question(models.Model):
    """
    MCQ question.
    """

    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name="questions",
    )

    text = models.TextField()
    marks = models.PositiveIntegerField(default=1)
    order = models.PositiveIntegerField()

    def __str__(self):
        return self.text[:60]


class Choice(models.Model):
    """
    Choices for a question.
    """

    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="choices",
    )

    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.text


class Attempt(models.Model):
    """
    A user's attempt at an assessment.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assessment_attempts",
    )

    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name="attempts",
    )

    score = models.PositiveIntegerField(default=0)
    completed = models.BooleanField(default=False)

    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "assessment"],
                name="one_attempt_per_user_per_assessment",
            )
        ]


class Response(models.Model):
    """
    A selected answer for a question in an attempt.
    """

    attempt = models.ForeignKey(
        Attempt,
        on_delete=models.CASCADE,
        related_name="responses",
    )

    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
    )

    selected_choice = models.ForeignKey(
        Choice,
        on_delete=models.CASCADE,
    )

    is_correct = models.BooleanField(default=False)
from django.db import models

# Create your models here.
