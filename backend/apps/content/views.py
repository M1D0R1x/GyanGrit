import json

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.contrib.auth.decorators import login_required
from django.db.models import Avg

from .models import Course, Lesson, LessonProgress
from apps.assessments.models import Assessment, AssessmentAttempt
from apps.accounts.models import User, ClassRoom, TeachingAssignment  # ← fixed: added TeachingAssignment import


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
    List all courses (universal for now).
    """
    courses = Course.objects.all()

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
# Teacher Analytics (Safe & No Crash)
# ---------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def teacher_course_analytics(request):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    courses = Course.objects.all()

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

    lessons = Lesson.objects.all()

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


@login_required
@require_http_methods(["GET"])
def teacher_class_analytics(request):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    from apps.accounts.models import ClassRoom

    if request.user.role == "TEACHER":
        # Use correct related_name from TeachingAssignment model
        # If related_name is 'assignments' on teacher field, use request.user.assignments
        classes = ClassRoom.objects.filter(
            teaching_assignments__teacher=request.user  # adjust if related_name different
        ).distinct()
    else:
        classes = ClassRoom.objects.all()

    data = []

    for classroom in classes:
        students = classroom.students.all()

        attempts = AssessmentAttempt.objects.filter(
            user__in=students,
            submitted_at__isnull=False,
        )

        total_students = students.count()
        total_attempts = attempts.count()
        avg_score = attempts.aggregate(avg=Avg("score"))["avg"] or 0
        pass_count = attempts.filter(passed=True).count()

        pass_rate = (pass_count / total_attempts * 100) if total_attempts > 0 else 0

        data.append({
            "class_id": classroom.id,
            "class_name": classroom.name,
            "total_students": total_students,
            "total_attempts": total_attempts,
            "average_score": round(avg_score, 2),
            "pass_rate": round(pass_rate, 2),
        })

    return JsonResponse(data, safe=False)


@login_required
@require_http_methods(["GET"])
def teacher_assessment_analytics(request):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    from apps.accounts.models import TeachingAssignment

    if request.user.role == "TEACHER":
        # Fixed: use correct traversal to course_id
        course_ids = TeachingAssignment.objects.filter(
            teacher=request.user
        ).values_list(
            'section__classroom__course_id', flat=True  # ← fixed: __course_id
        ).distinct()
        assessments = Assessment.objects.filter(course__id__in=course_ids)
    else:
        assessments = Assessment.objects.all()

    data = []

    for assessment in assessments:
        attempts = assessment.attempts.filter(submitted_at__isnull=False)

        total_attempts = attempts.count()
        unique_students = attempts.values("user").distinct().count()
        avg_score = attempts.aggregate(avg=Avg("score"))["avg"] or 0
        pass_count = attempts.filter(passed=True).count()
        fail_count = total_attempts - pass_count

        pass_rate = (pass_count / total_attempts * 100) if total_attempts > 0 else 0

        data.append({
            "assessment_id": assessment.id,
            "title": assessment.title,
            "course": assessment.course.title,
            "total_attempts": total_attempts,
            "unique_students": unique_students,
            "average_score": round(avg_score, 2),
            "pass_count": pass_count,
            "fail_count": fail_count,
            "pass_rate": round(pass_rate, 2),
        })

    return JsonResponse(data, safe=False)