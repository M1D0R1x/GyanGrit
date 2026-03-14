import json
import logging
import random

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.db import transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from apps.accesscontrol.scoped_service import scope_queryset

from apps.academics.models import (
    Institution,
    Section,
    Subject,
)
from .models import (
    StudentRegistrationRecord,
    OTPVerification,
    DeviceSession,
    JoinCode,
)
from .services import assign_teacher_to_classes

User = get_user_model()
logger = logging.getLogger(__name__)


# =========================================================
# INTERNAL HELPER: safe device session creation
# =========================================================

def _create_device_session(request, user):
    """
    Creates a DeviceSession after ensuring the Django session has been
    persisted to the database.

    Why this matters:
    request.session.session_key is None until session.save() is called.
    If we store None as the device_fingerprint, single-session enforcement
    in middleware will never match and will log out every request.
    This was a critical silent bug in the original code.
    """
    if not request.session.session_key:
        request.session.save()

    DeviceSession.objects.filter(user=user).delete()
    DeviceSession.objects.create(
        user=user,
        device_fingerprint=request.session.session_key,
    )


# =========================================================
# REGISTER (join code based — all roles except STUDENT record)
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
            "institution",
            "section",
            "district",
            "subject",
        ).get(code=join_code_value)
    except JoinCode.DoesNotExist:
        return JsonResponse({"error": "Invalid join code"}, status=400)

    if not join_code.is_valid():
        return JsonResponse(
            {"error": "Expired or already used join code"},
            status=400,
        )

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username already exists"}, status=400)

    role = join_code.role
    institution = join_code.institution
    section = join_code.section

    # Resolve district string from institution or section chain
    district = None
    if institution:
        district = institution.district.name
    elif section and section.classroom and section.classroom.institution:
        district = section.classroom.institution.district.name

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
        user.id,
        user.username,
        user.role,
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
# STUDENT SELF REGISTRATION (via StudentRegistrationRecord)
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def student_register(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    code = body.get("registration_code", "").strip()
    username = body.get("username", "").strip()
    password = body.get("password", "")
    dob = body.get("dob", "").strip()

    if not all([code, username, password, dob]):
        return JsonResponse({"error": "Missing required fields"}, status=400)

    try:
        record = StudentRegistrationRecord.objects.select_related(
            "section",
            "section__classroom",
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

    logger.info(
        "Student self-registered: id=%s username=%s section=%s",
        user.id,
        user.username,
        user.section,
    )

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

    # STUDENT and ADMIN bypass OTP — log in directly
    if user.role in ["STUDENT", "ADMIN"]:
        login(request, user)
        _create_device_session(request, user)
        return JsonResponse({
            "otp_required": False,
            "id": user.id,
            "username": user.username,
            "role": user.role,
        })

    # All other roles require OTP
    otp_code = str(random.randint(100000, 999999))
    OTPVerification.objects.filter(user=user).delete()
    OTPVerification.objects.create(user=user, otp_code=otp_code)

    # WARNING: OTP returned in response for development only.
    # Remove otp_code from response and replace with SMS/email before production.
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

    username = body.get("username", "").strip()
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
        return JsonResponse(
            {"error": "Too many attempts. Request a new OTP."},
            status=429,
        )

    if otp_record.otp_code != otp_input:
        otp_record.attempt_count += 1
        otp_record.last_attempt_at = timezone.now()
        otp_record.save(update_fields=["attempt_count", "last_attempt_at"])
        return JsonResponse({"error": "Invalid OTP"}, status=400)

    # OTP correct — log the user in
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
# ME — current authenticated user profile
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
        # district required by OFFICIAL dashboard and AuthContext
        "district": user.district if user.district else None,
    })


# =========================================================
# CSRF TOKEN — called by frontend before first POST
# =========================================================

@require_http_methods(["GET"])
def csrf_token_view(request):
    return JsonResponse({"csrfToken": get_token(request)})


# =========================================================
# VALIDATE JOIN CODE
# NOTE: This is POST + csrf_exempt for frontend convenience during dev.
# Architecturally this should be GET with code as query param
# since it has no side effects. Candidate for refactor in v2.
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
        return JsonResponse(
            {"error": "Expired or already used join code"},
            status=400,
        )

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
    return JsonResponse(
        list(queryset.values("id", "username", "role")),
        safe=False,
    )


@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL"])
@require_http_methods(["GET"])
def institutions(request):
    queryset = scope_queryset(request.user, Institution.objects.all())
    return JsonResponse(
        list(queryset.values("id", "name", "district__name")),
        safe=False,
    )


@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL", "TEACHER"])
@require_http_methods(["GET"])
def sections(request):
    queryset = scope_queryset(request.user, Section.objects.all())
    return JsonResponse(
        list(queryset.values("id", "name")),
        safe=False,
    )


@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL", "TEACHER"])
@require_http_methods(["GET"])
def subjects(request):
    queryset = scope_queryset(request.user, Subject.objects.all())
    return JsonResponse(
        list(queryset.values("id", "name")),
        safe=False,
    )


@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL"])
@require_http_methods(["GET"])
def teachers(request):
    queryset = scope_queryset(
        request.user,
        User.objects.filter(role="TEACHER"),
    )
    return JsonResponse(
        list(queryset.values("id", "username")),
        safe=False,
    )