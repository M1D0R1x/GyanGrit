import openpyxl
import secrets

from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.accounts.models import (
    StudentRegistrationRecord,
    Section,
    AuditLog,
)


# =========================================================
# PROCESS ROSTER UPLOAD
# =========================================================

def process_roster_upload(file, teacher):

    if teacher.role != "TEACHER":
        raise ValidationError("Only teachers can upload rosters.")

    workbook = openpyxl.load_workbook(file)
    sheet = workbook.active

    created_records = []

    # Expected columns:
    # Name | DOB | Section_ID

    for row in sheet.iter_rows(min_row=2, values_only=True):

        name, dob, section_id = row

        if not all([name, dob, section_id]):
            continue

        try:
            section = Section.objects.select_related(
                "classroom", "classroom__institution"
            ).get(id=section_id)
        except Section.DoesNotExist:
            continue

        # Ensure teacher is assigned to this section
        if not teacher.assignments.filter(section=section).exists():
            continue

        record = StudentRegistrationRecord.objects.create(
            name=name,
            dob=dob,
            section=section,
        )

        created_records.append({
            "name": record.name,
            "registration_code": record.registration_code,
            "uuid": str(record.student_uuid),
        })

    return created_records


# =========================================================
# REGENERATE CODE
# =========================================================

def regenerate_student_code(record_id, actor):

    try:
        record = StudentRegistrationRecord.objects.select_related(
            "section",
            "section__classroom",
            "section__classroom__institution",
        ).get(id=record_id)
    except StudentRegistrationRecord.DoesNotExist:
        raise ValidationError("Record not found.")

    # Permission logic
    if actor.role == "TEACHER":
        if not actor.assignments.filter(section=record.section).exists():
            raise ValidationError("You cannot modify this section.")

    elif actor.role == "PRINCIPAL":
        if actor.institution != record.section.classroom.institution:
            raise ValidationError("Not your institution.")

    else:
        raise ValidationError("Unauthorized.")

    if record.is_registered:
        raise ValidationError("Student already registered. Cannot regenerate.")

    # Generate new code
    record.registration_code = secrets.token_hex(8)
    record.save(update_fields=["registration_code"])

    AuditLog.objects.create(
        actor=actor,
        action="REGENERATE_STUDENT_CODE",
        target_model="StudentRegistrationRecord",
        target_id=str(record.id),
    )

    return {
        "student_uuid": str(record.student_uuid),
        "new_registration_code": record.registration_code,
        "name": record.name,
    }

# =========================================================
# LIST REGISTRATION RECORDS
# =========================================================

def list_registration_records(actor, section_id=None):

    queryset = StudentRegistrationRecord.objects.select_related(
        "section",
        "section__classroom",
        "section__classroom__institution",
    )

    # Role-based scoping
    if actor.role == "TEACHER":
        queryset = queryset.filter(
            section__in=actor.assignments.values_list("section", flat=True)
        )

    elif actor.role == "PRINCIPAL":
        queryset = queryset.filter(
            section__classroom__institution=actor.institution
        )

    else:
        raise ValidationError("Unauthorized")

    if section_id:
        queryset = queryset.filter(section_id=section_id)

    return list(
        queryset.values(
            "id",
            "name",
            "student_uuid",
            "registration_code",
            "is_registered",
            "section__name",
            "section__classroom__name",
        )
    )