from django.db import models
from django.core.exceptions import ValidationError


class District(models.Model):
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["name"])]

    def __str__(self):
        return self.name


class Institution(models.Model):
    name = models.CharField(max_length=255)

    district = models.ForeignKey(
        District,
        on_delete=models.PROTECT,
        related_name="institutions",
    )

    is_government = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("name", "district")
        ordering = ["name"]
        indexes = [models.Index(fields=["name", "district"])]

    def __str__(self):
        return f"{self.name} ({self.district.name})"


# =========================================================
# CLASSROOM
# =========================================================

class ClassRoom(models.Model):
    name = models.CharField(max_length=50)  # "6", "7", "8", etc.

    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="classes",
    )

    class Meta:
        unique_together = ("name", "institution")
        ordering = ["name"]
        indexes = [models.Index(fields=["institution", "name"])]

    def __str__(self):
        return f"{self.name} - {self.institution.name}"


# =========================================================
# SECTION
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
        indexes = [models.Index(fields=["classroom", "name"])]

    def __str__(self):
        return f"{self.classroom.name} {self.name} - {self.classroom.institution.name}"


# =========================================================
# SUBJECT (GLOBAL)
# =========================================================

class Subject(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["name"])]

    def __str__(self):
        return self.name


# =========================================================
# CLASS SUBJECT
# =========================================================

class ClassSubject(models.Model):
    classroom = models.ForeignKey(
        ClassRoom,
        on_delete=models.CASCADE,
        related_name="subjects",
    )

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="classrooms",
    )

    class Meta:
        unique_together = ("classroom", "subject")
        indexes = [models.Index(fields=["classroom", "subject"])]

    def __str__(self):
        return f"{self.classroom.name} - {self.subject.name}"


# =========================================================
# STUDENT SUBJECT
# =========================================================

class StudentSubject(models.Model):
    student = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="subjects",
    )

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="students",
    )

    classroom = models.ForeignKey(
        ClassRoom,
        on_delete=models.CASCADE,
    )

    class Meta:
        unique_together = ("student", "subject")
        indexes = [models.Index(fields=["student", "subject"])]

    def __str__(self):
        return f"{self.student.username} - {self.subject.name}"


# =========================================================
# TEACHING ASSIGNMENT
# =========================================================

class TeachingAssignment(models.Model):
    teacher = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        limit_choices_to={"role": "TEACHER"},
        related_name="teaching_assignments",
    )

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="teaching_assignments",
    )

    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="teaching_assignments",
    )

    class Meta:
        unique_together = ("teacher", "subject", "section")
        indexes = [models.Index(fields=["teacher", "subject", "section"])]

    def clean(self):
        # Guard: teacher must have an institution before we compare
        teacher_institution = getattr(self.teacher, "institution", None)
        section_institution = (
            self.section.classroom.institution
            if self.section and self.section.classroom
            else None
        )

        if teacher_institution is None:
            raise ValidationError(
                "Teacher does not have an institution assigned."
            )

        if section_institution is None:
            raise ValidationError(
                "Section is not linked to a valid institution."
            )

        if teacher_institution != section_institution:
            raise ValidationError(
                "Teacher must belong to the same institution as the section."
            )

    def __str__(self):
        return f"{self.teacher.username} - {self.subject.name} - {self.section}"