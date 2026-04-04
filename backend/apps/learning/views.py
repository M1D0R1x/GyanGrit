import json
import logging

from apps.accesscontrol.permissions import require_auth  # returns 401 JSON, not 302
from django.db.models import Prefetch
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from apps.academics.models import StudentSubject
from apps.content.models import Course
from apps.content.models import LessonProgress
from .models import Enrollment, LearningPath, LearningPathCourse

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# ACCESS CONTROL HELPER
# -------------------------------------------------------

def can_access_course(user, course):
    """
    Determines if a user is permitted to enroll in a course.

    Rules:
    - ADMIN: always
    - STUDENT: must have a StudentSubject record for the course's subject
    - TEACHER: must have a TeachingAssignment for the course's subject
    - PRINCIPAL / OFFICIAL: cannot self-enroll (they use dashboards)
    """
    if not user.is_authenticated:
        return False

    if user.is_superuser or user.role == "ADMIN":
        return True

    if user.role == "STUDENT":
        return StudentSubject.objects.filter(
            student=user,
            subject=course.subject,
        ).exists()

    if user.role == "TEACHER":
        return user.teaching_assignments.filter(
            subject=course.subject,
        ).exists()

    # PRINCIPAL and OFFICIAL do not self-enroll
    return False


# -------------------------------------------------------
# USER ENROLLMENTS
# -------------------------------------------------------

@require_auth
@require_http_methods(["GET"])
def enrollments(request):
    include_dropped = request.GET.get("include_dropped") == "true"

    status_filter = ["enrolled", "completed"]
    if include_dropped:
        status_filter.append("dropped")

    qs = (
        Enrollment.objects
        .filter(user=request.user, status__in=status_filter)
        .select_related("course")
        .order_by("-enrolled_at")
    )

    data = list(
        qs.values(
            "id",
            "course__id",
            "course__title",
            "status",
            "enrolled_at",
            "completed_at",
        )
    )
    return JsonResponse(data, safe=False)


# -------------------------------------------------------
# ENROLL IN COURSE
# -------------------------------------------------------

@require_auth
@require_http_methods(["POST"])
def enroll_course(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    course_id = body.get("course_id")

    if not course_id:
        return JsonResponse({"error": "course_id required"}, status=400)

    course = get_object_or_404(Course, id=course_id)

    if not can_access_course(request.user, course):
        return JsonResponse(
            {"error": "You are not permitted to enroll in this course"},
            status=403,
        )

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
# UPDATE ENROLLMENT STATUS
# -------------------------------------------------------

@require_auth
@require_http_methods(["PATCH"])
def update_enrollment(request, enrollment_id):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    enrollment = get_object_or_404(
        Enrollment,
        id=enrollment_id,
        user=request.user,
    )

    status = body.get("status")

    if status not in ["completed", "dropped"]:
        return JsonResponse({"error": "Invalid status. Must be 'completed' or 'dropped'."}, status=400)

    if status == "completed":
        enrollment.mark_completed()
    else:
        enrollment.mark_dropped()

    return JsonResponse({
        "enrollment_id": enrollment.id,
        "status": enrollment.status,
        "completed_at": (
            enrollment.completed_at.isoformat()
            if enrollment.completed_at else None
        ),
    })


# -------------------------------------------------------
# LEARNING PATHS
# -------------------------------------------------------

@require_auth
@require_http_methods(["GET"])
def learning_paths(request):
    paths = LearningPath.objects.all().order_by("name")
    data = list(paths.values("id", "name", "description"))
    return JsonResponse(data, safe=False)


@require_auth
@require_http_methods(["GET"])
def learning_path_detail(request, path_id):
    path = get_object_or_404(LearningPath, id=path_id)

    courses = (
        LearningPathCourse.objects
        .filter(learning_path=path)
        .select_related("course", "course__subject")
        .order_by("order")
    )

    return JsonResponse({
        "id": path.id,
        "name": path.name,
        "description": path.description,
        "courses": [
            {
                "course_id": c.course.id,
                "title": c.course.title,
                "grade": c.course.grade,
                "subject": c.course.subject.name,
                "order": c.order,
            }
            for c in courses
        ],
    })


@require_auth
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


@require_auth
@require_http_methods(["POST"])
def enroll_learning_path(request, path_id):
    from django.db.models import Q
    path = get_object_or_404(LearningPath, id=path_id)

    path_courses = list(
        LearningPathCourse.objects
        .filter(learning_path=path)
        .select_related("course", "course__subject")
    )
    total_courses = len(path_courses)

    user = request.user
    course_list = [item.course for item in path_courses]

    # Determine accessible courses in 1 query per role instead of 1 per course
    if user.is_superuser or user.role == "ADMIN":
        accessible_ids = {c.id for c in course_list}
    elif user.role == "STUDENT":
        enrolled_subject_ids = set(
            StudentSubject.objects
            .filter(student=user)
            .values_list("subject_id", flat=True)
        )
        accessible_ids = {c.id for c in course_list if c.subject_id in enrolled_subject_ids}
    elif user.role == "TEACHER":
        teaching_subject_ids = set(
            user.teaching_assignments.values_list("subject_id", flat=True)
        )
        accessible_ids = {c.id for c in course_list if c.subject_id in teaching_subject_ids}
    else:
        accessible_ids = set()  # PRINCIPAL / OFFICIAL cannot self-enroll

    # Bulk-create missing enrollments — ignore existing rows
    accessible_courses = [c for c in course_list if c.id in accessible_ids]
    existing_ids = set(
        Enrollment.objects
        .filter(user=user, course_id__in=accessible_ids)
        .values_list("course_id", flat=True)
    )
    new_enrollments = [
        Enrollment(user=user, course=c, status="enrolled")
        for c in accessible_courses
        if c.id not in existing_ids
    ]
    if new_enrollments:
        Enrollment.objects.bulk_create(new_enrollments, ignore_conflicts=True)
    enrolled_count = len(new_enrollments)

    return JsonResponse({
        "path_id":         path.id,
        "enrolled_courses": enrolled_count,
        "total_courses":   total_courses,
    })


# -------------------------------------------------------
# STUDENT DASHBOARD
#
# Optimised with Prefetch to avoid loading all users'
# progress records. Only the current user's LessonProgress
# records are fetched — not everyone's.
# -------------------------------------------------------

@require_auth
@require_http_methods(["GET"])
def student_dashboard(request):
    if request.user.role not in ["STUDENT", "ADMIN"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    # Prefetch only this user's progress records — not all users'
    user_progress_prefetch = Prefetch(
        "lessons__progress_records",
        queryset=LessonProgress.objects.filter(user=request.user),
        to_attr="user_progress",
    )

    enrollments_qs = (
        Enrollment.objects
        .filter(
            user=request.user,
            status__in=["enrolled", "completed"],
        )
        .select_related("course", "course__subject")
        .prefetch_related(
            Prefetch(
                "course__lessons",
                queryset=__import__(
                    "apps.content.models",
                    fromlist=["Lesson"]
                ).Lesson.objects.filter(is_published=True).prefetch_related(
                    user_progress_prefetch
                ),
                to_attr="published_lessons",
            )
        )
    )

    courses_data = []

    for enrollment in enrollments_qs:
        course = enrollment.course
        lessons = course.published_lessons  # from prefetch
        total = len(lessons)

        completed = sum(
            1 for lesson in lessons
            if lesson.user_progress and lesson.user_progress[0].completed
        )

        percentage = int((completed / total) * 100) if total else 0

        courses_data.append({
            "id": course.id,
            "title": course.title,
            "subject": course.subject.name,
            "grade": course.grade,
            "status": enrollment.status,
            "total_lessons": total,
            "completed_lessons": completed,
            "progress": percentage,
        })

    return JsonResponse({"courses": courses_data})