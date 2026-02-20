import json
import random
import hashlib

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.sessions.models import Session

from apps.accesscontrol.models import JoinCode
from apps.accesscontrol.permissions import require_roles
from apps.accesscontrol.scoping import institution_scope_queryset

from .models import (
    Institution,
    Section,
    Subject,
    StudentRegistrationRecord,
    OTPVerification,
    DeviceSession,
)

User = get_user_model()

# =========================================================
# REGISTER (PRINCIPAL / TEACHER via JOIN CODE)
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def register(request):
    body = json.loads(request.body)

    username = body.get("username")
    password = body.get("password")
    role = body.get("role")
    join_code_value = body.get("join_code")

    if not username or not password:
        return JsonResponse({"error": "username and password required"}, status=400)

    if role not in dict(User.ROLE_CHOICES):
        return JsonResponse({"error": "invalid role"}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "username already exists"}, status=400)

    if role == "STUDENT":
        return JsonResponse(
            {"error": "students must register using registration code"},
            status=400,
        )

    institution = None
    section = None
    district = None

    if role in ["PRINCIPAL", "TEACHER"]:
        if not join_code_value:
            return JsonResponse({"error": "join_code required"}, status=400)

        try:
            join_code = JoinCode.objects.get(code=join_code_value)
        except JoinCode.DoesNotExist:
            return JsonResponse({"error": "invalid join_code"}, status=400)

        if not join_code.is_valid():
            return JsonResponse({"error": "expired or used join_code"}, status=400)

        if join_code.role != role:
            return JsonResponse({"error": "role mismatch for join_code"}, status=400)

        institution = join_code.institution
        section = join_code.section
        district = join_code.district

        join_code.is_used = True
        join_code.save(update_fields=["is_used"])

    user = User.objects.create_user(username=username, password=password)

    user.role = role
    user.institution = institution
    user.section = section
    user.district = district
    user.save()

    return JsonResponse({
        "id": user.id,
        "public_id": user.public_id,
        "username": user.username,
        "role": user.role,
        "institution": user.institution.name if user.institution else None,
        "section": user.section.name if user.section else None,
    })


# =========================================================
# LOGIN (PASSWORD STAGE ONLY)
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def login_view(request):
    body = json.loads(request.body)

    user = authenticate(
        username=body.get("username"),
        password=body.get("password"),
    )

    if not user:
        return JsonResponse({"error": "invalid credentials"}, status=401)

    # STUDENTS → direct login (no OTP)
    if user.role == "STUDENT":
        login(request, user)
        return JsonResponse({
            "otp_required": False,
            "id": user.id,
            "username": user.username,
            "role": user.role,
        })

    # Non-students: ALWAYS require OTP on every login attempt
    otp_code = str(random.randint(100000, 999999))

    # Create a fresh OTP record every time
    otp_record = OTPVerification.objects.create(
        user=user,
        otp_code=otp_code,
        is_verified=False,
        attempt_count=0,
    )

    return JsonResponse({
        "otp_required": True,
        "dev_console": {  # REMOVE THIS IN PRODUCTION!
            "username": user.username,
            "otp": otp_record.otp_code,
        }
    })


# =========================================================
# VERIFY OTP + SINGLE SESSION ENFORCEMENT
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def verify_otp(request):
    body = json.loads(request.body)

    username = body.get("username")
    otp_input = body.get("otp")

    if not username or not otp_input:
        return JsonResponse({"error": "Missing username or OTP"}, status=400)

    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return JsonResponse({"error": "Invalid user"}, status=400)

    # Get the most recent OTP record
    otp_record = OTPVerification.objects.filter(user=user).order_by('-created_at').first()

    if not otp_record:
        return JsonResponse({"error": "No OTP found for this login attempt"}, status=400)

    # Check expiration (10 minutes)
    if otp_record.is_expired():
        return JsonResponse({"error": "OTP has expired"}, status=400)

    # Check attempt limit
    if otp_record.attempt_count >= 5:
        return JsonResponse({"error": "Too many invalid attempts. Please login again."}, status=429)

    if otp_record.otp_code != otp_input:
        otp_record.attempt_count += 1
        otp_record.last_attempt_at = timezone.now()
        otp_record.save(update_fields=["attempt_count", "last_attempt_at"])
        return JsonResponse({"error": "Invalid OTP"}, status=400)

    # OTP is correct → enforce single session
    existing_session = DeviceSession.objects.filter(user=user).first()
    if existing_session:
        try:
            Session.objects.filter(session_key=existing_session.device_fingerprint).delete()
        except Exception:
            pass  # silent fail
        existing_session.delete()

    # Log in the user (creates new session)
    login(request, user)

    # Save new session
    DeviceSession.objects.create(
        user=user,
        device_fingerprint=request.session.session_key,
    )

    # Mark OTP as verified
    otp_record.is_verified = True
    otp_record.save(update_fields=["is_verified"])

    return JsonResponse({
        "success": True,
        "id": user.id,
        "username": user.username,
        "role": user.role,
    })


# =========================================================
# LOGOUT
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def logout_view(request):
    if request.user.is_authenticated:
        # Optional: clean up unverified OTPs
        OTPVerification.objects.filter(user=request.user, is_verified=False).delete()
        # Delete current device session
        DeviceSession.objects.filter(user=request.user).delete()
    logout(request)
    return JsonResponse({"success": True})


# =========================================================
# ME (current user info)
# =========================================================

@require_http_methods(["GET"])
def me(request):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False})

    return JsonResponse({
        "authenticated": True,
        "id": request.user.id,
        "username": request.user.username,
        "role": request.user.role,
        "institution": request.user.institution.name if request.user.institution else None,
        "section": request.user.section.name if request.user.section else None,
    })


# =========================================================
# SCOPED ENDPOINTS (unchanged)
# =========================================================

@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL"])
@require_http_methods(["GET"])
def users(request):
    queryset = institution_scope_queryset(request.user, User.objects.all())
    data = list(queryset.values("id", "username", "role"))
    return JsonResponse(data, safe=False)


@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL"])
@require_http_methods(["GET"])
def institutions(request):
    queryset = institution_scope_queryset(request.user, Institution.objects.all())
    return JsonResponse(list(queryset.values("id", "name", "district")), safe=False)


@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL", "TEACHER"])
@require_http_methods(["GET"])
def sections(request):
    queryset = institution_scope_queryset(request.user, Section.objects.all())
    return JsonResponse(list(queryset.values("id", "name")), safe=False)


@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL", "TEACHER"])
@require_http_methods(["GET"])
def subjects(request):
    queryset = institution_scope_queryset(request.user, Subject.objects.all())
    return JsonResponse(list(queryset.values("id", "name")), safe=False)


@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL"])
@require_http_methods(["GET"])
def teachers(request):
    queryset = institution_scope_queryset(
        request.user,
        User.objects.filter(role="TEACHER"),
    )
    return JsonResponse(list(queryset.values("id", "username")), safe=False)


# =========================================================
# STUDENT SELF REGISTRATION (unchanged)
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def student_register(request):
    body = json.loads(request.body)

    code = body.get("registration_code")
    username = body.get("username")
    password = body.get("password")
    dob = body.get("dob")

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
        return JsonResponse({"error": "Code already used"}, status=400)

    if str(record.dob) != str(dob):
        return JsonResponse({"error": "DOB does not match school record"}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username already exists"}, status=400)

    with transaction.atomic():
        user = User.objects.create_user(
            username=username,
            password=password,
        )

        user.role = "STUDENT"
        user.institution = record.section.classroom.institution
        user.section = record.section
        user.save()

        record.is_registered = True
        record.linked_user = user
        record.save()

    return JsonResponse({
        "id": user.id,
        "public_id": user.public_id,
        "username": user.username,
        "section": user.section.name,
        "institution": user.institution.name,
    })