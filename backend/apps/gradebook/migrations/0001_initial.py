from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("academics", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="GradeEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("term", models.CharField(
                    choices=[
                        ("term_1", "Term 1"),
                        ("term_2", "Term 2"),
                        ("term_3", "Term 3"),
                        ("annual", "Annual"),
                        ("monthly", "Monthly"),
                        ("other", "Other"),
                    ],
                    db_index=True,
                    default="term_1",
                    max_length=16,
                )),
                ("category", models.CharField(
                    choices=[
                        ("oral", "Oral Exam"),
                        ("practical", "Practical"),
                        ("project", "Project"),
                        ("classwork", "Classwork"),
                        ("homework", "Homework"),
                        ("unit_test", "Unit Test"),
                        ("midterm", "Midterm"),
                        ("final", "Final Exam"),
                        ("other", "Other"),
                    ],
                    default="unit_test",
                    max_length=16,
                )),
                ("marks", models.DecimalField(decimal_places=2, max_digits=6)),
                ("total_marks", models.DecimalField(decimal_places=2, max_digits=6)),
                ("notes", models.TextField(blank=True)),
                ("entered_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("student", models.ForeignKey(
                    limit_choices_to={"role": "STUDENT"},
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="grade_entries",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("subject", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="grade_entries",
                    to="academics.subject",
                )),
                ("entered_by", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="grade_entries_entered",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "ordering": ["-entered_at"],
            },
        ),
        migrations.AddIndex(
            model_name="gradeentry",
            index=models.Index(fields=["student", "subject", "term"], name="gradebook_g_student_8a3c1f_idx"),
        ),
        migrations.AddIndex(
            model_name="gradeentry",
            index=models.Index(fields=["entered_by", "-entered_at"], name="gradebook_g_entered_b7d2e4_idx"),
        ),
    ]
