from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from django.db.models import Count
import json

from .models import Course, Lesson, LessonProgress


def health(request):
    return JsonResponse({"status": "ok", "service": "gyangrit-backend"})


def courses(request):
    data = list(
        Course.objects.all().values("id", "title", "description")
    )
    return JsonResponse(data, safe=False)


def course_lessons(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    data = list(
        course.lessons.all().values("id", "title", "order", "content")
    )
    return JsonResponse(data, safe=False)


def lesson_detail(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)
    return JsonResponse({
        "id": lesson.id,
        "title": lesson.title,
        "content": lesson.content,
    })


@require_http_methods(["GET", "PATCH"])
def lesson_progress(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)
    progress, _ = LessonProgress.objects.get_or_create(lesson=lesson)

    if request.method == "PATCH":
        body = json.loads(request.body)
        progress.completed = body.get("completed", progress.completed)
        progress.last_position = body.get("last_position", progress.last_position)
        progress.save()

    return JsonResponse({
        "lesson_id": lesson.id,
        "completed": progress.completed,
        "last_position": progress.last_position,
    })


def course_progress(request, course_id):
    course = get_object_or_404(Course, id=course_id)

    lessons = list(course.lessons.all())
    total = len(lessons)

    completed_ids = set(
        LessonProgress.objects.filter(
            lesson__course=course,
            completed=True
        ).values_list("lesson_id", flat=True)
    )

    completed = len(completed_ids)

    next_lesson = None
    for lesson in lessons:
        if lesson.id not in completed_ids:
            next_lesson = lesson.id
            break

    percentage = int((completed / total) * 100) if total else 0

    return JsonResponse({
        "course_id": course.id,
        "completed": completed,
        "total": total,
        "percentage": percentage,
        "resume_lesson_id": next_lesson,
    })
