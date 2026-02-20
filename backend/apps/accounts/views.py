import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt

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
    institution_id = body.get("institution_id")
    section_id = body.get("section_id")

    if not username or not password:
        return JsonResponse({"error": "username and password required"}, status=400)

    if role not in dict(User.ROLE_CHOICES):
        return JsonResponse({"error": "invalid role"}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "username already exists"}, status=400)

    institution = None
    if institution_id:
        try:
            institution = Institution.objects.get(id=institution_id)
        except Institution.DoesNotExist:
            return JsonResponse({"error": "invalid institution"}, status=400)

    section = None
    if section_id:
        try:
            section = Section.objects.get(id=section_id)
        except Section.DoesNotExist:
            return JsonResponse({"error": "invalid section"}, status=400)

    user = User.objects.create_user(
        username=username,
        password=password,
    )

    user.role = role
    user.institution = institution
    user.section = section
    user.save()

    return JsonResponse({
        "id": user.id,
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