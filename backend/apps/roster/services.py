import openpyxl
import secrets
from datetime import datetime

from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.accounts.models import (
    StudentRegistrationRecord,
    AuditLog,
)
from apps.academics.models import Section


# =========================================================
# PROCESS ROSTER UPLOAD (Improved DOB parsing + better validation)
# =========================================================

def process_roster_upload(file, teacher):

    if teacher.role != "TEACHER":
        raise ValidationError("Only teachers can upload rosters.")

    try:
        workbook = openpyxl.load_workbook(file)
        sheet = workbook.active
    except Exception:
        raise ValidationError("Invalid Excel file. Please upload a valid .xlsx file.")

    created_records = []

    # Expected columns: Name | DOB (YYYY-MM-DD) | Section_ID
    for row in sheet.iter_rows(min_row=2, values_only=True):
        name, dob_raw, section_id = row[:3]

        if not all([name, dob_raw, section_id]):
            continue

        # Robust DOB parsing
        try:
            if isinstance(dob_raw, datetime):
                dob = dob_raw.date()
            else:
                dob = datetime.strptime(str(dob_raw).strip(), "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue  # skip invalid date

        try:
            section = Section.objects.select_related(
                "classroom", "classroom__institution"
            ).get(id=section_id)
        except Section.DoesNotExist:
            continue

        # Teacher must be assigned to this section
        if not teacher.teaching_assignments.filter(section=section).exists():
            continue

        record = StudentRegistrationRecord.objects.create(
            name=str(name).strip(),
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
# REGENERATE CODE (unchanged - already solid)
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
        if not actor.teaching_assignments.filter(section=record.section).exists():
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
# LIST REGISTRATION RECORDS (unchanged - already good)
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
            section__in=actor.teaching_assignments.values_list("section", flat=True)
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