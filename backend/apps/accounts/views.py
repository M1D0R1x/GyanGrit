import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt

User = get_user_model()

"""
ACCOUNTS API (v1)

Scope:
- Basic registration
- Basic login (session-based)
- Role exposure
- Admin-only user listing (READ-ONLY)
"""


# --------------------------------------------------
# Registration
# --------------------------------------------------

@require_http_methods(["POST"])
@csrf_exempt
def register(request):
    """
    Register a new user.

    Payload:
    {
        "username": "...",
        "password": "...",
        "role": "STUDENT" | "TEACHER" | "OFFICIAL" | "ADMIN"
    }
    """
    body = json.loads(request.body)

    username = body.get("username")
    password = body.get("password")
    role = body.get("role", "STUDENT")

    if not username or not password:
        return JsonResponse(
            {"error": "username and password required"},
            status=400,
        )

    if role not in dict(User.ROLE_CHOICES):
        return JsonResponse(
            {"error": "invalid role"},
            status=400,
        )

    if User.objects.filter(username=username).exists():
        return JsonResponse(
            {"error": "username already exists"},
            status=400,
        )

    user = User.objects.create_user(
        username=username,
        password=password,
    )
    user.role = role
    user.save(update_fields=["role"])

    return JsonResponse({
        "id": user.id,
        "username": user.username,
        "role": user.role,
    })


# --------------------------------------------------
# Login / Logout
# --------------------------------------------------

@require_http_methods(["POST"])
@csrf_exempt
def login_view(request):
    """
    Login endpoint (session-based).
    """
    body = json.loads(request.body)

    user = authenticate(
        username=body.get("username"),
        password=body.get("password"),
    )

    if not user:
        return JsonResponse(
            {"error": "invalid credentials"},
            status=401,
        )

    login(request, user)

    return JsonResponse({
        "id": user.id,
        "username": user.username,
        "role": user.role,
    })


@require_http_methods(["POST"])
@csrf_exempt
def logout_view(request):
    """
    Logout endpoint (session-based).
    """
    logout(request)

    return JsonResponse({"success": True})


# --------------------------------------------------
# Identity
# --------------------------------------------------

@require_http_methods(["GET"])
def me(request):
    """
    Identity endpoint.
    """
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
    })


# --------------------------------------------------
# ADMIN: User Listing (READ-ONLY)
# --------------------------------------------------

@require_http_methods(["GET"])
def users(request):
    """
    Admin-only endpoint.
    Returns all users (read-only).

    Response shape is STABLE.
    """

    if not request.user.is_authenticated or request.user.role != "ADMIN":
        return JsonResponse(
            {"error": "Forbidden"},
            status=403,
        )

    data = list(
        User.objects.all()
        .order_by("id")
        .values(
            "id",
            "username",
            "role",
            "is_active",
        )
    )

    return JsonResponse(data, safe=False)
