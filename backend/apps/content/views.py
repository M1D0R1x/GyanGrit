import json
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.db import models
from django.views.decorators.csrf import csrf_exempt


from .models import Course, Lesson, LessonProgress

"""
API CONTRACT NOTES:

- All endpoints are versioned under /api/v1/
- Responses are stable and backward-compatible
- User scoping will be added without changing response shape
"""


def health(request):
    """
    Simple health endpoint for frontend / monitoring.
    """
    return JsonResponse({
        "status": "ok",
        "service": "gyangrit-backend",
    })


def courses(request):
    """
    Returns all courses.
    """
    data = list(
        Course.objects.all().values(
            "id", "title", "description"
        )
    )
    return JsonResponse(data, safe=False)


def course_lessons(request, course_id):
    """
    Returns lessons for a course, including completion state.
    """
    course = get_object_or_404(Course, id=course_id)

    lessons_data = []
    for lesson in course.lessons.all():
        completed = LessonProgress.objects.filter(
            lesson=lesson,
            completed=True,
        ).exists()

        lessons_data.append({
            "id": lesson.id,
            "title": lesson.title,
            "order": lesson.order,
            "completed": completed,
        })

    return JsonResponse(lessons_data, safe=False)


def lesson_detail(request, lesson_id):
    """
    Returns lesson content and updates last_opened_at
    for resume functionality.
    """
    lesson = get_object_or_404(Lesson, id=lesson_id)

    progress, _ = LessonProgress.objects.get_or_create(
        lesson=lesson,
        user=None,  # will change when auth is added
    )
    progress.mark_opened()

    return JsonResponse({
        "id": lesson.id,
        "title": lesson.title,
        "content": lesson.content,
    })


from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def lesson_progress(request, lesson_id):
    """
    Get or update progress for a lesson.
    """
    lesson = get_object_or_404(Lesson, id=lesson_id)

    progress, _ = LessonProgress.objects.get_or_create(
        lesson=lesson,
        user=None,
    )

    if request.method == "PATCH":
        body = json.loads(request.body)

        progress.completed = body.get(
            "completed", progress.completed
        )

        # Time accumulation (frontend sends delta)
        progress.time_spent_seconds += body.get(
            "time_spent_seconds", 0
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
    Returns course-level progress including resume lesson.
    """
    course = get_object_or_404(Course, id=course_id)
    lessons = course.lessons.all()

    total = lessons.count()

    progresses = LessonProgress.objects.filter(
        lesson__course=course,
        user=None,
    ).select_related("lesson")

    completed_ids = set(
        progresses.filter(
            completed=True
        ).values_list("lesson_id", flat=True)
    )

    incomplete = progresses.filter(completed=False)

    # Resume priority:
    # 1. Most recently opened incomplete lesson
    recent = incomplete.exclude(
        last_opened_at__isnull=True
    ).order_by("-last_opened_at").first()

    if recent:
        resume_lesson_id = recent.lesson_id
    else:
        # 2. First not-yet-completed lesson
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
    Aggregated course-level analytics for teachers/admins.
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
    Lesson-level analytics for teachers.

    NOTE:
    - Currently aggregated globally (no users yet)
    - User scoping will be added later without changing response shape
    """
    data = []

    for lesson in Lesson.objects.select_related("course"):
        progress_qs = LessonProgress.objects.filter(lesson=lesson)

        completed_count = progress_qs.filter(completed=True).count()
        total_attempts = progress_qs.count()

        avg_time_spent = (
            progress_qs.exclude(last_position=0)
            .aggregate(avg=models.Avg("last_position"))
            .get("avg")
        )

        data.append({
            "lesson_id": lesson.id,
            "lesson_title": lesson.title,
            "course_title": lesson.course.title,
            "completed_count": completed_count,
            "total_attempts": total_attempts,
            "avg_time_spent": int(avg_time_spent or 0),
        })

    return JsonResponse(data, safe=False)
