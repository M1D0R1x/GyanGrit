from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.content.models import Course


# -------------------------------------------------------
# ASSESSMENT
# -------------------------------------------------------

class Assessment(models.Model):

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="assessments",
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    total_marks = models.PositiveIntegerField(default=0, editable=False)
    pass_marks = models.PositiveIntegerField(default=0)

    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        if self.pass_marks > self.total_marks:
            raise ValidationError("Pass marks cannot exceed total marks.")
        if self.total_marks <= 0:
            raise ValidationError("Total marks must be greater than zero.")

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

    def clean(self):
        if self.is_correct:
            existing_correct = QuestionOption.objects.filter(
                question=self.question,
                is_correct=True
            ).exclude(id=self.id)

            if existing_correct.exists():
                raise ValidationError("Only one correct option allowed per question.")

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

    selected_options = models.JSONField(default=dict, blank=True)

    score = models.PositiveIntegerField(default=0)
    passed = models.BooleanField(default=False)

    class Meta:
        ordering = ["-started_at"]

    def calculate_score_and_pass(self):
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

    def submit(self, selected_options):
        if self.submitted_at:
            raise ValidationError("Attempt already submitted.")

        self.selected_options = selected_options
        self.calculate_score_and_pass()
        self.submitted_at = timezone.now()
        self.save()

    def __str__(self):
        return f"Attempt {self.id} – {self.assessment.title} – {self.user.username}"