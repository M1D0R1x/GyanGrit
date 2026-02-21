import json

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.contrib.auth.decorators import login_required

from .models import Enrollment, LearningPath, LearningPathCourse
from apps.content.models import Course


@login_required
@require_http_methods(["GET"])
def enrollments(request):
    """
    List current user's active enrollments.
    """
    enrollments = Enrollment.objects.filter(
        user=request.user,
        status__in=["enrolled", "completed"]
    ).select_related("course")

    data = list(
        enrollments.values(
            "id",
            "course__id",
            "course__title",
            "status",
            "enrolled_at",
            "completed_at",
        ).order_by("-enrolled_at")
    )

    return JsonResponse(data, safe=False)


@login_required
@require_http_methods(["POST"])
def enroll_course(request):
    """
    Enroll in a course (idempotent).
    """
    body = json.loads(request.body)
    course_id = body.get("course_id")

    if not course_id:
        return JsonResponse({"error": "course_id required"}, status=400)

    course = get_object_or_404(Course, id=course_id)

    # Optional: check if user has access (expand later)
    # if request.user.role == "STUDENT" and not course.is_accessible_to(request.user):
    #     return JsonResponse({"error": "Not authorized"}, status=403)

    enrollment, created = Enrollment.objects.get_or_create(
        user=request.user,
        course=course,
        defaults={"status": "enrolled"},
    )

    return JsonResponse({
        "enrollment_id": enrollment.id,
        "course_id": course.id,
        "status": enrollment.status,
        "created": created,
    })


@login_required
@require_http_methods(["PATCH"])
def update_enrollment(request, enrollment_id):
    """
    Update enrollment status (e.g. mark completed/dropped).
    """
    enrollment = get_object_or_404(
        Enrollment,
        id=enrollment_id,
        user=request.user,
    )

    body = json.loads(request.body)
    status = body.get("status")

    if status not in ["completed", "dropped"]:
        return JsonResponse({"error": "Invalid status"}, status=400)

    if status == "completed":
        enrollment.mark_completed()
    elif status == "dropped":
        enrollment.mark_dropped()

    return JsonResponse({
        "enrollment_id": enrollment.id,
        "status": enrollment.status,
        "completed_at": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
    })


@login_required
@require_http_methods(["GET"])
def learning_paths(request):
    """
    List all learning paths.
    """
    paths = LearningPath.objects.all()

    data = list(
        paths.values(
            "id",
            "name",
            "description",
        ).order_by("name")
    )

    return JsonResponse(data, safe=False)


@login_required
@require_http_methods(["GET"])
def learning_path_detail(request, path_id):
    """
    Get learning path with ordered courses.
    """
    path = get_object_or_404(LearningPath, id=path_id)

    courses = (
        LearningPathCourse.objects
        .filter(learning_path=path)
        .select_related("course")
        .order_by("order")
    )

    data = {
        "id": path.id,
        "name": path.name,
        "description": path.description,
        "courses": [
            {
                "course_id": c.course.id,
                "title": c.course.title,
                "order": c.order,
            }
            for c in courses
        ],
    }

    return JsonResponse(data)


@login_required
@require_http_methods(["GET"])
def learning_path_progress(request, path_id):
    """
    Derived progress for a learning path.
    """
    path = get_object_or_404(LearningPath, id=path_id)

    course_ids = list(
        LearningPathCourse.objects
        .filter(learning_path=path)
        .values_list("course_id", flat=True)
    )

    total = len(course_ids)

    completed = Enrollment.objects.filter(
        user=request.user,
        course_id__in=course_ids,
        status="completed",
    ).count()

    percentage = int((completed / total) * 100) if total else 0

    return JsonResponse({
        "path_id": path.id,
        "total_courses": total,
        "completed_courses": completed,
        "percentage": percentage,
    })


@login_required
@require_http_methods(["POST"])
def enroll_learning_path(request, path_id):
    """
    Enroll in ALL courses of a learning path (idempotent).
    """
    path = get_object_or_404(LearningPath, id=path_id)

    courses = LearningPathCourse.objects.filter(
        learning_path=path
    ).select_related("course")

    enrolled_count = 0

    for item in courses:
        _, created = Enrollment.objects.get_or_create(
            user=request.user,
            course=item.course,
            defaults={"status": "enrolled"},
        )
        if created:
            enrolled_count += 1

    return JsonResponse({
        "path_id": path.id,
        "enrolled_courses": enrolled_count,
        "total_courses": courses.count(),
    })