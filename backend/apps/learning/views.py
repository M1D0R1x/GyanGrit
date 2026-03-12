import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from apps.academics.models import StudentSubject
from apps.content.models import Course
from .models import Enrollment, LearningPath, LearningPathCourse


# -------------------------------------------------------
# ACCESS CONTROL HELPER
# -------------------------------------------------------

def can_access_course(user, course):
    """Student can only enroll/access courses they are supposed to study."""
    if user.role == "ADMIN":
        return True

    if user.role == "STUDENT":
        return StudentSubject.objects.filter(
            student=user,
            subject=course.subject
        ).exists()

    # Teachers/Principals/Officials can enroll in anything (for testing/demo)
    return user.role in ["TEACHER", "PRINCIPAL", "OFFICIAL"]


# -------------------------------------------------------
# USER ENROLLMENTS
# -------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def enrollments(request):
    enrollments = Enrollment.objects.filter(
        user=request.user,
        status__in=["enrolled", "completed"],
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


# -------------------------------------------------------
# ENROLL IN COURSE
# -------------------------------------------------------

@login_required
@require_http_methods(["POST"])
def enroll_course(request):
    body = json.loads(request.body or "{}")
    course_id = body.get("course_id")

    if not course_id:
        return JsonResponse({"error": "course_id required"}, status=400)

    course = get_object_or_404(Course, id=course_id)

    if not can_access_course(request.user, course):
        return JsonResponse({"error": "You are not allowed to enroll in this course"}, status=403)

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


# -------------------------------------------------------
# UPDATE ENROLLMENT
# -------------------------------------------------------

@login_required
@require_http_methods(["PATCH"])
def update_enrollment(request, enrollment_id):
    enrollment = get_object_or_404(
        Enrollment,
        id=enrollment_id,
        user=request.user,
    )

    body = json.loads(request.body or "{}")
    status = body.get("status")

    if status not in ["completed", "dropped"]:
        return JsonResponse({"error": "Invalid status"}, status=400)

    if status == "completed":
        enrollment.mark_completed()
    else:
        enrollment.mark_dropped()

    return JsonResponse({
        "enrollment_id": enrollment.id,
        "status": enrollment.status,
        "completed_at": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
    })


# -------------------------------------------------------
# LEARNING PATHS
# -------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def learning_paths(request):
    paths = LearningPath.objects.all().order_by("name")

    data = list(
        paths.values("id", "name", "description")
    )
    return JsonResponse(data, safe=False)


@login_required
@require_http_methods(["GET"])
def learning_path_detail(request, path_id):
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
    path = get_object_or_404(LearningPath, id=path_id)

    courses = LearningPathCourse.objects.filter(
        learning_path=path
    ).select_related("course")

    enrolled_count = 0

    for item in courses:
        if can_access_course(request.user, item.course):
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


# -------------------------------------------------------
# STUDENT DASHBOARD — OPTIMIZED (NO MORE N+1)
# -------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def student_dashboard(request):
    if request.user.role not in ["STUDENT", "ADMIN"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    # Single optimized query with prefetch
    enrollments = Enrollment.objects.filter(
        user=request.user,
        status__in=["enrolled", "completed"],
    ).select_related("course").prefetch_related(
        "course__lessons",                    # prefetch all lessons
        "course__lessons__progress_records"   # prefetch progress
    )

    courses_data = []

    for e in enrollments:
        course = e.course
        lessons = course.lessons.filter(is_published=True)
        total = lessons.count()

        # Count completed in one go from prefetched data
        completed = sum(
            1 for lesson in lessons
            if any(p.completed for p in lesson.progress_records.all() if p.user_id == request.user.id)
        )

        percentage = int((completed / total) * 100) if total else 0

        courses_data.append({
            "id": course.id,
            "title": course.title,
            "total_lessons": total,
            "completed_lessons": completed,
            "progress": percentage,
        })

    return JsonResponse({"courses": courses_data})