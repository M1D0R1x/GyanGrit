import json
import random

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from apps.accesscontrol.scoped_service import scope_queryset as institution_scope_queryset

from apps.academics.models import Institution, Section, Subject
from .models import (
    StudentRegistrationRecord,
    OTPVerification,
    DeviceSession,
    JoinCode,
)

User = get_user_model()


# =========================================================
# REGISTER (Fixed: public_id now always correct A/S/T/P/O)
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def register(request):
    body = json.loads(request.body)

    username = body.get("username")
    password = body.get("password")
    join_code_value = body.get("join_code")

    if not username or not password or not join_code_value:
        return JsonResponse({"error": "username, password and join_code are required"}, status=400)

    try:
        join_code = JoinCode.objects.get(code=join_code_value)
    except JoinCode.DoesNotExist:
        return JsonResponse({"error": "invalid join_code"}, status=400)

    if not join_code.is_valid():
        return JsonResponse({"error": "expired or already used join_code"}, status=400)

    role = join_code.role

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "username already exists"}, status=400)

    institution = join_code.institution
    section = join_code.section
    district = None
    if institution:
        district = institution.district.name
    elif section and section.classroom and section.classroom.institution:
        district = section.classroom.institution.district.name

    with transaction.atomic():
        user = User.objects.create_user(username=username, password=password)

        # CRITICAL FIX: Set role BEFORE any save() so generate_public_id works
        user.role = role
        user.institution = institution
        user.section = section
        user.district = district
        user.save()                     # ← public_id now correctly generated

        join_code.mark_as_used()

    return JsonResponse({
        "id": user.id,
        "public_id": user.public_id,
        "username": user.username,
        "role": user.role,
        "institution": user.institution.name if user.institution else None,
        "section": user.section.name if user.section else None,
    })


# =========================================================
# STUDENT SELF REGISTRATION (also fixed)
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
            "section", "section__classroom", "section__classroom__institution"
        ).get(registration_code=code)
    except StudentRegistrationRecord.DoesNotExist:
        return JsonResponse({"error": "Invalid registration code"}, status=400)

    if record.is_registered:
        return JsonResponse({"error": "Code already used"}, status=400)

    if str(record.dob) != str(dob):
        return JsonResponse({"error": "DOB mismatch"}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username exists"}, status=400)

    with transaction.atomic():
        user = User.objects.create_user(username=username, password=password)

        # CRITICAL FIX: Set role BEFORE save
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


# =========================================================
# LOGIN + OTP + LOGOUT + ME (unchanged — already good)
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def login_view(request):
    body = json.loads(request.body)
    user = authenticate(username=body.get("username"), password=body.get("password"))

    if not user:
        return JsonResponse({"error": "invalid credentials"}, status=401)

    if user.role in ["STUDENT", "ADMIN"]:
        login(request, user)
        return JsonResponse({
            "otp_required": False,
            "id": user.id,
            "username": user.username,
            "role": user.role,
        })

    otp_code = str(random.randint(100000, 999999))
    OTPVerification.objects.filter(user=user).delete()
    OTPVerification.objects.create(user=user, otp_code=otp_code)

    print(f"OTP for {user.username} (dev only): {otp_code}")

    return JsonResponse({
        "otp_required": True,
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "otp_code": otp_code,
    })


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
        return JsonResponse({"error": "Invalid credentials"}, status=400)

    otp_record = OTPVerification.objects.filter(user=user).order_by('-created_at').first()

    if not otp_record or otp_record.is_expired():
        return JsonResponse({"error": "OTP expired or not found"}, status=400)

    if otp_record.attempt_count >= 5:
        return JsonResponse({"error": "Too many attempts"}, status=429)

    if otp_record.otp_code != otp_input:
        otp_record.attempt_count += 1
        otp_record.last_attempt_at = timezone.now()
        otp_record.save(update_fields=["attempt_count", "last_attempt_at"])
        return JsonResponse({"error": "Invalid OTP"}, status=400)

    DeviceSession.objects.filter(user=user).delete()
    login(request, user)
    DeviceSession.objects.create(user=user, device_fingerprint=request.session.session_key)

    otp_record.is_verified = True
    otp_record.save()

    return JsonResponse({"success": True, "role": user.role})


@require_http_methods(["POST"])
@csrf_exempt
def logout_view(request):
    if request.user.is_authenticated:
        DeviceSession.objects.filter(user=request.user).delete()
    logout(request)
    return JsonResponse({"success": True})


@require_http_methods(["GET"])
def me(request):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False})

    user = User.objects.select_related("institution", "section").get(id=request.user.id)

    return JsonResponse({
        "authenticated": True,
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "institution": user.institution.name if user.institution else None,
        "section": user.section.name if user.section else None,
    })


# =========================================================
# SCOPED ENDPOINTS (unchanged)
# =========================================================
@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL"])
@require_http_methods(["GET"])
def users(request):
    queryset = institution_scope_queryset(request.user, User.objects.all())
    return JsonResponse(list(queryset.values("id", "username", "role")), safe=False)


@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL"])
@require_http_methods(["GET"])
def institutions(request):
    queryset = institution_scope_queryset(request.user, Institution.objects.all())
    return JsonResponse(list(queryset.values("id", "name", "district__name")), safe=False)


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
    queryset = institution_scope_queryset(request.user, User.objects.filter(role="TEACHER"))
    return JsonResponse(list(queryset.values("id", "username")), safe=False)