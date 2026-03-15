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
        "authenticated": True,
        "id": user.id,
        "public_id": user.public_id,
        "username": user.username,
        "role": user.role,
        "institution": user.institution.name if user.institution else None,
        "institution_id": user.institution.id if user.institution else None,
        "section": user.section.name if user.section else None,
        "section_id": user.section.id if user.section else None,
        "district": user.district if user.district else None,
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
    queryset = scope_queryset(request.user, Institution.objects.all())
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


# =========================================================
# JOIN CODE MANAGEMENT
# =========================================================

@require_roles(["ADMIN", "PRINCIPAL", "TEACHER"])
@require_http_methods(["GET"])
def join_codes_list(request):
    """
    List join codes visible to the current user.
    - ADMIN: all codes
    - PRINCIPAL: codes for their institution
    - TEACHER: codes for their institution (student codes only)
    """
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


@require_roles(["ADMIN", "PRINCIPAL", "TEACHER"])
@require_http_methods(["POST"])
@csrf_exempt
def create_join_code(request):
    """
    Create a new join code.

    Scoping rules:
    - ADMIN: can create any role, must supply institution_id/section_id/etc.
    - PRINCIPAL: can create STUDENT and TEACHER codes for their institution only.
    - TEACHER: can create STUDENT codes for their institution only.
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

    # ── Enforce role creation permissions ────────────────────────────────────
    if request.user.role == "TEACHER" and role != "STUDENT":
        return JsonResponse(
            {"error": "Teachers can only create STUDENT codes"},
            status=403,
        )
    if request.user.role == "PRINCIPAL" and role in ["OFFICIAL", "PRINCIPAL"]:
        return JsonResponse(
            {"error": "Principals can only create STUDENT and TEACHER codes"},
            status=403,
        )

    # ── Resolve institution ──────────────────────────────────────────────────
    # If the requester is TEACHER or PRINCIPAL, institution is always their own.
    # ADMIN must supply institution_id for non-OFFICIAL roles.
    institution = None
    section = None
    district = None
    subject = None

    if request.user.role in ("TEACHER", "PRINCIPAL"):
        institution = request.user.institution
        if not institution:
            return JsonResponse(
                {"error": "Your account has no institution assigned."},
                status=400,
            )
    else:
        # ADMIN — resolve from body
        institution_id = body.get("institution_id")
        if institution_id:
            institution = get_object_or_404(Institution, id=institution_id)

    # ── Resolve section ──────────────────────────────────────────────────────
    section_id = body.get("section_id")
    if section_id:
        section = get_object_or_404(Section, id=section_id)
        # Verify section belongs to institution
        if institution and section.classroom.institution != institution:
            return JsonResponse(
                {"error": "Section does not belong to this institution."},
                status=400,
            )

    # ── Resolve district ─────────────────────────────────────────────────────
    district_id = body.get("district_id")
    if district_id:
        district = get_object_or_404(District, id=district_id)

    # ── Resolve subject ──────────────────────────────────────────────────────
    subject_id = body.get("subject_id")
    if subject_id:
        subject = get_object_or_404(Subject, id=subject_id)

    # ── Expiry ────────────────────────────────────────────────────────────────
    expires_days = min(int(body.get("expires_days", 3)), 30)
    expires_at = timezone.now() + timezone.timedelta(days=expires_days)

    # ── Create ────────────────────────────────────────────────────────────────
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