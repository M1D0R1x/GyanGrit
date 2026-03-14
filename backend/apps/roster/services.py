import logging
import secrets
from datetime import datetime

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.accounts.models import AuditLog, StudentRegistrationRecord
from apps.academics.models import Section

logger = logging.getLogger(__name__)


# =========================================================
# PROCESS ROSTER UPLOAD
#
# Processes an Excel file row by row.
# Each row is committed individually — a bad row does not
# roll back successfully processed rows.
# Returns both created records and a skipped-rows report.
# =========================================================

def process_roster_upload(file, teacher):
    """
    Parse and process a student roster Excel file.

    Expected columns (row 1 = header, skipped):
        Column A: Student Name (string)
        Column B: Date of Birth (YYYY-MM-DD or Excel date)
        Column C: Section ID (integer)

    Args:
        file:    Uploaded file object (.xlsx)
        teacher: User instance with role=TEACHER

    Returns:
        dict with keys:
            created:  list of successfully created record dicts
            skipped:  list of dicts with row number and reason for skip

    Raises:
        ValidationError: if caller is not a TEACHER or file is unreadable
    """
    import openpyxl  # local import — only needed here

    if teacher.role not in ["TEACHER", "ADMIN"]:
        raise ValidationError("Only teachers can upload rosters.")

    try:
        workbook = openpyxl.load_workbook(file)
        sheet = workbook.active
    except Exception:
        logger.exception("Failed to open uploaded roster file.")
        raise ValidationError(
            "Invalid Excel file. Please upload a valid .xlsx file."
        )

    created_records = []
    skipped_rows = []

    for row_num, row in enumerate(
        sheet.iter_rows(min_row=2, values_only=True), start=2
    ):
        # Safely unpack — pad with None if row has fewer than 3 columns
        row_data = list(row[:3]) + [None] * (3 - len(row[:3]))
        name, dob_raw, section_id = row_data

        # Skip fully empty rows silently
        if not any([name, dob_raw, section_id]):
            continue

        # Validate required fields
        if not all([name, dob_raw, section_id]):
            skipped_rows.append({
                "row": row_num,
                "reason": "Missing one or more required fields (Name, DOB, Section ID)",
            })
            continue

        # Parse DOB
        try:
            if isinstance(dob_raw, datetime):
                dob = dob_raw.date()
            else:
                dob = datetime.strptime(str(dob_raw).strip(), "%Y-%m-%d").date()
        except (ValueError, TypeError):
            skipped_rows.append({
                "row": row_num,
                "name": str(name),
                "reason": f"Invalid date format: '{dob_raw}'. Expected YYYY-MM-DD.",
            })
            continue

        # Resolve section
        try:
            section_id_int = int(section_id)
        except (ValueError, TypeError):
            skipped_rows.append({
                "row": row_num,
                "name": str(name),
                "reason": f"Invalid section ID: '{section_id}'. Must be an integer.",
            })
            continue

        try:
            section = Section.objects.select_related(
                "classroom",
                "classroom__institution",
            ).get(id=section_id_int)
        except Section.DoesNotExist:
            skipped_rows.append({
                "row": row_num,
                "name": str(name),
                "reason": f"Section ID {section_id_int} does not exist.",
            })
            continue

        # Teacher must be assigned to this section
        if teacher.role == "TEACHER":
            if not teacher.teaching_assignments.filter(section=section).exists():
                skipped_rows.append({
                    "row": row_num,
                    "name": str(name),
                    "reason": (
                        f"You are not assigned to section "
                        f"'{section}'. Cannot create records for it."
                    ),
                })
                continue

        # Avoid duplicate unregistered records for same student
        existing = StudentRegistrationRecord.objects.filter(
            name=str(name).strip(),
            dob=dob,
            section=section,
            is_registered=False,
        ).first()

        if existing:
            skipped_rows.append({
                "row": row_num,
                "name": str(name),
                "reason": (
                    "An unregistered record already exists for this "
                    "student in this section. Use regenerate-code if needed."
                ),
            })
            continue

        # Create the record — each row is its own atomic save
        try:
            record = StudentRegistrationRecord.objects.create(
                name=str(name).strip(),
                dob=dob,
                section=section,
            )
            created_records.append({
                "name": record.name,
                "registration_code": record.registration_code,
                "uuid": str(record.student_uuid),
                "section": str(section),
            })
        except Exception:
            logger.exception(
                "Failed to create StudentRegistrationRecord for row %d.",
                row_num,
            )
            skipped_rows.append({
                "row": row_num,
                "name": str(name),
                "reason": "Internal error creating record. Contact support.",
            })
            continue

    logger.info(
        "Roster upload by teacher id=%s: %d created, %d skipped.",
        teacher.id,
        len(created_records),
        len(skipped_rows),
    )

    return {
        "created": created_records,
        "skipped": skipped_rows,
    }


# =========================================================
# REGENERATE REGISTRATION CODE
# =========================================================

def regenerate_student_code(record_id, actor):
    """
    Generates a new registration code for an unregistered student record.

    Permission rules:
    - ADMIN: full access
    - PRINCIPAL: must be same institution as the section
    - TEACHER: must be assigned to the section

    Raises:
        ValidationError: on permission failure, not-found, or already registered
    """
    try:
        record = StudentRegistrationRecord.objects.select_related(
            "section",
            "section__classroom",
            "section__classroom__institution",
        ).get(id=record_id)
    except StudentRegistrationRecord.DoesNotExist:
        raise ValidationError("Record not found.")

    if actor.role == "TEACHER":
        if not actor.teaching_assignments.filter(section=record.section).exists():
            raise ValidationError(
                "You are not assigned to this section."
            )

    elif actor.role == "PRINCIPAL":
        if actor.institution != record.section.classroom.institution:
            raise ValidationError(
                "This record does not belong to your institution."
            )

    elif actor.role != "ADMIN":
        raise ValidationError("Unauthorized.")

    if record.is_registered:
        raise ValidationError(
            "Student is already registered. Cannot regenerate code."
        )

    record.registration_code = secrets.token_hex(8)
    record.save(update_fields=["registration_code"])

    AuditLog.objects.create(
        actor=actor,
        action="REGENERATE_STUDENT_CODE",
        target_model="StudentRegistrationRecord",
        target_id=str(record.id),
    )

    logger.info(
        "Registration code regenerated for record id=%s by actor id=%s.",
        record.id,
        actor.id,
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
    """
    Returns a scoped list of StudentRegistrationRecord entries.

    Scoping rules:
    - ADMIN: all records
    - PRINCIPAL: records in their institution
    - TEACHER: records in sections they are assigned to

    Args:
        actor:      User instance
        section_id: Optional section filter (int or str)

    Raises:
        ValidationError: if role is not permitted
    """
    queryset = StudentRegistrationRecord.objects.select_related(
        "section",
        "section__classroom",
        "section__classroom__institution",
    )

    if actor.role == "ADMIN":
        pass  # unrestricted

    elif actor.role == "TEACHER":
        queryset = queryset.filter(
            section__in=actor.teaching_assignments.values_list(
                "section", flat=True
            )
        )

    elif actor.role == "PRINCIPAL":
        if not actor.institution:
            raise ValidationError("No institution assigned to your account.")
        queryset = queryset.filter(
            section__classroom__institution=actor.institution
        )

    else:
        raise ValidationError("Unauthorized.")

    if section_id:
        try:
            queryset = queryset.filter(section_id=int(section_id))
        except (ValueError, TypeError):
            raise ValidationError(
                f"Invalid section_id: '{section_id}'. Must be an integer."
            )

    return list(
        queryset.values(
            "id",
            "name",
            "student_uuid",
            "registration_code",
            "is_registered",
            "section__name",
            "section__classroom__name",
            "section__classroom__institution__name",
        )
    )