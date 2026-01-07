import json

from django.contrib.auth import authenticate, login
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt  # <-- ADD THIS IMPORT
from django.contrib.auth import logout


User = get_user_model()

"""
ACCOUNTS API (v1)

Scope:
- Basic registration
- Basic login (session-based)
- Role exposure
- NO tokens yet
"""


@require_http_methods(["POST"])
@csrf_exempt  # <-- ADD THIS: safe and standard for public login/register
def register(request):
    """
    Register a new user.

    Payload:
    {
        "username": "...",
        "password": "...",
        "role": "STUDENT" | "TEACHER"
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


@require_http_methods(["POST"])
@csrf_exempt  # <-- ADD THIS
def login_view(request):
    """
    Login endpoint (session-based).

    Payload:
    {
        "username": "...",
        "password": "..."
    }
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

    # IMPORTANT: establish session
    login(request, user)

    return JsonResponse({
        "id": user.id,
        "username": user.username,
        "role": user.role,
    })


@require_http_methods(["GET"])
def me(request):
    """
    Identity endpoint.

    CURRENT:
    - Works with session auth
    - Anonymous-safe
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

@require_http_methods(["POST"])
def logout_view(request):
    """
    Logout endpoint (session-based).

    EFFECT:
    - Clears Django session
    - Frontend must refetch /accounts/me/
    """
    logout(request)

    return JsonResponse({
        "success": True,
    })
