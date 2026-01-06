import json

from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

User = get_user_model()

"""
ACCOUNTS API (v1)

Scope:
- Basic registration
- Basic login
- Role exposure
- NO tokens yet
"""


@require_http_methods(["POST"])
def register(request):
    """
    Register a new user.

    Expected payload:
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

    if User.objects.filter(username=username).exists():
        return JsonResponse(
            {"error": "username already exists"},
            status=400,
        )

    user = User.objects.create_user(
        username=username,
        password=password,
        role=role,
    )

    return JsonResponse({
        "id": user.id,
        "username": user.username,
        "role": user.role,
    })


@require_http_methods(["POST"])
def login(request):
    """
    Login endpoint (no tokens yet).

    Expected payload:
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

    return JsonResponse({
        "id": user.id,
        "username": user.username,
        "role": user.role,
    })


@require_http_methods(["GET"])
def me(request):
    """
    Temporary identity endpoint.

    NOTE:
    - Until auth is wired, this returns a stub
    - Later replaced with real request.user
    """

    return JsonResponse({
        "authenticated": False,
        "role": "STUDENT",
    })
