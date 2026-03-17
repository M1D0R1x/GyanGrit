import json
import logging
import random
import secrets

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.db import transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from apps.accesscontrol.scoped_service import scope_queryset

from apps.academics.models import (
    Institution,
    Section,
    Subject,
    ClassRoom,
    TeachingAssignment,
    District,
)
from .models import (
    StudentRegistrationRecord,
    OTPVerification,
    DeviceSession,
    JoinCode,
)

User = get_user_model()
logger = logging.getLogger(__name__)


# =========================================================
# INTERNAL SERVICE: Teacher assignment creation
# =========================================================

def assign_teacher_to_classes(teacher, subject, institution):
    """
    Creates TeachingAssignment records for a teacher across all
    sections of grades 6-10 in the given institution.
    Called from register(), admin.py save_model(), and join code flows.
    """
    classrooms = ClassRoom.objects.filter(
        institution=institution,
        name__in=["6", "7", "8", "9", "10"],
    )
    created_count = 0
    for classroom in classrooms:
        for section in Section.objects.filter(classroom=classroom):
            _, created = TeachingAssignment.objects.get_or_create(
                teacher=teacher,
                subject=subject,
                section=section,
            )
            if created:
                created_count += 1

    logger.info(
        "Teacher id=%s assigned to %d sections for subject '%s' in '%s'.",
        teacher.id,
        created_count,
        subject.name,
        institution.name,
    )

# Backward-compatible alias used by admin.py
_assign_teacher_to_classes = assign_teacher_to_classes


def _create_device_session(request, user):
    """
    Safely creates a DeviceSession after ensuring the session is persisted.
    session_key is None until session.save() is called — this guards against
    storing None as the fingerprint which breaks single-session enforcement.
    """
    if not request.session.session_key:
        request.session.save()

    DeviceSession.objects.filter(user=user).delete()
    DeviceSession.objects.create(
        user=user,
        device_fingerprint=request.session.session_key,
    )


# =========================================================
# REGISTER
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def register(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    username = body.get("username", "").strip()
    password = body.get("password", "")
    join_code_value = body.get("join_code", "").strip()

    if not username or not password or not join_code_value:
        return JsonResponse(
            {"error": "username, password and join_code are required"},
            status=400,
        )

    try:
        join_code = JoinCode.objects.select_related(
            "institution", "section", "district", "subject",
        ).get(code=join_code_value)
    except JoinCode.DoesNotExist:
        return JsonResponse({"error": "Invalid join code"}, status=400)

    if not join_code.is_valid():
        return JsonResponse({"error": "Expired or already used join code"}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username already exists"}, status=400)

    role = join_code.role
    institution = join_code.institution
    section = join_code.section

    # Resolve district string
    district = None
    if institution:
        district = institution.district.name
    elif section and section.classroom and section.classroom.institution:
        district = section.classroom.institution.district.name
    elif join_code.district:
        # OFFICIAL role — district set directly on join code, no institution
        district = join_code.district.name

    with transaction.atomic():
        user = User.objects.create_user(
            username=username,
            password=password,
            role=role,
            institution=institution,
            section=section,
            district=district,
        )

        if role == "TEACHER" and join_code.subject and institution:
            assign_teacher_to_classes(user, join_code.subject, institution)

        join_code.mark_as_used()

    logger.info(
        "New user registered: id=%s username=%s role=%s",
        user.id, user.username, user.role,
    )

    return JsonResponse({
        "id": user.id,
        "public_id": user.public_id,
        "username": user.username,
        "role": user.role,
        "institution": user.institution.name if user.institution else None,
        "section": user.section.name if user.section else None,
    })


# =========================================================
# STUDENT SELF REGISTRATION
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def student_register(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    code     = body.get("registration_code", "").strip()
    username = body.get("username", "").strip()
    password = body.get("password", "")
    dob      = body.get("dob", "").strip()

    if not all([code, username, password, dob]):
        return JsonResponse({"error": "Missing required fields"}, status=400)

    try:
        record = StudentRegistrationRecord.objects.select_related(
            "section__classroom__institution",
        ).get(registration_code=code)
    except StudentRegistrationRecord.DoesNotExist:
        return JsonResponse({"error": "Invalid registration code"}, status=400)

    if record.is_registered:
        return JsonResponse({"error": "Registration code already used"}, status=400)

    if str(record.dob) != str(dob):
        return JsonResponse({"error": "Date of birth does not match"}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username already exists"}, status=400)

    with transaction.atomic():
        user = User.objects.create_user(
            username=username,
            password=password,
            role="STUDENT",
            institution=record.section.classroom.institution,
            section=record.section,
        )
        record.is_registered = True
        record.linked_user = user
        record.save(update_fields=["is_registered", "linked_user"])

    return JsonResponse({
        "id": user.id,
        "public_id": user.public_id,
        "username": user.username,
        "section": user.section.name,
        "institution": user.institution.name,
    })


# =========================================================
# LOGIN
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def login_view(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    user = authenticate(
        username=body.get("username", ""),
        password=body.get("password", ""),
    )

    if not user:
        return JsonResponse({"error": "Invalid credentials"}, status=401)

    if user.role in ["STUDENT", "ADMIN"]:
        login(request, user)
        _create_device_session(request, user)
        return JsonResponse({
            "otp_required": False,
            "id": user.id,
            "username": user.username,
            "role": user.role,
        })

    otp_code = str(random.randint(100000, 999999))
    OTPVerification.objects.filter(user=user).delete()
    OTPVerification.objects.create(user=user, otp_code=otp_code)

    logger.debug("DEV OTP for %s: %s", user.username, otp_code)

    response_data = {
        "otp_required": True,
        "id": user.id,
        "username": user.username,
        "role": user.role,
    }

    if settings.DEBUG:
        response_data["otp_code"] = otp_code

    return JsonResponse(response_data)


# =========================================================
# VERIFY OTP
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def verify_otp(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    username  = body.get("username", "").strip()
    otp_input = body.get("otp", "").strip()

    if not username or not otp_input:
        return JsonResponse({"error": "Missing username or OTP"}, status=400)

    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return JsonResponse({"error": "Invalid credentials"}, status=400)

    otp_record = (
        OTPVerification.objects
        .filter(user=user)
        .order_by("-created_at")
        .first()
    )

    if not otp_record or otp_record.is_expired():
        return JsonResponse({"error": "OTP expired or not found"}, status=400)

    if otp_record.attempt_count >= 5:
        return JsonResponse({"error": "Too many attempts. Request a new OTP."}, status=429)

    if otp_record.otp_code != otp_input:
        otp_record.attempt_count += 1
        otp_record.last_attempt_at = timezone.now()
        otp_record.save(update_fields=["attempt_count", "last_attempt_at"])
        return JsonResponse({"error": "Invalid OTP"}, status=400)

    login(request, user)
    _create_device_session(request, user)

    otp_record.is_verified = True
    otp_record.save(update_fields=["is_verified"])

    return JsonResponse({"success": True, "role": user.role})


# =========================================================
# LOGOUT
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def logout_view(request):
    if request.user.is_authenticated:
        DeviceSession.objects.filter(user=request.user).delete()
        logger.info("User id=%s logged out.", request.user.id)
    logout(request)
    return JsonResponse({"success": True})


# =========================================================
# ME
# =========================================================

@require_http_methods(["GET"])
def me(request):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False})

    user = (
        User.objects
        .select_related("institution", "section")
        .get(id=request.user.id)
    )

    return JsonResponse({
        "authenticated":    True,
        "id":               user.id,
        "public_id":        user.public_id,
        "username":         user.username,
        "role":             user.role,
        "first_name":       user.first_name,
        "middle_name":      user.middle_name,
        "last_name":        user.last_name,
        "display_name":     user.display_name,
        "email":            user.email,
        "mobile_primary":   user.mobile_primary,
        "mobile_secondary": user.mobile_secondary,
        "profile_complete": user.profile_complete,
        "institution":      user.institution.name if user.institution else None,
        "institution_id":   user.institution.id  if user.institution else None,
        "section":          user.section.name    if user.section     else None,
        "section_id":       user.section.id      if user.section     else None,
        "district":         user.district        if user.district    else None,
    })


# =========================================================
# CSRF TOKEN
# =========================================================

@require_http_methods(["GET"])
def csrf_token_view(request):
    return JsonResponse({"csrfToken": get_token(request)})


# =========================================================
# VALIDATE JOIN CODE
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def validate_join_code(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    join_code_value = body.get("join_code", "").strip()

    if not join_code_value:
        return JsonResponse({"error": "join_code is required"}, status=400)

    try:
        join_code = JoinCode.objects.select_related(
            "institution", "section", "district", "subject"
        ).get(code=join_code_value)
    except JoinCode.DoesNotExist:
        return JsonResponse({"error": "Invalid join code"}, status=400)

    if not join_code.is_valid():
        return JsonResponse({"error": "Expired or already used join code"}, status=400)

    return JsonResponse({
        "valid": True,
        "role": join_code.role,
        "institution": join_code.institution.name if join_code.institution else None,
        "section": join_code.section.name if join_code.section else None,
        "district": join_code.district.name if join_code.district else None,
        "subject": join_code.subject.name if join_code.subject else None,
    })


# =========================================================
# SCOPED LIST ENDPOINTS
# =========================================================

@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL"])
@require_http_methods(["GET"])
def users(request):
    queryset = scope_queryset(request.user, User.objects.all())
    data = list(queryset.values("id", "username", "role", "public_id", "district"))
    return JsonResponse(data, safe=False)


@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL"])
@require_http_methods(["GET"])
def institutions_list(request):
    """
    Scoped institution list. Sorted alphabetically.
    OFFICIAL → their district only.
    PRINCIPAL → their own institution only.
    ADMIN → all.
    """
    queryset = scope_queryset(
        request.user,
        Institution.objects.select_related("district").order_by("name"),
    )
    return JsonResponse(
        list(queryset.values("id", "name", "district__name")),
        safe=False,
    )


@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL", "TEACHER"])
@require_http_methods(["GET"])
def sections_list(request):
    queryset = scope_queryset(request.user, Section.objects.all())
    return JsonResponse(
        list(queryset.values("id", "name", "classroom_id")),
        safe=False,
    )


@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL", "TEACHER"])
@require_http_methods(["GET"])
def subjects_list(request):
    queryset = scope_queryset(request.user, Subject.objects.all())
    return JsonResponse(list(queryset.values("id", "name")), safe=False)


@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL"])
@require_http_methods(["GET"])
def teachers(request):
    queryset = scope_queryset(
        request.user,
        User.objects.filter(role="TEACHER"),
    )
    return JsonResponse(
        list(queryset.values("id", "username", "public_id")),
        safe=False,
    )


@require_roles(["ADMIN", "PRINCIPAL", "TEACHER", "OFFICIAL"])
@require_http_methods(["GET"])
def join_codes_list(request):
    """
    List join codes visible to the current user.
    - ADMIN: all codes
    - OFFICIAL: codes for their district
    - PRINCIPAL: codes for their institution
    - TEACHER: STUDENT codes for their institution only
    """
    queryset = JoinCode.objects.select_related(
        "institution", "section", "district", "subject", "created_by"
    ).order_by("-created_at")

    if request.user.role == "OFFICIAL":
        if not request.user.district:
            return JsonResponse({"error": "No district assigned"}, status=400)
        queryset = queryset.filter(
            institution__district__name=request.user.district
        ) | queryset.filter(
            district__name=request.user.district
        )

    elif request.user.role == "PRINCIPAL":
        if not request.user.institution:
            return JsonResponse({"error": "No institution assigned"}, status=400)
        queryset = queryset.filter(institution=request.user.institution)

    elif request.user.role == "TEACHER":
        if not request.user.institution:
            return JsonResponse({"error": "No institution assigned"}, status=400)
        queryset = queryset.filter(
            institution=request.user.institution,
            role="STUDENT",
        )

    data = [
        {
            "id": jc.id,
            "code": jc.code,
            "role": jc.role,
            "institution": jc.institution.name if jc.institution else None,
            "section": jc.section.name if jc.section else None,
            "district": jc.district.name if jc.district else None,
            "subject": jc.subject.name if jc.subject else None,
            "is_used": jc.is_used,
            "is_valid": jc.is_valid(),
            "expires_at": jc.expires_at.isoformat(),
            "created_at": jc.created_at.isoformat(),
            "created_by": jc.created_by.username if jc.created_by else None,
        }
        for jc in queryset
    ]

    return JsonResponse(data, safe=False)


@require_roles(["ADMIN", "PRINCIPAL", "TEACHER", "OFFICIAL"])
@require_http_methods(["POST"])
@csrf_exempt
def create_join_code(request):
    """
    Create a new join code.

    Role creation matrix:
    - ADMIN     → any role
    - OFFICIAL  → PRINCIPAL only (for their district)
    - PRINCIPAL → STUDENT, TEACHER (for their institution)
    - TEACHER   → STUDENT only (for their institution)
    """
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    role = body.get("role", "").upper()
    valid_roles = ["STUDENT", "TEACHER", "PRINCIPAL", "OFFICIAL"]

    if role not in valid_roles:
        return JsonResponse(
            {"error": f"role must be one of: {', '.join(valid_roles)}"},
            status=400,
        )

    # ── Permission matrix ───────────────────────────────────────────────────
    if request.user.role == "TEACHER" and role != "STUDENT":
        return JsonResponse(
            {"error": "Teachers can only create STUDENT codes."},
            status=403,
        )
    if request.user.role == "PRINCIPAL" and role in ["OFFICIAL", "PRINCIPAL"]:
        return JsonResponse(
            {"error": "Principals can only create STUDENT and TEACHER codes."},
            status=403,
        )
    if request.user.role == "OFFICIAL" and role != "PRINCIPAL":
        return JsonResponse(
            {"error": "Officials can only create PRINCIPAL codes."},
            status=403,
        )

    # ── Resolve institution ─────────────────────────────────────────────────
    institution = None
    section = None
    district = None
    subject = None

    if request.user.role in ("TEACHER", "PRINCIPAL"):
        # Always their own institution — never from body
        institution = request.user.institution
        if not institution:
            return JsonResponse(
                {"error": "Your account has no institution assigned."},
                status=400,
            )
    elif request.user.role == "OFFICIAL":
        # OFFICIAL creates PRINCIPAL codes — institution comes from body
        # or they pick a school in their district
        institution_id = body.get("institution_id")
        if institution_id:
            institution = get_object_or_404(Institution, id=institution_id)
            # Verify institution is in their district
            if institution.district.name != request.user.district:
                return JsonResponse(
                    {"error": "That institution is not in your district."},
                    status=403,
                )
    else:
        # ADMIN
        institution_id = body.get("institution_id")
        if institution_id:
            institution = get_object_or_404(Institution, id=institution_id)

    # ── Resolve section ─────────────────────────────────────────────────────
    section_id = body.get("section_id")
    if section_id:
        section = get_object_or_404(Section, id=section_id)
        if institution and section.classroom.institution != institution:
            return JsonResponse(
                {"error": "Section does not belong to this institution."},
                status=400,
            )

    # ── Resolve district ────────────────────────────────────────────────────
    district_id = body.get("district_id")
    if district_id:
        district = get_object_or_404(District, id=district_id)
    elif request.user.role == "OFFICIAL" and not district_id:
        # OFFICIAL — auto-assign their own district FK
        try:
            district = District.objects.get(name=request.user.district)
        except District.DoesNotExist:
            pass

    # ── Resolve subject ─────────────────────────────────────────────────────
    subject_id = body.get("subject_id")
    if subject_id:
        subject = get_object_or_404(Subject, id=subject_id)

    # ── Expiry ──────────────────────────────────────────────────────────────
    expires_days = min(int(body.get("expires_days", 3)), 30)
    expires_at = timezone.now() + timezone.timedelta(days=expires_days)

    # ── Create ──────────────────────────────────────────────────────────────
    try:
        join_code = JoinCode(
            role=role,
            institution=institution,
            section=section,
            district=district,
            subject=subject,
            created_by=request.user,
            expires_at=expires_at,
        )
        join_code.full_clean()
        join_code.save()
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

    logger.info(
        "Join code created: id=%s role=%s by user id=%s",
        join_code.id, join_code.role, request.user.id,
    )

    return JsonResponse({
        "id": join_code.id,
        "code": join_code.code,
        "role": join_code.role,
        "institution": join_code.institution.name if join_code.institution else None,
        "section": join_code.section.name if join_code.section else None,
        "district": join_code.district.name if join_code.district else None,
        "subject": join_code.subject.name if join_code.subject else None,
        "expires_at": join_code.expires_at.isoformat(),
        "is_valid": join_code.is_valid(),
    }, status=201)


@require_roles(["ADMIN", "PRINCIPAL"])
@require_http_methods(["POST"])
@csrf_exempt
def revoke_join_code(request, code_id):
    """Mark a join code as used/revoked so it can no longer be used."""
    join_code = get_object_or_404(JoinCode, id=code_id)

    if request.user.role == "PRINCIPAL":
        if not request.user.institution or join_code.institution != request.user.institution:
            return JsonResponse({"error": "Forbidden"}, status=403)

    JoinCode.objects.filter(pk=join_code.pk).update(is_used=True)

    logger.info(
        "Join code id=%s revoked by user id=%s",
        code_id, request.user.id,
    )

    return JsonResponse({"success": True, "code": join_code.code})

# =========================================================
# JOIN CODE EXCEL EXPORT
# =========================================================

@require_roles(["ADMIN", "PRINCIPAL", "TEACHER", "OFFICIAL"])
@require_http_methods(["GET"])
def export_join_codes(request):
    """
    GET /api/v1/accounts/join-codes/export/

    Streams a formatted .xlsx file of the caller's visible join codes.
    Frontend triggers download via blob URL.
    """
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    from io import BytesIO
    from django.http import HttpResponse

    # ── Reuse scoped queryset logic ─────────────────────────────────────────
    queryset = JoinCode.objects.select_related(
        "institution", "section", "district", "subject", "created_by"
    ).order_by("-created_at")

    if request.user.role == "PRINCIPAL":
        if not request.user.institution:
            return JsonResponse({"error": "No institution assigned"}, status=400)
        queryset = queryset.filter(institution=request.user.institution)
    elif request.user.role == "TEACHER":
        if not request.user.institution:
            return JsonResponse({"error": "No institution assigned"}, status=400)
        queryset = queryset.filter(institution=request.user.institution, role="STUDENT")
    elif request.user.role == "OFFICIAL":
        if not request.user.district:
            return JsonResponse({"error": "No district assigned"}, status=400)
        queryset = (
            queryset.filter(institution__district__name=request.user.district) |
            queryset.filter(district__name=request.user.district)
        )

    # ── Build workbook ──────────────────────────────────────────────────────
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Join Codes"

    # Styles
    DARK    = "1E293B"
    LIGHT1  = "FFFFFF"
    LIGHT2  = "F1F5F9"
    BRAND   = "3B82F6"
    SUCCESS = "10B981"
    MUTED   = "64748B"

    header_fill = PatternFill("solid", start_color=DARK)
    header_font = Font(bold=True, color="F8FAFC", name="Arial", size=11)
    body_font   = Font(name="Arial", size=10, color="1E293B")
    code_font   = Font(name="Courier New", size=10, color=BRAND, bold=True)
    muted_font  = Font(name="Arial", size=9, color=MUTED)

    border_side = Side(style="thin", color="E2E8F0")
    thin_border = Border(
        left=border_side, right=border_side,
        top=border_side, bottom=border_side,
    )

    center = Alignment(horizontal="center", vertical="center")
    left   = Alignment(horizontal="left",   vertical="center")

    # Headers
    headers    = ["#", "Role", "Join Code", "Institution / District", "Section", "Subject", "Expires", "Status", "Created By"]
    col_widths = [4,    12,     22,          36,                        14,        18,         14,        10,       16]

    for ci, (h, w) in enumerate(zip(headers, col_widths), 1):
        cell = ws.cell(row=1, column=ci, value=h)
        cell.font      = header_font
        cell.fill      = header_fill
        cell.alignment = center
        cell.border    = thin_border
        ws.column_dimensions[get_column_letter(ci)].width = w

    ws.row_dimensions[1].height = 24
    ws.freeze_panes = "A2"

    # Data rows
    row_fills = [LIGHT1, LIGHT2]
    for ri, jc in enumerate(queryset, 2):
        fill = PatternFill("solid", start_color=row_fills[(ri - 2) % 2])

        status = "Active" if jc.is_valid() else ("Used" if jc.is_used else "Expired")
        for_val = (
            jc.institution.name if jc.institution else
            (jc.district.name if jc.district else "—")
        )

        row_data = [
            ri - 1,
            jc.role,
            jc.code,
            for_val,
            jc.section.name if jc.section else "—",
            jc.subject.name if jc.subject else "—",
            jc.expires_at.strftime("%d %b %Y"),
            status,
            jc.created_by.username if jc.created_by else "—",
        ]

        for ci, val in enumerate(row_data, 1):
            cell = ws.cell(row=ri, column=ci, value=val)
            cell.border = thin_border
            cell.fill   = fill

            if ci == 3:  # join code column
                cell.font      = code_font
                cell.alignment = left
            elif ci in (1, 2, 7, 8):
                cell.font      = body_font
                cell.alignment = center
            else:
                cell.font      = body_font
                cell.alignment = left

        ws.row_dimensions[ri].height = 20

    # Summary row
    total_rows = queryset.count()
    summary_row = total_rows + 2
    ws.cell(row=summary_row, column=1,
            value=f"Total: {total_rows} codes | Exported by: {request.user.username}").font = muted_font

    # ── Stream response ─────────────────────────────────────────────────────
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"gyangrit_join_codes_{timezone.now().strftime('%Y%m%d_%H%M')}.xlsx"
    response = HttpResponse(
        buf.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response["Access-Control-Expose-Headers"] = "Content-Disposition"
    return response


# =========================================================
# EMAIL A SINGLE JOIN CODE
# =========================================================

@require_roles(["ADMIN", "PRINCIPAL", "TEACHER", "OFFICIAL"])
@require_http_methods(["POST"])
@csrf_exempt
def email_join_code(request, code_id):
    """
    POST /api/v1/accounts/join-codes/<id>/email/

    Body: { "email": "recipient@example.com" }

    In DEBUG mode: returns a preview without sending.
    In production: sends via Django email backend (configure EMAIL_* settings).
    """
    import json as _json
    from django.core.mail import send_mail
    from django.core.validators import validate_email
    from django.core.exceptions import ValidationError

    try:
        body = _json.loads(request.body)
    except (_json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    recipient = body.get("email", "").strip()
    if not recipient:
        return JsonResponse({"error": "email is required"}, status=400)

    try:
        validate_email(recipient)
    except ValidationError:
        return JsonResponse({"error": "Invalid email address"}, status=400)

    join_code = get_object_or_404(JoinCode, id=code_id)

    # Scope check
    if request.user.role == "PRINCIPAL":
        if join_code.institution != request.user.institution:
            return JsonResponse({"error": "Forbidden"}, status=403)
    elif request.user.role == "TEACHER":
        if join_code.institution != request.user.institution or join_code.role != "STUDENT":
            return JsonResponse({"error": "Forbidden"}, status=403)
    elif request.user.role == "OFFICIAL":
        if join_code.district and join_code.district.name != request.user.district:
            return JsonResponse({"error": "Forbidden"}, status=403)

    if not join_code.is_valid():
        return JsonResponse({"error": "This code is already used or expired."}, status=400)

    # Build email content
    for_label = (
        join_code.institution.name if join_code.institution else
        (join_code.district.name if join_code.district else "GyanGrit")
    )
    subject = f"Your GyanGrit Join Code — {join_code.role.capitalize()}"
    body_text = f"""Hello,

You have been invited to join GyanGrit as a {join_code.role.lower()}.

Your join code is:

    {join_code.code}

Use this code on the registration page at: https://gyangrit.com/register

Details:
  Role:        {join_code.role}
  Institution: {for_label}
  Expires:     {join_code.expires_at.strftime('%d %b %Y')}

This code can only be used once.

— GyanGrit Team
"""

    preview = {
        "to":      recipient,
        "subject": subject,
        "body":    body_text,
        "code":    join_code.code,
        "role":    join_code.role,
        "for":     for_label,
    }

    if settings.DEBUG:
        # Development: return preview, don't send
        logger.debug(
            "DEV email preview for join code %s → %s", join_code.code, recipient
        )
        return JsonResponse({
            "sent":    False,
            "dev_mode": True,
            "preview": preview,
        })

    # Production: send via configured email backend
    try:
        send_mail(
            subject=subject,
            message=body_text,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@gyangrit.com"),
            recipient_list=[recipient],
            fail_silently=False,
        )
        logger.info(
            "Join code email sent: code=%s to=%s by user=%s",
            join_code.code, recipient, request.user.id,
        )
        return JsonResponse({"sent": True, "to": recipient})
    except Exception as e:
        logger.error("Failed to send join code email: %s", str(e))
        return JsonResponse(
            {"error": "Email delivery failed. Check server email configuration."},
            status=500,
        )


# =========================================================
# COMPLETE PROFILE  (enforced on first login)
# =========================================================

@require_http_methods(["PATCH"])
@csrf_exempt
def complete_profile(request):
    """
    PATCH /api/v1/accounts/profile/

    Accepts structured name fields and dual mobile numbers:
      ALL roles:    first_name*, last_name*, mobile_primary*, email*
      Optional:     middle_name, mobile_secondary

    Required for TEACHER/PRINCIPAL/OFFICIAL: email (for OTP delivery).
    Required for STUDENT: email (for reports + account recovery).

    Once all required fields are present, sets profile_complete = True.
    Idempotent: calling again after completion updates fields.

    Security notes:
    - email is NOT unique at DB level (siblings share family email)
    - mobile_primary is NOT unique (siblings share family phone)
    - mobile_secondary is optional (student's own phone or second parent)
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    user = request.user
    errors = {}
    # Track which fields were actually sent so we only update those
    update_fields = ["profile_complete"]

    # ── first_name (required) ────────────────────────────────────────────────
    if "first_name" in body:
        val = body["first_name"].strip()
        if not val:
            errors["first_name"] = "First name is required."
        elif len(val) < 2:
            errors["first_name"] = "First name must be at least 2 characters."
        else:
            user.first_name = val
            update_fields.append("first_name")

    # ── middle_name (optional) ───────────────────────────────────────────────
    if "middle_name" in body:
        user.middle_name = body["middle_name"].strip()
        update_fields.append("middle_name")

    # ── last_name (required) ─────────────────────────────────────────────────
    if "last_name" in body:
        val = body["last_name"].strip()
        if not val:
            errors["last_name"] = "Last name is required."
        elif len(val) < 2:
            errors["last_name"] = "Last name must be at least 2 characters."
        else:
            user.last_name = val
            update_fields.append("last_name")

    # ── email (required for all — siblings can share) ────────────────────────
    if "email" in body:
        email = body["email"].strip().lower()
        if not email:
            errors["email"] = "Email is required."
        else:
            from django.core.validators import validate_email
            from django.core.exceptions import ValidationError as DjangoValidationError
            try:
                validate_email(email)
                user.email = email
                update_fields.append("email")
            except DjangoValidationError:
                errors["email"] = "Enter a valid email address."

    # ── mobile_primary (required) ────────────────────────────────────────────
    if "mobile_primary" in body:
        raw = body["mobile_primary"].strip()
        digits = "".join(c for c in raw if c.isdigit())
        if not raw:
            errors["mobile_primary"] = "Primary mobile number is required."
        elif len(digits) < 10:
            errors["mobile_primary"] = "Enter a valid 10-digit mobile number."
        else:
            user.mobile_primary = raw
            update_fields.append("mobile_primary")

    # ── mobile_secondary (optional) ──────────────────────────────────────────
    if "mobile_secondary" in body:
        raw = body["mobile_secondary"].strip()
        if raw:
            digits = "".join(c for c in raw if c.isdigit())
            if len(digits) < 10:
                errors["mobile_secondary"] = "Enter a valid 10-digit mobile number."
            else:
                user.mobile_secondary = raw
                update_fields.append("mobile_secondary")
        else:
            # Allow clearing secondary number
            user.mobile_secondary = ""
            update_fields.append("mobile_secondary")

    if errors:
        return JsonResponse({"errors": errors}, status=400)

    # ── Determine if profile is complete ─────────────────────────────────────
    # Required: first_name, last_name, mobile_primary, email
    is_complete = bool(
        user.first_name.strip()
        and user.last_name.strip()
        and user.mobile_primary.strip()
        and user.email.strip()
    )

    user.profile_complete = is_complete
    user.save(update_fields=update_fields)

    logger.info(
        "Profile updated: user=%s complete=%s",
        user.id, user.profile_complete,
    )

    return JsonResponse({
        "profile_complete":  user.profile_complete,
        "first_name":        user.first_name,
        "middle_name":       user.middle_name,
        "last_name":         user.last_name,
        "display_name":      user.display_name,
        "email":             user.email,
        "mobile_primary":    user.mobile_primary,
        "mobile_secondary":  user.mobile_secondary,
    })

# =========================================================
# BULK JOIN CODE GENERATION
# =========================================================

@require_roles(["ADMIN", "PRINCIPAL", "TEACHER", "OFFICIAL"])
@require_http_methods(["POST"])
@csrf_exempt
def bulk_create_join_codes(request):
    """
    POST /api/v1/accounts/join-codes/bulk/

    Body:
    {
      "role":           "STUDENT",
      "count":          20,          // 1–100
      "institution_id": 5,           // optional for TEACHER/PRINCIPAL (auto-resolved)
      "section_id":     12,          // optional, for STUDENT
      "subject_id":     3,           // required for TEACHER
      "district_id":    2,           // required for OFFICIAL
      "expires_days":   3            // 1–30, default 3
    }

    Returns all created codes so the frontend can immediately show/download them.
    All codes created atomically — if any fail, none are saved.

    Edge cases:
    - count > 100: rejected (prevents abuse)
    - count < 1: rejected
    - Same section for all student codes (they register individually, 1 code each)
    - If partial failure in the loop: transaction.atomic() rolls back all
    """
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    role = body.get("role", "").upper()
    valid_roles = ["STUDENT", "TEACHER", "PRINCIPAL", "OFFICIAL"]

    if role not in valid_roles:
        return JsonResponse({"error": f"role must be one of: {', '.join(valid_roles)}"}, status=400)

    # Count validation
    try:
        count = int(body.get("count", 1))
    except (TypeError, ValueError):
        return JsonResponse({"error": "count must be an integer."}, status=400)

    if count < 1:
        return JsonResponse({"error": "count must be at least 1."}, status=400)
    if count > 100:
        return JsonResponse({"error": "Maximum 100 codes per batch."}, status=400)

    # ── Permission matrix (same as create_join_code) ─────────────────────────
    if request.user.role == "TEACHER" and role != "STUDENT":
        return JsonResponse({"error": "Teachers can only create STUDENT codes."}, status=403)
    if request.user.role == "PRINCIPAL" and role in ["OFFICIAL", "PRINCIPAL"]:
        return JsonResponse({"error": "Principals can only create STUDENT and TEACHER codes."}, status=403)
    if request.user.role == "OFFICIAL" and role != "PRINCIPAL":
        return JsonResponse({"error": "Officials can only create PRINCIPAL codes."}, status=403)

    # ── Resolve institution ──────────────────────────────────────────────────
    institution = None
    section = None
    district = None
    subject = None

    if request.user.role in ("TEACHER", "PRINCIPAL"):
        institution = request.user.institution
        if not institution:
            return JsonResponse({"error": "Your account has no institution assigned."}, status=400)
    elif request.user.role == "OFFICIAL":
        institution_id = body.get("institution_id")
        if institution_id:
            institution = get_object_or_404(Institution, id=institution_id)
            if institution.district.name != request.user.district:
                return JsonResponse({"error": "That institution is not in your district."}, status=403)
    else:
        institution_id = body.get("institution_id")
        if institution_id:
            institution = get_object_or_404(Institution, id=institution_id)

    # ── Resolve section ──────────────────────────────────────────────────────
    section_id = body.get("section_id")
    if section_id:
        section = get_object_or_404(Section, id=section_id)
        if institution and section.classroom.institution != institution:
            return JsonResponse({"error": "Section does not belong to this institution."}, status=400)

    # ── Resolve district ─────────────────────────────────────────────────────
    district_id = body.get("district_id")
    if district_id:
        district = get_object_or_404(District, id=district_id)
    elif request.user.role == "OFFICIAL":
        try:
            district = District.objects.get(name=request.user.district)
        except District.DoesNotExist:
            pass

    # ── Resolve subject ──────────────────────────────────────────────────────
    subject_id = body.get("subject_id")
    if subject_id:
        subject = get_object_or_404(Subject, id=subject_id)

    # ── Expiry ───────────────────────────────────────────────────────────────
    expires_days = min(int(body.get("expires_days", 3)), 30)
    expires_at = timezone.now() + timezone.timedelta(days=expires_days)

    # ── Create atomically ────────────────────────────────────────────────────
    created_codes = []
    try:
        with transaction.atomic():
            for _ in range(count):
                jc = JoinCode(
                    role=role,
                    institution=institution,
                    section=section,
                    district=district,
                    subject=subject,
                    created_by=request.user,
                    expires_at=expires_at,
                )
                jc.full_clean()
                jc.save()
                created_codes.append(jc)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

    logger.info(
        "Bulk join codes created: count=%d role=%s by user=%s",
        count, role, request.user.id,
    )

    data = [
        {
            "id":          jc.id,
            "code":        jc.code,
            "role":        jc.role,
            "institution": jc.institution.name if jc.institution else None,
            "section":     jc.section.name if jc.section else None,
            "district":    jc.district.name if jc.district else None,
            "subject":     jc.subject.name if jc.subject else None,
            "is_used":     jc.is_used,
            "is_valid":    jc.is_valid(),
            "expires_at":  jc.expires_at.isoformat(),
            "created_at":  jc.created_at.isoformat(),
            "created_by":  jc.created_by.username if jc.created_by else None,
        }
        for jc in created_codes
    ]

    return JsonResponse({"created": len(data), "codes": data}, status=201)

# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM STATS  (ADMIN only)
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["ADMIN"])
@require_http_methods(["GET"])
def system_stats(request):
    """
    GET /api/v1/accounts/system-stats/

    Returns a lightweight system overview for the Admin dashboard.
    All counts are live — no caching. Queries are each O(1) COUNT(*).

    Response:
    {
      "users": {
        "total": 320,
        "students": 280,
        "teachers": 25,
        "principals": 8,
        "officials": 5,
        "admins": 2
      },
      "active_sessions": 47,
      "content": {
        "courses": 60,
        "lessons": 420,
        "published_assessments": 95
      },
      "activity": {
        "lessons_completed_today": 38,
        "assessments_submitted_today": 12,
        "notifications_sent_today": 4
      }
    }
    """
    from django.utils import timezone
    from apps.content.models import Course, Lesson, LessonProgress
    from apps.assessments.models import Assessment, AssessmentAttempt
    from apps.notifications.models import Broadcast
    from apps.accounts.models import DeviceSession

    User = get_user_model()
    today = timezone.now().date()

    # ── User counts ───────────────────────────────────────────────────────────
    all_users = User.objects.all()
    user_counts = {
        "total":      all_users.count(),
        "students":   all_users.filter(role="STUDENT").count(),
        "teachers":   all_users.filter(role="TEACHER").count(),
        "principals": all_users.filter(role="PRINCIPAL").count(),
        "officials":  all_users.filter(role="OFFICIAL").count(),
        "admins":     all_users.filter(role="ADMIN").count(),
    }

    # ── Active sessions ───────────────────────────────────────────────────────
    active_sessions = DeviceSession.objects.count()

    # ── Content counts ────────────────────────────────────────────────────────
    content = {
        "courses":               Course.objects.count(),
        "lessons":               Lesson.objects.filter(is_published=True).count(),
        "published_assessments": Assessment.objects.filter(is_published=True).count(),
    }

    # ── Today's activity ──────────────────────────────────────────────────────
    activity = {
        "lessons_completed_today":    LessonProgress.objects.filter(
            completed=True,
            last_opened_at__date=today,
        ).count(),
        "assessments_submitted_today": AssessmentAttempt.objects.filter(
            submitted_at__date=today,
        ).count(),
        "notifications_sent_today": Broadcast.objects.filter(
            sent_at__date=today,
        ).count(),
    }

    return JsonResponse({
        "users":           user_counts,
        "active_sessions": active_sessions,
        "content":         content,
        "activity":        activity,
    })
