import json
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.db import models

from .models import Course, Lesson, LessonProgress

"""
CONTENT APP API (v1)

Design principles:
- All endpoints are versioned under /api/v1/
- No auth yet (user=None everywhere)
- MUST be resilient to duplicate LessonProgress rows
- Response shapes must remain stable
"""


# ---------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------

def health(request):
    """
    Simple health endpoint for frontend / monitoring.
    """
    return JsonResponse({
        "status": "ok",
        "service": "gyangrit-backend",
    })


# ---------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------

def courses(request):
    """
    Returns all courses.
    """
    data = list(
        Course.objects.all().values(
            "id",
            "title",
            "description",
        )
    )
    return JsonResponse(data, safe=False)


# ---------------------------------------------------------------------
# Course → Lessons
# ---------------------------------------------------------------------

def course_lessons(request, course_id):
    """
    Returns lessons for a course, including completion state.
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


# ---------------------------------------------------------------------
# Lesson detail
# ---------------------------------------------------------------------

def lesson_detail(request, lesson_id):
    """
    Returns lesson content and updates last_opened_at.

    IMPORTANT:
    - Must NOT crash if duplicate LessonProgress rows exist
    - Always pick ONE canonical progress row
    """
    lesson = get_object_or_404(Lesson, id=lesson_id)

    progress = (
        LessonProgress.objects
        .filter(lesson=lesson, user=None)
        .order_by("-last_opened_at", "-id")
        .first()
    )

    if not progress:
        progress = LessonProgress.objects.create(
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


# ---------------------------------------------------------------------
# Lesson progress
# ---------------------------------------------------------------------

@require_http_methods(["GET", "PATCH"])
def lesson_progress(request, lesson_id):
    """
    Get or update progress for a lesson.

    PATCH body (partial):
    {
        "completed": boolean,
        "last_position": number
    }
    """
    lesson = get_object_or_404(Lesson, id=lesson_id)

    progress = (
        LessonProgress.objects
        .filter(lesson=lesson, user=None)
        .order_by("-last_opened_at", "-id")
        .first()
    )

    if not progress:
        progress = LessonProgress.objects.create(
            lesson=lesson,
            user=None,
        )

    if request.method == "PATCH":
        body = json.loads(request.body or "{}")

        progress.completed = body.get(
            "completed",
            progress.completed,
        )

        progress.last_position = body.get(
            "last_position",
            progress.last_position,
        )

        progress.save()

    return JsonResponse({
        "lesson_id": lesson.id,
        "completed": progress.completed,
        "last_position": progress.last_position,
    })


# ---------------------------------------------------------------------
# Course progress (dashboard + resume)
# ---------------------------------------------------------------------

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
        progresses.filter(completed=True)
        .values_list("lesson_id", flat=True)
    )

    incomplete = progresses.filter(completed=False)

    # Resume logic:
    # 1. Most recently opened incomplete lesson
    recent = (
        incomplete.exclude(last_opened_at__isnull=True)
        .order_by("-last_opened_at")
        .first()
    )

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


# ---------------------------------------------------------------------
# Teacher analytics
# ---------------------------------------------------------------------

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

    NOTE:
    - Aggregated globally
    - User scoping will be added later
    """
    data = []

    for lesson in Lesson.objects.select_related("course"):
        progress_qs = LessonProgress.objects.filter(lesson=lesson)

        completed_count = progress_qs.filter(completed=True).count()
        total_attempts = progress_qs.count()

        avg_position = (
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
            "avg_time_spent": int(avg_position or 0),
        })

    return JsonResponse(data, safe=False)
