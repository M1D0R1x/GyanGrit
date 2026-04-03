import logging

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.content.models import Course

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# ASSESSMENT
# -------------------------------------------------------

class Assessment(models.Model):

    class Status(models.TextChoices):
        DRAFT     = "draft",     "Draft"
        PUBLISHED = "published", "Published"

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="assessments",
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # total_marks is computed from sum of Question.marks via recalculate_total_marks().
    # It is editable=False to prevent manual override — always derived from questions.
    total_marks = models.PositiveIntegerField(default=0, editable=False)
    pass_marks = models.PositiveIntegerField(default=0)

    is_published = models.BooleanField(default=False)

    # Draft/Published workflow (replaces is_published for new code — kept for backwards compat)
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.PUBLISHED,  # existing assessments default to published
        db_index=True,
    )

    # AI generation metadata
    ai_generated  = models.BooleanField(default=False)
    source_lesson = models.ForeignKey(
        "content.Lesson",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="generated_assessments",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["course", "is_published"]),
            models.Index(fields=["course", "status"]),
        ]

    def save(self, *args, **kwargs):
        # Keep is_published in sync with status for any code still using it
        self.is_published = (self.status == self.Status.PUBLISHED)
        super().save(*args, **kwargs)

    def recalculate_total_marks(self):
        """
        Recomputes total_marks from the sum of all question marks.
        Called by Question post_save and post_delete signals.
        Uses update() to avoid triggering full model validation.
        """
        from django.db.models import Sum
        total = self.questions.aggregate(total=Sum("marks"))["total"] or 0
        Assessment.objects.filter(pk=self.pk).update(total_marks=total)
        self.total_marks = total  # keep in-memory object consistent

    def clean(self):
        # Defer total_marks check to after questions are saved.
        # Only validate pass_marks vs total_marks when total_marks > 0.
        if self.total_marks > 0 and self.pass_marks > self.total_marks:
            raise ValidationError("Pass marks cannot exceed total marks.")

    def __str__(self):
        return f"{self.course.title} – {self.title}"


# -------------------------------------------------------
# QUESTION
# -------------------------------------------------------

class Question(models.Model):

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
        unique_together = ["assessment", "order"]
        indexes = [models.Index(fields=["assessment", "order"])]

    def clean(self):
        if self.marks <= 0:
            raise ValidationError("Marks must be positive.")

    def __str__(self):
        return f"Q{self.order} – {self.assessment.title}"


# -------------------------------------------------------
# QUESTION OPTION
# -------------------------------------------------------

class QuestionOption(models.Model):

    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="options",
    )

    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["question"])]

    def clean(self):
        if self.is_correct:
            existing_correct = QuestionOption.objects.filter(
                question=self.question,
                is_correct=True,
            ).exclude(id=self.id)

            if existing_correct.exists():
                raise ValidationError(
                    "Only one correct option is allowed per question."
                )

    def __str__(self):
        return f"Option for Q{self.question.id}"


# -------------------------------------------------------
# ATTEMPT
# -------------------------------------------------------

class AssessmentAttempt(models.Model):

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

    # Keys are question IDs (str), values are selected option IDs (int).
    # Example: {"1": 3, "2": 7}
    selected_options = models.JSONField(default=dict, blank=True)

    score = models.PositiveIntegerField(default=0)
    passed = models.BooleanField(default=False)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["user", "assessment"]),
            models.Index(fields=["assessment", "submitted_at"]),
        ]

    def calculate_score_and_pass(self):
        """
        Scores the attempt by looking up selected options.

        Performance: fetches all relevant QuestionOptions in a single query
        instead of one query per answer (avoids N+1).
        """
        if not self.selected_options:
            self.score = 0
            self.passed = False
            return

        # Collect all option IDs the student selected
        selected_option_ids = list(self.selected_options.values())

        # Single query: fetch all selected options that belong to this assessment
        correct_options = QuestionOption.objects.filter(
            id__in=selected_option_ids,
            is_correct=True,
            question__assessment=self.assessment,
        ).select_related("question")

        score = sum(opt.question.marks for opt in correct_options)

        self.score = score
        self.passed = score >= self.assessment.pass_marks

    def submit(self, selected_options: dict):
        """
        Finalises the attempt: scores it and records submission time.
        Uses update_fields to avoid a full model save.
        """
        if self.submitted_at:
            raise ValidationError("Attempt already submitted.")

        self.selected_options = selected_options
        self.calculate_score_and_pass()
        self.submitted_at = timezone.now()
        self.save(update_fields=[
            "selected_options",
            "score",
            "passed",
            "submitted_at",
        ])

    def __str__(self):
        return (
            f"Attempt {self.id} – "
            f"{self.assessment.title} – "
            f"{self.user.username}"
        )