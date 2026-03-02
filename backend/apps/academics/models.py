from django.db import models


class District(models.Model):
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        ordering = ["name"]

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

    def __str__(self):
        return f"{self.classroom.name} {self.name}"


# =========================================================
# SUBJECT (GLOBAL)
# =========================================================

class Subject(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

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

    def __str__(self):
        return f"{self.student.username} - {self.subject.name}"