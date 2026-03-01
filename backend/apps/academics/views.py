from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required

from .models import (
    Institution,
    ClassRoom,
    Section,
    Subject,
    TeachingAssignment,
)


# =========================================================
# INSTITUTIONS
# =========================================================

@login_required
@require_http_methods(["GET"])
def institutions(request):
    if request.user.role not in ["ADMIN", "OFFICIAL", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    queryset = Institution.objects.all()

    if request.user.role == "OFFICIAL":
        queryset = queryset.filter(district=request.user.district)

    if request.user.role == "PRINCIPAL":
        queryset = queryset.filter(id=request.user.institution_id)

    data = list(
        queryset.values("id", "name", "district")
    )

    return JsonResponse(data, safe=False)


# =========================================================
# CLASSES
# =========================================================

@login_required
@require_http_methods(["GET"])
def classes(request):
    if not request.user.institution:
        return JsonResponse({"detail": "No institution assigned"}, status=400)

    queryset = ClassRoom.objects.filter(
        institution=request.user.institution
    )

    return JsonResponse(
        list(queryset.values("id", "name")),
        safe=False
    )


# =========================================================
# SECTIONS
# =========================================================

@login_required
@require_http_methods(["GET"])
def sections(request):
    classroom_id = request.GET.get("classroom_id")

    queryset = Section.objects.all()

    if classroom_id:
        queryset = queryset.filter(classroom_id=classroom_id)

    if request.user.role in ["PRINCIPAL", "TEACHER", "STUDENT"]:
        queryset = queryset.filter(
            classroom__institution=request.user.institution
        )

    return JsonResponse(
        list(queryset.values("id", "name", "classroom_id")),
        safe=False
    )


# =========================================================
# SUBJECTS
# =========================================================

@login_required
@require_http_methods(["GET"])
def subjects(request):
    queryset = Subject.objects.all()

    if request.user.role == "PRINCIPAL":
        queryset = queryset.filter(institution=request.user.institution)

    if request.user.role == "OFFICIAL":
        queryset = queryset.filter(
            institution__district=request.user.district
        )

    if request.user.role == "TEACHER":
        queryset = queryset.filter(
            teaching_assignments__teacher=request.user
        ).distinct()

    if request.user.role == "STUDENT":
        queryset = queryset.filter(
            institution=request.user.institution
        )

    return JsonResponse(
        list(queryset.values("id", "name", "institution_id")),
        safe=False
    )


# =========================================================
# TEACHING ASSIGNMENTS
# =========================================================

@login_required
@require_http_methods(["GET"])
def my_assignments(request):
    if request.user.role != "TEACHER":
        return JsonResponse({"detail": "Forbidden"}, status=403)

    assignments = TeachingAssignment.objects.filter(
        teacher=request.user
    ).select_related("subject", "section")

    data = []

    for a in assignments:
        data.append({
            "subject_id": a.subject.id,
            "subject_name": a.subject.name,
            "section_id": a.section.id,
            "section_name": a.section.name,
            "class_name": a.section.classroom.name,
        })

    return JsonResponse(data, safe=False)