import json

from django.contrib.auth.decorators import login_required
from django.db.models import Avg
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.scoped_service import scope_queryset, get_scoped_object_or_403
from apps.academics.models import (
    TeachingAssignment,
    ClassRoom,
    ClassSubject,
    StudentSubject,
)
from apps.accounts.models import User
from apps.assessments.models import Assessment, AssessmentAttempt
from .models import Course, Lesson, LessonProgress


# -------------------------------------------------------
# HEALTH
# -------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def health(request):
    return JsonResponse({
        "status": "ok",
        "service": "gyangrit-backend",
        "timestamp": timezone.now().isoformat(),
    })


# -------------------------------------------------------
# ACCESS CONTROL (now correct - no more .institution on Subject)
# -------------------------------------------------------

def has_access_to_course(user, course):
    if not user.is_authenticated:
        return False

    if user.role == "ADMIN":
        return True

    subject = course.subject

    if user.role == "OFFICIAL":
        return True  # global content for officials (matches original behaviour)

    if user.role == "PRINCIPAL":
        return ClassSubject.objects.filter(
            classroom__institution=user.institution,
            subject=subject
        ).exists()

    if user.role == "TEACHER":
        return user.teaching_assignments.filter(subject=subject).exists()

    if user.role == "STUDENT":
        return StudentSubject.objects.filter(
            student=user,
            subject=subject
        ).exists()

    return False


# -------------------------------------------------------
# COURSES LIST (now properly scoped per role)
# -------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def courses(request):
    user = request.user

    if user.role == "ADMIN" or user.role == "OFFICIAL":
        queryset = Course.objects.all()

    elif user.role == "PRINCIPAL":
        queryset = Course.objects.filter(
            subject__classrooms__classroom__institution=user.institution
        ).distinct()

    elif user.role == "TEACHER":
        subject_ids = user.teaching_assignments.values_list("subject_id", flat=True)
        queryset = Course.objects.filter(subject_id__in=subject_ids)

    elif user.role == "STUDENT":
        subject_ids = StudentSubject.objects.filter(
            student=user
        ).values_list("subject_id", flat=True)
        queryset = Course.objects.filter(subject_id__in=subject_ids)

    else:
        queryset = Course.objects.none()

    data = list(
        queryset.order_by("grade", "title").values(
            "id", "title", "description", "grade", "is_core"
        )
    )
    return JsonResponse(data, safe=False)


# -------------------------------------------------------
# COURSE LESSONS + DETAIL + PROGRESS
# -------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def course_lessons(request, course_id):
    course = get_object_or_404(Course, id=course_id)

    if not has_access_to_course(request.user, course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    lessons = course.lessons.filter(is_published=True).order_by("order")

    data = []
    for lesson in lessons:
        progress = LessonProgress.objects.filter(
            lesson=lesson, user=request.user
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

    if not has_access_to_course(request.user, lesson.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    progress, _ = LessonProgress.objects.get_or_create(
        lesson=lesson, user=request.user
    )
    progress.mark_opened()

    return JsonResponse({
        "id": lesson.id,
        "title": lesson.title,
        "content": lesson.content,
        "video_url": lesson.video_url,
        "hls_manifest_url": lesson.hls_manifest_url,
        "thumbnail_url": lesson.thumbnail_url,
        "completed": progress.completed,
        "last_position": progress.last_position,
    })


@login_required
@require_http_methods(["PATCH"])
def lesson_progress(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)

    if not has_access_to_course(request.user, lesson.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    progress = get_object_or_404(
        LessonProgress, lesson=lesson, user=request.user
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

    if not has_access_to_course(request.user, course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    lessons = course.lessons.filter(is_published=True)
    total = lessons.count()

    progresses = LessonProgress.objects.filter(
        lesson__course=course, user=request.user
    )

    completed = progresses.filter(completed=True).count()
    percentage = int((completed / total) * 100) if total else 0

    resume = progresses.filter(completed=False).order_by("-last_opened_at").first()
    if not resume:
        resume = progresses.filter(completed=False).order_by("lesson__order").first()

    return JsonResponse({
        "course_id": course.id,
        "completed": completed,
        "total": total,
        "percentage": percentage,
        "resume_lesson_id": resume.lesson_id if resume else None,
    })


# -------------------------------------------------------
# TEACHER ANALYTICS (now use central scoping)
# -------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def teacher_course_analytics(request):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    courses = scope_queryset(request.user, Course.objects.all())

    data = []
    for course in courses:
        total_lessons = course.lessons.count()
        completed_lessons = LessonProgress.objects.filter(
            lesson__course=course, completed=True
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

    lessons = scope_queryset(request.user, Lesson.objects.all())  # safe fallback

    data = []
    for lesson in lessons:
        progress_qs = LessonProgress.objects.filter(lesson=lesson)
        completed_count = progress_qs.filter(completed=True).count()
        total_attempts = progress_qs.count()
        avg_position = progress_qs.exclude(last_position=0).aggregate(avg=Avg("last_position"))["avg"] or 0

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

    classes = scope_queryset(request.user, ClassRoom.objects.all())

    if request.user.role == "TEACHER":
        classes = classes.filter(
            sections__teaching_assignments__teacher=request.user
        ).distinct()

    data = []
    for classroom in classes:
        students = User.objects.filter(role="STUDENT", section__classroom=classroom)
        attempts = AssessmentAttempt.objects.filter(
            user__in=students, submitted_at__isnull=False
        )

        total_students = students.count()
        total_attempts = attempts.count()
        avg_score = attempts.aggregate(avg=Avg("score"))["avg"] or 0
        pass_count = attempts.filter(passed=True).count()
        pass_rate = (pass_count / total_attempts * 100) if total_attempts else 0

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

    if request.user.role == "TEACHER":
        subject_ids = request.user.teaching_assignments.values_list("subject_id", flat=True)
        assessments = Assessment.objects.filter(course__subject_id__in=subject_ids)
    else:
        assessments = scope_queryset(request.user, Assessment.objects.all())

    data = []
    for assessment in assessments:
        attempts = assessment.attempts.filter(submitted_at__isnull=False)
        total_attempts = attempts.count()
        unique_students = attempts.values("user").distinct().count()
        avg_score = attempts.aggregate(avg=Avg("score"))["avg"] or 0
        pass_count = attempts.filter(passed=True).count()
        pass_rate = (pass_count / total_attempts * 100) if total_attempts else 0

        data.append({
            "assessment_id": assessment.id,
            "title": assessment.title,
            "course": assessment.course.title,
            "total_attempts": total_attempts,
            "unique_students": unique_students,
            "average_score": round(avg_score, 2),
            "pass_count": pass_count,
            "fail_count": total_attempts - pass_count,
            "pass_rate": round(pass_rate, 2),
        })

    return JsonResponse(data, safe=False)

from django.contrib.auth import get_user_model
from django.db.models import Avg
from apps.academics.models import ClassRoom
from apps.assessments.models import AssessmentAttempt
from apps.accesscontrol.scoped_service import scope_queryset, get_scoped_object_or_403

User = get_user_model()

@login_required
@require_http_methods(["GET"])
def teacher_class_students(request, class_id):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    classroom = get_scoped_object_or_403(request.user, ClassRoom.objects, id=class_id)

    if request.user.role == "TEACHER":
        if not request.user.teaching_assignments.filter(
            section__classroom=classroom
        ).exists():
            return JsonResponse({"detail": "Forbidden"}, status=403)

    students = User.objects.filter(role="STUDENT", section__classroom=classroom)

    data = []
    for student in students:
        attempts = AssessmentAttempt.objects.filter(
            user=student, submitted_at__isnull=False
        )
        total_attempts = attempts.count()
        avg_score = attempts.aggregate(avg=Avg("score"))["avg"] or 0
        pass_count = attempts.filter(passed=True).count()
        pass_rate = (pass_count / total_attempts * 100) if total_attempts else 0

        data.append({
            "student_id": student.id,
            "username": student.username,
            "total_attempts": total_attempts,
            "average_score": round(avg_score, 2),
            "pass_rate": round(pass_rate, 2),
        })

    return JsonResponse(data, safe=False)


@login_required
@require_http_methods(["GET"])
def teacher_student_assessments(request, class_id, student_id):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    classroom = get_scoped_object_or_403(request.user, ClassRoom.objects, id=class_id)
    student_qs = scope_queryset(request.user, User.objects.filter(role="STUDENT"))
    student = get_object_or_404(student_qs, id=student_id)

    if student.section and student.section.classroom != classroom:
        return JsonResponse({"detail": "Student not in this class"}, status=400)

    attempts = (
        AssessmentAttempt.objects
        .filter(user=student, submitted_at__isnull=False)
        .select_related("assessment")
        .order_by("-submitted_at")
    )

    data = []
    for attempt in attempts:
        data.append({
            "assessment_id": attempt.assessment.id,
            "assessment_title": attempt.assessment.title,
            "score": attempt.score,
            "passed": attempt.passed,
            "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        })

    return JsonResponse({
        "student_id": student.id,
        "username": student.username,
        "attempts": data,
    })