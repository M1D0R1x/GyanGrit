# apps.gradebook.models
"""
Gradebook — manual mark entry for non-MCQ assessments.

Design decisions:
- GradeEntry is the atomic unit: one mark for one student on one
  subject+term+category combination.
- Separate from apps.assessments (which is auto-scored MCQ only).
  This handles: oral exams, practicals, projects, classwork, open-ended work.
- No unique_together on (student, subject, term, category) intentionally —
  a teacher may enter multiple project marks per term.
- entered_by is SET_NULL so grade history survives staff turnover.
- marks / total_marks stored as DecimalField for fractional marks
  (e.g. 18.5 / 25).
- percentage is always derived, never stored — avoids stale computed values.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


class GradeTerm(models.TextChoices):
    TERM_1  = "term_1",  "Term 1"
    TERM_2  = "term_2",  "Term 2"
    TERM_3  = "term_3",  "Term 3"
    ANNUAL  = "annual",  "Annual"
    MONTHLY = "monthly", "Monthly"
    OTHER   = "other",   "Other"


class GradeCategory(models.TextChoices):
    ORAL       = "oral",       "Oral Exam"
    PRACTICAL  = "practical",  "Practical"
    PROJECT    = "project",    "Project"
    CLASSWORK  = "classwork",  "Classwork"
    HOMEWORK   = "homework",   "Homework"
    UNIT_TEST  = "unit_test",  "Unit Test"
    MIDTERM    = "midterm",    "Midterm"
    FINAL      = "final",      "Final Exam"
    OTHER      = "other",      "Other"


class GradeEntry(models.Model):
    """
    One mark entry for one student, subject, term, and category.
    """
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="grade_entries",
        limit_choices_to={"role": "STUDENT"},
    )
    subject = models.ForeignKey(
        "academics.Subject",
        on_delete=models.CASCADE,
        related_name="grade_entries",
    )
    term = models.CharField(
        max_length=16,
        choices=GradeTerm.choices,
        default=GradeTerm.TERM_1,
        db_index=True,
    )
    category = models.CharField(
        max_length=16,
        choices=GradeCategory.choices,
        default=GradeCategory.UNIT_TEST,
    )
    marks = models.DecimalField(max_digits=6, decimal_places=2)
    total_marks = models.DecimalField(max_digits=6, decimal_places=2)
    notes = models.TextField(blank=True)
    entered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="grade_entries_entered",
    )
    entered_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-entered_at"]
        indexes = [
            models.Index(fields=["student", "subject", "term"]),
            models.Index(fields=["entered_by", "-entered_at"]),
        ]

    def __str__(self):
        return (
            f"{self.student.username} | {self.subject.name} | "
            f"{self.term} | {self.category} | {self.marks}/{self.total_marks}"
        )

    @property
    def percentage(self):
        if not self.total_marks:
            return 0
        return round(float(self.marks) / float(self.total_marks) * 100, 1)

    @property
    def passed(self):
        return self.percentage >= 40
