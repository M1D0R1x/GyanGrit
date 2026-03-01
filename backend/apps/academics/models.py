from django.db import models
from django.core.exceptions import ValidationError


# =========================================================
# INSTITUTION
# =========================================================

class Institution(models.Model):
    class Meta:
        db_table = "accounts_institution"
    name = models.CharField(max_length=255)
    district = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# =========================================================
# CLASS (e.g., Grade 10)
# =========================================================

class ClassRoom(models.Model):
    name = models.CharField(max_length=100)

    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="classes",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("name", "institution")
        verbose_name = "Class"
        verbose_name_plural = "Classes"

    def __str__(self):
        return f"{self.name} - {self.institution.name}"


# =========================================================
# SECTION (e.g., 10A, 10B)
# =========================================================

class Section(models.Model):
    name = models.CharField(max_length=20)

    classroom = models.ForeignKey(
        ClassRoom,
        on_delete=models.CASCADE,
        related_name="sections",
    )

    class Meta:
        unique_together = ("name", "classroom")

    def __str__(self):
        return f"{self.classroom.name} {self.name}"


# =========================================================
# SUBJECT (Core Academic Subject)
# =========================================================

class Subject(models.Model):
    name = models.CharField(max_length=100)

    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="subjects",
    )

    def __str__(self):
        return f"{self.name} ({self.institution.name})"


# =========================================================
# TEACHING ASSIGNMENT
# =========================================================

class TeachingAssignment(models.Model):
    teacher = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        limit_choices_to={"role": "TEACHER"},
        related_name="assignments",
    )

    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="teaching_assignments",
    )

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="teaching_assignments",
    )

    class Meta:
        unique_together = ("teacher", "section", "subject")

    def clean(self):
        if self.teacher.institution != self.section.classroom.institution:
            raise ValidationError("Teacher must belong to same institution as section.")

    def __str__(self):
        return f"{self.teacher.username} - {self.subject.name} - {self.section}"