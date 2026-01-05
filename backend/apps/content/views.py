import json
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.db.models import Avg

from apps.content.models import Course, Lesson, LessonProgress
from apps.learning.models import Enrollment

"""
CONTENT APP API

Principles:
- Versioned under /api/v1/
- Exactly ONE LessonProgress per (lesson, user)
- Learning actions REQUIRE enrollment
- user=None for now (auth will replace this)
"""


def health(request):
    return JsonResponse({
        "status": "ok",
        "service": "gyangrit-backend",
    })


def courses(request):
    """
    Public: list all courses.
    """
    data = list(
        Course.objects.all().values(
            "id", "title", "description"
        )
    )
    return JsonResponse(data, safe=False)


def course_lessons(request, course_id):
    """
    List lessons for a course.
    Viewing lesson list does NOT require enrollment.
    """
    course = get_object_or_404(Course, id=course_id)

    lessons_data = []
    for lesson in course.lessons.all():
        completed = LessonProgress.objects.filter(
            lesson=lesson,
            user=None,
            completed=True,
        ).exists()

        lessons_data.append({
            "id": lesson.id,
            "title": lesson.title,
            "order": lesson.order,
            "completed": completed,
        })

    return JsonResponse(lessons_data, safe=False)


def _require_enrollment(course):
    """
    Internal guard: checks enrollment for current learner.
    """
    enrolled = Enrollment.objects.filter(
        course=course,
        user=None,
        status="ENROLLED",
    ).exists()

    if not enrolled:
        return JsonResponse(
            {"error": "Not enrolled in this course"},
            status=403,
        )

    return None


def lesson_detail(request, lesson_id):
    """
    View lesson content.
    Requires enrollment.
    Updates last_opened_at for resume logic.
    """
    lesson = get_object_or_404(Lesson, id=lesson_id)

    guard = _require_enrollment(lesson.course)
    if guard:
        return guard

    progress, _ = LessonProgress.objects.get_or_create(
        lesson=lesson,
        user=None,
    )

    progress.last_opened_at = timezone.now()
    progress.save(update_fields=["last_opened_at"])

    return JsonResponse({
        "id": lesson.id,
        "title": lesson.title,
        "content": lesson.content,
    })


@require_http_methods(["GET", "PATCH"])
def lesson_progress(request, lesson_id):
    """
    Get or update lesson progress.
    Requires enrollment.
    """
    lesson = get_object_or_404(Lesson, id=lesson_id)

    guard = _require_enrollment(lesson.course)
    if guard:
        return guard

    progress, _ = LessonProgress.objects.get_or_create(
        lesson=lesson,
        user=None,
    )

    if request.method == "PATCH":
        body = json.loads(request.body)

        progress.completed = body.get(
            "completed", progress.completed
        )
        progress.last_position = body.get(
            "last_position", progress.last_position
        )

        progress.save()

    return JsonResponse({
        "lesson_id": lesson.id,
        "completed": progress.completed,
        "last_position": progress.last_position,
    })


def course_progress(request, course_id):
    """
    Course-level progress + resume lesson.
    Requires enrollment.
    """
    course = get_object_or_404(Course, id=course_id)

    guard = _require_enrollment(course)
    if guard:
        return guard

    lessons = course.lessons.all()
    total = lessons.count()

    progresses = LessonProgress.objects.filter(
        lesson__course=course,
        user=None,
    )

    completed_ids = set(
        progresses.filter(completed=True)
        .values_list("lesson_id", flat=True)
    )

    incomplete = progresses.filter(completed=False)

    recent = (
        incomplete.exclude(last_opened_at__isnull=True)
        .order_by("-last_opened_at")
        .first()
    )

    if recent:
        resume_lesson_id = recent.lesson_id
    else:
        next_lesson = lessons.exclude(
            id__in=completed_ids
        ).first()
        resume_lesson_id = next_lesson.id if next_lesson else None

    completed = len(completed_ids)
    percentage = int((completed / total) * 100) if total else 0

    return JsonResponse({
        "course_id": course.id,
        "completed": completed,
        "total": total,
        "percentage": percentage,
        "resume_lesson_id": resume_lesson_id,
    })


def teacher_course_analytics(request):
    """
    Aggregated course-level analytics.
    """
    data = []

    for course in Course.objects.all():
        total_lessons = course.lessons.count()
        completed_lessons = LessonProgress.objects.filter(
            lesson__course=course,
            completed=True,
        ).count()

        percentage = int(
            (completed_lessons / total_lessons) * 100
        ) if total_lessons else 0

        data.append({
            "course_id": course.id,
            "title": course.title,
            "total_lessons": total_lessons,
            "completed_lessons": completed_lessons,
            "percentage": percentage,
        })

    return JsonResponse(data, safe=False)


def teacher_lesson_analytics(request):
    """
    Lesson-level analytics.
    """
    data = []

    for lesson in Lesson.objects.select_related("course"):
        qs = LessonProgress.objects.filter(lesson=lesson)

        completed_count = qs.filter(completed=True).count()
        total_attempts = qs.count()

        avg_position = qs.exclude(last_position=0).aggregate(
            avg=Avg("last_position")
        )["avg"]

        data.append({
            "lesson_id": lesson.id,
            "lesson_title": lesson.title,
            "course_title": lesson.course.title,
            "completed_count": completed_count,
            "total_attempts": total_attempts,
            "avg_time_spent": int(avg_position or 0),
        })

    return JsonResponse(data, safe=False)
