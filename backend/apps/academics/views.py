from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404

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
        queryset = queryset.filter(district__name=request.user.district)

    if request.user.role == "PRINCIPAL":
        queryset = queryset.filter(district__name=request.user.district)

    return JsonResponse(
        list(queryset.values("id", "name", "district")),
        safe=False
    )


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
        list(queryset.values("id", "name", "institution_id")),
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

    if request.user.role == "OFFICIAL":
        queryset = queryset.filter(
            classroom__institution__district=request.user.district
        )

    return JsonResponse(
        list(queryset.values("id", "name", "classroom_id")),
        safe=False
    )


@login_required
@require_http_methods(["GET"])
def subjects(request):

    # STUDENT → subjects assigned to their class
    if request.user.role == "STUDENT":
        if not request.user.section:
            return JsonResponse([], safe=False)

        classroom = request.user.section.classroom

        queryset = Subject.objects.filter(
            classrooms__classroom=classroom
        ).distinct()

    # TEACHER → subjects they teach
    elif request.user.role == "TEACHER":
        queryset = Subject.objects.filter(
            teaching_assignments__teacher=request.user
        ).distinct()

    # PRINCIPAL / OFFICIAL / ADMIN → all subjects
    else:
        queryset = Subject.objects.all()

    return JsonResponse(
        list(queryset.values("id", "name")),
        safe=False
    )



# =========================================================
# TEACHING ASSIGNMENTS (ADMIN / OFFICIAL / PRINCIPAL)
# =========================================================

@login_required
@require_http_methods(["GET"])
def teaching_assignments(request):
    if request.user.role not in ["ADMIN", "OFFICIAL", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    queryset = TeachingAssignment.objects.select_related(
        "teacher",
        "subject",
        "section",
        "section__classroom",
    )

    if request.user.role == "PRINCIPAL":
        queryset = queryset.filter(
            section__classroom__institution=request.user.institution
        )

    elif request.user.role == "OFFICIAL":
        queryset = queryset.filter(
            section__classroom__institution__district=request.user.district
        )

    data = []

    for a in queryset:
        data.append({
            "id": a.id,
            "teacher_id": a.teacher.id,
            "teacher_username": a.teacher.username,
            "subject_id": a.subject.id,
            "subject_name": a.subject.name,
            "section_id": a.section.id,
            "section_name": a.section.name,
            "class_name": a.section.classroom.name,
        })

    return JsonResponse(data, safe=False)


# =========================================================
# MY ASSIGNMENTS (TEACHER ONLY)
# =========================================================

@login_required
@require_http_methods(["GET"])
def my_assignments(request):
    if request.user.role != "TEACHER":
        return JsonResponse({"detail": "Forbidden"}, status=403)

    assignments = TeachingAssignment.objects.filter(
        teacher=request.user
    ).select_related("subject", "section", "section__classroom")

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

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.db.models import Q
from .models import District, Institution


@require_http_methods(["GET"])
def districts(request):
    query = request.GET.get("q", "")

    districts = District.objects.filter(
        name__icontains=query
    ).order_by("name")

    data = list(districts.values("id", "name"))
    return JsonResponse(data, safe=False)


@require_http_methods(["GET"])
def schools(request):
    district_id = request.GET.get("district_id")
    query = request.GET.get("q", "")

    schools = Institution.objects.all()

    if district_id:
        schools = schools.filter(district_id=district_id)

    if query:
        schools = schools.filter(name__icontains=query)

    data = list(
        schools.values(
            "id",
            "name",
            "district__name",
            "is_government",
        ).order_by("name")
    )

    return JsonResponse(data, safe=False)