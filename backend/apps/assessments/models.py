from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.content.models import Course


class Assessment(models.Model):
    """
    An assessment (quiz, exam, etc.) attached to a course.
    """

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="assessments",
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    total_marks = models.PositiveIntegerField(default=0, editable=False)  # Auto-computed or manual
    pass_marks = models.PositiveIntegerField(default=0)

    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.pass_marks > self.total_marks:
            raise ValidationError("Pass marks cannot exceed total marks.")
        if self.total_marks == 0:
            raise ValidationError("Total marks must be greater than zero.")

    def __str__(self):
        return f"{self.course.title} – {self.title}"

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Assessment"
        verbose_name_plural = "Assessments"


class Question(models.Model):
    """
    A question in an assessment (currently MCQ only).
    """

    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name="questions",
    )

    text = models.TextField()
    marks = models.PositiveIntegerField(default=1)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["order"]
        unique_together = ["assessment", "order"]  # No duplicate order per assessment

    def __str__(self):
        return f"Q{self.order} – {self.assessment.title}"

    def clean(self):
        if self.marks <= 0:
            raise ValidationError("Marks must be positive.")


class QuestionOption(models.Model):
    """
    Option for a question (MCQ style).
    """

    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="options",
    )

    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def clean(self):
        from django.conf import settings

        # Only enforce if STRICT_SINGLE_CORRECT_MCQS is True in settings.py
        if getattr(settings, 'STRICT_SINGLE_CORRECT_MCQS', False):
            if self.is_correct:
                existing_correct = QuestionOption.objects.filter(
                    question=self.question,
                    is_correct=True
                ).exclude(id=self.id)
                if existing_correct.exists():
                    raise ValidationError("Only one correct option is allowed per question.")

    def __str__(self):
        return f"Option for Q{self.question.id}"

    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def clean(self):
        # Optional: enforce exactly one correct answer per question (uncomment if strict MCQ)
        if self.is_correct:
            existing_correct = QuestionOption.objects.filter(
                question=self.question, is_correct=True
            ).exclude(id=self.id)
            if existing_correct.exists():
                raise ValidationError("Only one correct option allowed per question.")

    def __str__(self):
        return f"Option for Q{self.question.id}"


class AssessmentAttempt(models.Model):
    """
    A student's attempt at an assessment.
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

    started_at = models.DateTimeField(default=timezone.now)
    submitted_at = models.DateTimeField(null=True, blank=True)

    # Store only selected option IDs → more private & efficient
    selected_options = models.JSONField(default=dict, blank=True)  # e.g. {"123": 456} = question_id: option_id

    score = models.PositiveIntegerField(default=0)
    passed = models.BooleanField(default=False)

    class Meta:
        ordering = ["-started_at"]
        unique_together = ["user", "assessment", "submitted_at"]  # Prevent duplicate submissions

    def __str__(self):
        return f"Attempt {self.id} – {self.assessment.title} by {self.user.username}"

    def calculate_score_and_pass(self):
        """
        Recompute score and pass status from selected_options.
        Call this after submission or when needed.
        """
        score = 0
        for question_id, option_id in self.selected_options.items():
            try:
                option = QuestionOption.objects.get(
                    id=option_id,
                    question_id=question_id,
                    question__assessment=self.assessment,
                )
                if option.is_correct:
                    score += option.question.marks
            except QuestionOption.DoesNotExist:
                continue

        self.score = score
        self.passed = score >= self.assessment.pass_marks
        self.save(update_fields=["score", "passed"])