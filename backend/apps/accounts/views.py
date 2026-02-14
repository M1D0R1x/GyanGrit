import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt

from .models import Institution

User = get_user_model()


@require_http_methods(["POST"])
@csrf_exempt
def register(request):
    """
    Register a new user.

    Payload:
    {
        "username": "...",
        "password": "...",
        "role": "STUDENT" | "TEACHER",
        "institution_id": 1
    }
    """

    body = json.loads(request.body)

    username = body.get("username")
    password = body.get("password")
    role = body.get("role", "STUDENT")
    institution_id = body.get("institution_id")

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

    institution = None
    if institution_id:
        try:
            institution = Institution.objects.get(id=institution_id)
        except Institution.DoesNotExist:
            return JsonResponse(
                {"error": "invalid institution"},
                status=400,
            )

    user = User.objects.create_user(
        username=username,
        password=password,
    )

    user.role = role
    user.institution = institution
    user.save(update_fields=["role", "institution"])

    return JsonResponse({
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "institution": user.institution.name if user.institution else None,
    })


@require_http_methods(["POST"])
@csrf_exempt
def login_view(request):
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
        "institution": user.institution.name if user.institution else None,
    })


@require_http_methods(["POST"])
@csrf_exempt
def logout_view(request):
    logout(request)
    return JsonResponse({"success": True})


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
        if request.user.institution
        else None,
    })


@require_http_methods(["GET"])
def users(request):
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
            "institution__name",
            "is_active",
        )
    )

    return JsonResponse(data, safe=False)
