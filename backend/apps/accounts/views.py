import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from apps.accesscontrol.models import JoinCode

from .models import Institution, Section

User = get_user_model()


# =========================================================
# REGISTER
# =========================================================


@require_http_methods(["POST"])
@csrf_exempt
def register(request):

    body = json.loads(request.body)

    username = body.get("username")
    password = body.get("password")
    role = body.get("role", "STUDENT")
    join_code_value = body.get("join_code")

    if not username or not password:
        return JsonResponse({"error": "username and password required"}, status=400)

    if role not in dict(User.ROLE_CHOICES):
        return JsonResponse({"error": "invalid role"}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "username already exists"}, status=400)

    institution = None
    section = None
    district = None

    # 🔴 REQUIRE JOIN CODE FOR NON-STUDENT ROLES
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

    # STUDENTS handled separately later
    elif role == "STUDENT":
        return JsonResponse(
            {"error": "students must register using registration code"},
            status=400,
        )

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
# LOGIN
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

    login(request, user)

    return JsonResponse({
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "institution": user.institution.name if user.institution else None,
        "section": user.section.name if user.section else None,
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
        "institution": request.user.institution.name
        if request.user.institution else None,
        "section": request.user.section.name
        if request.user.section else None,
    })


# =========================================================
# ADMIN USER LIST
# =========================================================

@require_http_methods(["GET"])
def users(request):

    if not request.user.is_authenticated or request.user.role != "ADMIN":
        return JsonResponse({"error": "Forbidden"}, status=403)

    data = list(
        User.objects.all()
        .order_by("id")
        .values(
            "id",
            "username",
            "role",
            "institution__name",
            "section__name",
            "is_active",
        )
    )

    return JsonResponse(data, safe=False)