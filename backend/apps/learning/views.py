import json
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from django.utils import timezone

from apps.content.models import Course
from .models import Enrollment

"""
LEARNING APP API

Principles:
- Versioned under /api/v1/learning/
- No auth yet (user=None)
- Stable response shapes (won’t break when auth is added)
"""


@require_http_methods(["GET"])
def enrollments(request):
    """
    List all enrollments for the current (anonymous) learner.
    """
    data = list(
        Enrollment.objects.filter(user=None)
        .select_related("course")
        .values(
            "id",
            "course__id",
            "course__title",
            "status",
            "started_at",
            "completed_at",
        )
    )

    return JsonResponse(data, safe=False)


@require_http_methods(["POST"])
def enroll_course(request):
    """
    Enroll into a course.
    Idempotent: enrolling twice does not duplicate data.
    """
    body = json.loads(request.body)
    course_id = body.get("course_id")

    if not course_id:
        return JsonResponse(
            {"error": "course_id is required"},
            status=400,
        )

    course = get_object_or_404(Course, id=course_id)

    enrollment, _ = Enrollment.objects.get_or_create(
        course=course,
        user=None,
    )

    return JsonResponse({
        "enrollment_id": enrollment.id,
        "course_id": course.id,
        "status": enrollment.status,
    })


@require_http_methods(["PATCH"])
def update_enrollment(request, enrollment_id):
    """
    Update enrollment status.
    Allowed transitions:
    - ENROLLED → COMPLETED
    - ENROLLED → DROPPED
    """
    enrollment = get_object_or_404(
        Enrollment,
        id=enrollment_id,
        user=None,
    )

    body = json.loads(request.body)
    status = body.get("status")

    if status == "COMPLETED":
        enrollment.status = "COMPLETED"
        enrollment.completed_at = timezone.now()

    elif status == "DROPPED":
        enrollment.status = "DROPPED"

    else:
        return JsonResponse(
            {"error": "Invalid status"},
            status=400,
        )

    enrollment.save()

    return JsonResponse({
        "id": enrollment.id,
        "status": enrollment.status,
    })
