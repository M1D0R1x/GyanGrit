import json

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.contrib.auth.decorators import login_required
from django.db.models import Avg

from .models import Course, Lesson, LessonProgress
from apps.accounts.models import User


@login_required
@require_http_methods(["GET"])
def health(request):
    """
    Simple health check endpoint.
    """
    return JsonResponse({
        "status": "ok",
        "service": "gyangrit-backend",
        "timestamp": timezone.now().isoformat(),
    })


@login_required
@require_http_methods(["GET"])
def courses(request):
    """
    List courses the user can access.
    """
    if request.user.role == "STUDENT":
        courses = Course.objects.filter(
            lessons__progress_records__user=request.user
        ).distinct()
    else:
        # Teachers/Officials see courses in their institution
        courses = Course.objects.filter(institution=request.user.institution)

    data = list(
        courses.values(
            "id",
            "title",
            "description",
        ).order_by("title")
    )

    return JsonResponse(data, safe=False)


@login_required
@require_http_methods(["GET"])
def course_lessons(request, course_id):
    course = get_object_or_404(Course, id=course_id)

    # Student access check
    if request.user.role == "STUDENT" and not LessonProgress.objects.filter(
        lesson__course=course, user=request.user
    ).exists():
        return JsonResponse({"detail": "Not enrolled in this course"}, status=403)

    lessons = course.lessons.filter(is_published=True).order_by("order")

    data = []
    for lesson in lessons:
        progress = LessonProgress.objects.filter(
            lesson=lesson,
            user=request.user,
        ).first()

        data.append({
            "id": lesson.id,
            "title": lesson.title,
            "order": lesson.order,
            "completed": progress.completed if progress else False,
        })

    return JsonResponse(data, safe=False)


@login_required
@require_http_methods(["GET"])
def lesson_detail(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id, is_published=True)

    # Student access check
    if request.user.role == "STUDENT" and not LessonProgress.objects.filter(
        lesson__course=lesson.course, user=request.user
    ).exists():
        return JsonResponse({"detail": "Not authorized for this lesson"}, status=403)

    progress, created = LessonProgress.objects.get_or_create(
        lesson=lesson,
        user=request.user,
    )

    progress.mark_opened()

    return JsonResponse({
        "id": lesson.id,
        "title": lesson.title,
        "content": lesson.content,
        "completed": progress.completed,
        "last_position": progress.last_position,
    })


@login_required
@require_http_methods(["PATCH"])
def lesson_progress(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)

    progress = get_object_or_404(
        LessonProgress,
        lesson=lesson,
        user=request.user,
    )

    body = json.loads(request.body or "{}")

    if "completed" in body:
        progress.completed = body["completed"]
    if "last_position" in body:
        progress.last_position = body["last_position"]

    progress.save()

    return JsonResponse({
        "lesson_id": lesson.id,
        "completed": progress.completed,
        "last_position": progress.last_position,
    })


@login_required
@require_http_methods(["GET"])
def course_progress(request, course_id):
    course = get_object_or_404(Course, id=course_id)

    lessons = course.lessons.filter(is_published=True)
    total = lessons.count()

    progresses = LessonProgress.objects.filter(
        lesson__course=course,
        user=request.user,
    )

    completed = progresses.filter(completed=True).count()
    percentage = int((completed / total) * 100) if total else 0

    # Resume: most recent incomplete or first incomplete
    resume = progresses.filter(completed=False).order_by("-last_opened_at").first()
    if not resume:
        resume = progresses.filter(completed=False).order_by("lesson__order").first()

    resume_lesson_id = resume.lesson_id if resume else None

    return JsonResponse({
        "course_id": course.id,
        "completed": completed,
        "total": total,
        "percentage": percentage,
        "resume_lesson_id": resume_lesson_id,
    })


# ---------------------------------------------------------------------
# Teacher Analytics (Scoped & Safe)
# ---------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def teacher_course_analytics(request):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    # Scope to institution
    courses = Course.objects.filter(institution=request.user.institution) if request.user.role == "TEACHER" else Course.objects.all()

    data = []

    for course in courses:
        total_lessons = course.lessons.count()
        completed_lessons = LessonProgress.objects.filter(
            lesson__course=course,
            completed=True,
        ).count()

        percentage = int((completed_lessons / total_lessons) * 100) if total_lessons else 0

        data.append({
            "course_id": course.id,
            "title": course.title,
            "total_lessons": total_lessons,
            "completed_lessons": completed_lessons,
            "percentage": percentage,
        })

    return JsonResponse(data, safe=False)


@login_required
@require_http_methods(["GET"])
def teacher_lesson_analytics(request):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    # Scope to institution
    lessons = Lesson.objects.filter(course__institution=request.user.institution) if request.user.role == "TEACHER" else Lesson.objects.all()

    data = []

    for lesson in lessons:
        progress_qs = LessonProgress.objects.filter(lesson=lesson)

        completed_count = progress_qs.filter(completed=True).count()
        total_attempts = progress_qs.count()

        avg_position = (
            progress_qs.exclude(last_position=0)
            .aggregate(avg=Avg("last_position"))
            .get("avg")
        ) or 0

        data.append({
            "lesson_id": lesson.id,
            "lesson_title": lesson.title,
            "course_title": lesson.course.title,
            "completed_count": completed_count,
            "total_attempts": total_attempts,
            "avg_position": int(avg_position),
        })

    return JsonResponse(data, safe=False)