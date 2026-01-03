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


from django.utils import timezone
from apps.content.models import LessonProgress

def lesson_detail(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)

    progress, _ = LessonProgress.objects.get_or_create(lesson=lesson)
    progress.last_opened_at = timezone.now()
    progress.save(update_fields=["last_opened_at"])

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


from django.db.models import Q

def course_progress(request, course_id):
    course = get_object_or_404(Course, id=course_id)

    lessons = course.lessons.all()
    total = lessons.count()

    progresses = LessonProgress.objects.filter(
        lesson__course=course
    ).select_related("lesson")

    completed_ids = set(
        progresses.filter(completed=True).values_list("lesson_id", flat=True)
    )

    incomplete = progresses.filter(completed=False)

    # Resume logic:
    recent = incomplete.exclude(
        last_opened_at__isnull=True
    ).order_by("-last_opened_at").first()

    if recent:
        resume_lesson_id = recent.lesson_id
    else:
        next_lesson = lessons.exclude(id__in=completed_ids).first()
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
