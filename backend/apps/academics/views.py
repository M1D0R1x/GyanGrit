import logging
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from apps.accesscontrol.permissions import require_auth  # returns 401 JSON, not 302
from django.db.models import Count, Q

from .models import (
    Institution,
    ClassRoom,
    Section,
    Subject,
    TeachingAssignment,
    District,
    StudentSubject,
)
from ..content.models import Lesson, LessonProgress, Course

logger = logging.getLogger(__name__)


# =========================================================
# INSTITUTIONS
# =========================================================

@require_auth
@require_http_methods(["GET"])
def institutions(request):
    if request.user.role not in ["ADMIN", "OFFICIAL", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    queryset = Institution.objects.select_related("district").order_by("name")

    if request.user.role == "OFFICIAL":
        if not request.user.district:
            return JsonResponse({"detail": "No district assigned"}, status=400)
        queryset = queryset.filter(district__name=request.user.district)

    elif request.user.role == "PRINCIPAL":
        if not request.user.institution:
            return JsonResponse({"detail": "No institution assigned"}, status=400)
        queryset = queryset.filter(id=request.user.institution.id)

    return JsonResponse(
        list(queryset.values("id", "name", "district__name")),
        safe=False
    )


# =========================================================
# CLASSES
# =========================================================

@require_auth
@require_http_methods(["GET"])
def classes(request):
    queryset = ClassRoom.objects.select_related("institution")

    if request.user.role in ["PRINCIPAL", "TEACHER", "STUDENT"]:
        if not request.user.institution:
            return JsonResponse({"detail": "No institution assigned"}, status=400)
        queryset = queryset.filter(institution=request.user.institution)

    elif request.user.role == "OFFICIAL":
        if not request.user.district:
            return JsonResponse({"detail": "No district assigned"}, status=400)
        queryset = queryset.filter(institution__district__name=request.user.district)

    return JsonResponse(
        list(queryset.values("id", "name", "institution_id")),
        safe=False
    )


# =========================================================
# SECTIONS
# =========================================================

@require_auth
@require_http_methods(["GET"])
def sections(request):
    """
    Returns sections with full label: classroom grade + institution name.
    This fixes the 'A, A, A, A' problem — each section now has a unique
    human-readable label like 'Class 8-A — Govt School Amritsar'.

    Sorted by: institution name (A-Z), then grade (6→10), then section name (A→Z).
    Filtered by institution scope based on role.

    Accepts optional ?classroom__institution_id= for frontend-side filtering.
    """
    institution_id_filter = request.GET.get("classroom__institution_id")

    queryset = Section.objects.select_related(
        "classroom",
        "classroom__institution",
        "classroom__institution__district",
    )

    # Optional institution filter (used by join code form)
    if institution_id_filter:
        queryset = queryset.filter(classroom__institution_id=institution_id_filter)

    # Role-based scoping
    if request.user.role in ["PRINCIPAL", "TEACHER", "STUDENT"]:
        if request.user.institution:
            queryset = queryset.filter(classroom__institution=request.user.institution)

    elif request.user.role == "OFFICIAL":
        if request.user.district:
            queryset = queryset.filter(
                classroom__institution__district__name=request.user.district
            )

    # Sort: institution name A-Z, then grade numerically, then section name A-Z
    queryset = queryset.order_by(
        "classroom__institution__name",
        "classroom__name",
        "name",
    )

    data = [
        {
            "id": s.id,
            "name": s.name,
            "classroom_id": s.classroom_id,
            "grade": s.classroom.name,
            "institution_id": s.classroom.institution_id,
            "institution_name": s.classroom.institution.name,
            "label": f"Class {s.classroom.name}-{s.name} — {s.classroom.institution.name}",
            "short_label": f"Class {s.classroom.name}-{s.name}",
        }
        for s in queryset
    ]

    return JsonResponse(data, safe=False)


# =========================================================
# SUBJECTS
# =========================================================

@require_auth
@require_http_methods(["GET"])
def subjects(request):

    if request.user.role == "STUDENT":
        return _subjects_for_student(request)

    elif request.user.role == "TEACHER":
        queryset = Subject.objects.filter(
            teaching_assignments__teacher=request.user
        ).distinct()
        return JsonResponse(list(queryset.values("id", "name")), safe=False)

    elif request.user.role == "PRINCIPAL":
        if not request.user.institution:
            return JsonResponse({"detail": "No institution assigned"}, status=400)
        queryset = Subject.objects.filter(
            classrooms__classroom__institution=request.user.institution
        ).distinct()
        return JsonResponse(list(queryset.values("id", "name")), safe=False)

    elif request.user.role == "OFFICIAL":
        if not request.user.district:
            return JsonResponse({"detail": "No district assigned"}, status=400)
        queryset = Subject.objects.filter(
            classrooms__classroom__institution__district__name=request.user.district
        ).distinct()
        return JsonResponse(list(queryset.values("id", "name")), safe=False)

    elif request.user.role == "ADMIN":
        queryset = Subject.objects.all()
        return JsonResponse(list(queryset.values("id", "name")), safe=False)

    return JsonResponse({"detail": "Forbidden"}, status=403)


def _subjects_for_student(request):
    """
    Optimised subject+progress query for a student.
    Avoids N+1 by computing progress in a single annotated queryset
    per subject, then assembling the response.

    Response includes `course_id` (primary course for this subject+grade) so
    the frontend can call GET /courses/:id/progress/ to fetch resume_lesson_id
    without needing a separate subject→course resolution endpoint.
    """
    student = request.user

    student_subjects = (
        StudentSubject.objects
        .select_related("subject", "classroom")
        .filter(student=student)
        .order_by("subject__id")
    )

    if not student_subjects.exists():
        return JsonResponse([], safe=False)

    data = []

    for ss in student_subjects:
        subject = ss.subject
        classroom = ss.classroom

        # Safely parse grade — guard against non-numeric classroom names
        try:
            grade = int(classroom.name.strip())
        except (ValueError, AttributeError):
            logger.warning(
                "Student %s has classroom with non-numeric name: %s",
                student.id,
                classroom.name,
            )
            grade = None

        if grade is None:
            data.append({
                "id": subject.id,
                "name": subject.name,
                "total_lessons": 0,
                "completed_lessons": 0,
                "progress": 0,
                "course_id": None,
            })
            continue

        # Single query: get all course IDs for this subject+grade
        course_ids = list(
            Course.objects
            .filter(subject=subject, grade=grade)
            .values_list("id", flat=True)
        )

        if not course_ids:
            data.append({
                "id": subject.id,
                "name": subject.name,
                "total_lessons": 0,
                "completed_lessons": 0,
                "progress": 0,
                "course_id": None,
            })
            continue

        # Two targeted aggregate queries instead of per-lesson loops
        total_lessons = Lesson.objects.filter(
            course_id__in=course_ids,
            is_published=True
        ).count()

        completed_lessons = LessonProgress.objects.filter(
            lesson__course_id__in=course_ids,
            user=student,
            completed=True
        ).count()

        progress = (
            int((completed_lessons / total_lessons) * 100)
            if total_lessons else 0
        )

        data.append({
            "id": subject.id,
            "name": subject.name,
            "total_lessons": total_lessons,
            "completed_lessons": completed_lessons,
            "progress": progress,
            # Primary course for this subject+grade.
            # Used by DashboardPage to fetch resume_lesson_id via
            # GET /courses/:id/progress/ without a round-trip to resolve the slug.
            "course_id": course_ids[0],
        })

    return JsonResponse(data, safe=False)


# =========================================================
# TEACHING ASSIGNMENTS
# =========================================================

@require_auth
@require_http_methods(["GET"])
def teaching_assignments(request):
    if request.user.role not in ["ADMIN", "OFFICIAL", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    queryset = TeachingAssignment.objects.select_related(
        "teacher",
        "subject",
        "section",
        "section__classroom",
        "section__classroom__institution",
    )

    if request.user.role == "PRINCIPAL":
        if not request.user.institution:
            return JsonResponse({"detail": "No institution assigned"}, status=400)
        queryset = queryset.filter(
            section__classroom__institution=request.user.institution
        )

    elif request.user.role == "OFFICIAL":
        if not request.user.district:
            return JsonResponse({"detail": "No district assigned"}, status=400)
        queryset = queryset.filter(
            section__classroom__institution__district__name=request.user.district
        )

    data = [
        {
            "id": a.id,
            "teacher_id": a.teacher.id,
            "teacher_username": a.teacher.username,
            "subject_id": a.subject.id,
            "subject_name": a.subject.name,
            "section_id": a.section.id,
            "section_name": a.section.name,
            "class_name": a.section.classroom.name,
        }
        for a in queryset
    ]

    return JsonResponse(data, safe=False)


# =========================================================
# MY ASSIGNMENTS (TEACHER ONLY)
# =========================================================

@require_auth
@require_http_methods(["GET"])
def my_assignments(request):
    """
    GET /api/v1/academics/my-assignments/

    Returns teaching assignments for the current user.
    TEACHER: their own TeachingAssignment records.
    PRINCIPAL: all assignments in their institution.
    ADMIN: all assignments.
    """
    user = request.user
    if user.role not in ("TEACHER", "PRINCIPAL", "ADMIN"):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    if user.role == "ADMIN" or user.is_superuser:
        qs = TeachingAssignment.objects.all()
    elif user.role == "PRINCIPAL":
        if not user.institution:
            return JsonResponse([], safe=False)
        qs = TeachingAssignment.objects.filter(
            section__classroom__institution=user.institution
        )
    else:
        qs = TeachingAssignment.objects.filter(teacher=user)

    assignments = qs.select_related(
        "subject",
        "section",
        "section__classroom",
        "section__classroom__institution",
    )

    data = [
        {
            "subject_id": a.subject.id,
            "subject_name": a.subject.name,
            "section_id": a.section.id,
            "section_name": a.section.name,
            "class_name": a.section.classroom.name,
        }
        for a in assignments
    ]

    return JsonResponse(data, safe=False)


# =========================================================
# PUBLIC HELPERS (used during registration — no login required)
# =========================================================

@require_http_methods(["GET"])
def districts(request):
    query = request.GET.get("q", "")
    qs = District.objects.filter(name__icontains=query).order_by("name")
    return JsonResponse(list(qs.values("id", "name")), safe=False)


@require_http_methods(["GET"])
def schools(request):
    district_id = request.GET.get("district_id")
    query = request.GET.get("q", "")

    qs = Institution.objects.select_related("district")

    if district_id:
        qs = qs.filter(district_id=district_id)
    if query:
        qs = qs.filter(name__icontains=query)

    data = list(
        qs.values("id", "name", "district__name", "is_government").order_by("name")
    )

    return JsonResponse(data, safe=False)
