import json
import random

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.models import JoinCode
from apps.accesscontrol.permissions import require_roles
from apps.accesscontrol.scoping import institution_scope_queryset

from .models import (
    Institution,
    Section,
    Subject,
    StudentRegistrationRecord,
    OTPVerification,
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

    user = User.objects.create_user(
        username=username,
        password=password,
    )

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
# LOGIN (STEP 1: PASSWORD)
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

    if user.role == "STUDENT":
        login(request, user)
        return JsonResponse({
            "otp_required": False,
            "id": user.id,
            "username": user.username,
            "role": user.role,
        })

    today = timezone.now().date()

    otp_record, created = OTPVerification.objects.get_or_create(
        user=user,
        date=today,
        defaults={
            "otp_code": str(random.randint(100000, 999999)),
            "is_verified": False,
        },
    )

    if not created and otp_record.is_verified:
        login(request, user)
        return JsonResponse({
            "otp_required": False,
            "id": user.id,
            "username": user.username,
            "role": user.role,
        })

    if not created and otp_record.is_expired():
        otp_record.otp_code = str(random.randint(100000, 999999))
        otp_record.attempt_count = 0
        otp_record.is_verified = False
        otp_record.created_at = timezone.now()
        otp_record.save()

    return JsonResponse({
        "otp_required": True,
        "otp_preview": otp_record.otp_code,  # REMOVE IN PRODUCTION
    })


# =========================================================
# VERIFY OTP (STEP 2)
# =========================================================

@require_http_methods(["POST"])
@csrf_exempt
def verify_otp(request):

    body = json.loads(request.body)

    username = body.get("username")
    otp_input = body.get("otp")

    if not username or not otp_input:
        return JsonResponse({"error": "Missing fields"}, status=400)

    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return JsonResponse({"error": "Invalid user"}, status=400)

    today = timezone.now().date()

    try:
        otp_record = OTPVerification.objects.get(user=user, date=today)
    except OTPVerification.DoesNotExist:
        return JsonResponse({"error": "OTP not found"}, status=400)

    if otp_record.is_expired():
        return JsonResponse({"error": "OTP expired"}, status=400)

    if not otp_record.can_attempt():
        return JsonResponse({"error": "Too many attempts"}, status=403)

    if otp_record.otp_code != otp_input:
        otp_record.attempt_count += 1
        otp_record.last_attempt_at = timezone.now()
        otp_record.save(update_fields=["attempt_count", "last_attempt_at"])
        return JsonResponse({"error": "Invalid OTP"}, status=400)

    otp_record.is_verified = True
    otp_record.save(update_fields=["is_verified"])

    login(request, user)

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
    logout(request)
    return JsonResponse({"success": True})


# =========================================================
# ME
# =========================================================

@require_http_methods(["GET"])
def me(request):

    if not request.user.is_authenticated:
        return JsonResponse({
            "authenticated": False,
            "role": "STUDENT",
        })

    return JsonResponse({
        "authenticated": True,
        "id": request.user.id,
        "username": request.user.username,
        "role": request.user.role,
        "institution": request.user.institution.name if request.user.institution else None,
        "section": request.user.section.name if request.user.section else None,
    })


# =========================================================
# ADMIN USER LIST
# =========================================================

@require_roles(["ADMIN", "OFFICIAL", "PRINCIPAL"])
@require_http_methods(["GET"])
def users(request):

    queryset = User.objects.all().order_by("id")
    queryset = institution_scope_queryset(request.user, queryset)

    data = list(
        queryset.values(
            "id",
            "public_id",
            "username",
            "role",
            "institution__name",
            "section__name",
            "is_active",
        )
    )

    return JsonResponse(data, safe=False)