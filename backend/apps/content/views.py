import json
import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db.models import Avg, Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from apps.accesscontrol.scoped_service import scope_queryset, get_scoped_object_or_403
from apps.academics.models import ClassRoom, ClassSubject, StudentSubject
from apps.assessments.models import Assessment, AssessmentAttempt
from .models import Course, Lesson, LessonProgress, LessonNote

User = get_user_model()
logger = logging.getLogger(__name__)


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
# ACCESS CONTROL
# -------------------------------------------------------

def has_access_to_course(user, course):
    if not user.is_authenticated:
        return False
    if user.is_superuser or user.role == "ADMIN":
        return True
    subject = course.subject
    if user.role == "STUDENT":
        return StudentSubject.objects.filter(student=user, subject=subject).exists()
    if user.role == "TEACHER":
        return user.teaching_assignments.filter(subject=subject).exists()
    if user.role == "PRINCIPAL":
        if not user.institution:
            return False
        return ClassSubject.objects.filter(
            classroom__institution=user.institution, subject=subject
        ).exists()
    if user.role == "OFFICIAL":
        if not user.district:
            return False
        return ClassSubject.objects.filter(
            classroom__institution__district__name=user.district, subject=subject
        ).exists()
    return False


# -------------------------------------------------------
# COURSES — LIST + CREATE
# -------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def courses(request):
    user = request.user

    if user.is_superuser or user.role == "ADMIN":
        queryset = Course.objects.all()
    elif user.role == "OFFICIAL":
        if not user.district:
            return JsonResponse({"detail": "No district assigned"}, status=400)
        queryset = Course.objects.filter(
            subject__classrooms__classroom__institution__district__name=user.district
        ).distinct()
    elif user.role == "PRINCIPAL":
        if not user.institution:
            return JsonResponse({"detail": "No institution assigned"}, status=400)
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
        queryset.select_related("subject")
        .order_by("grade", "title")
        .values("id", "title", "description", "grade", "is_core", "subject__name", "subject__id")
    )
    return JsonResponse(data, safe=False)


@csrf_exempt
@require_roles(["ADMIN"])
@require_http_methods(["POST"])
def create_course(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    subject_id = body.get("subject_id")
    grade = body.get("grade")
    title = body.get("title", "").strip()
    description = body.get("description", "").strip()
    is_core = body.get("is_core", True)

    if not all([subject_id, grade, title]):
        return JsonResponse({"error": "subject_id, grade, and title are required"}, status=400)

    from apps.academics.models import Subject
    subject = get_object_or_404(Subject, id=subject_id)

    course = Course.objects.create(
        subject=subject,
        grade=int(grade),
        title=title,
        description=description,
        is_core=bool(is_core),
    )

    return JsonResponse({
        "id": course.id,
        "title": course.title,
        "grade": course.grade,
        "subject": course.subject.name,
        "is_core": course.is_core,
    }, status=201)


@csrf_exempt
@require_roles(["ADMIN"])
@require_http_methods(["PATCH"])
def update_course(request, course_id):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    course = get_object_or_404(Course, id=course_id)

    if "title" in body:
        course.title = body["title"].strip()
    if "description" in body:
        course.description = body["description"].strip()
    if "is_core" in body:
        course.is_core = bool(body["is_core"])

    course.save()

    return JsonResponse({
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "is_core": course.is_core,
    })


@csrf_exempt
@require_roles(["ADMIN"])
@require_http_methods(["DELETE"])
def delete_course(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    course.delete()
    return JsonResponse({"success": True})


# -------------------------------------------------------
# COURSE LESSONS
# -------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def course_lessons(request, course_id):
    course = get_object_or_404(Course, id=course_id)

    if not has_access_to_course(request.user, course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    lessons = list(course.lessons.filter(is_published=True).order_by("order"))

    progress_map = {
        p.lesson_id: p
        for p in LessonProgress.objects.filter(
            lesson__course=course, user=request.user
        )
    }

    data = [
        {
            "id": lesson.id,
            "title": lesson.title,
            "order": lesson.order,
            "completed": progress_map[lesson.id].completed
            if lesson.id in progress_map else False,
            "has_video": bool(lesson.video_url or lesson.hls_manifest_url),
            "has_pdf": bool(lesson.pdf_url),
            "has_text": bool(lesson.content),
        }
        for lesson in lessons
    ]

    return JsonResponse(data, safe=False)


# -------------------------------------------------------
# ALL LESSONS FOR A COURSE (admin/teacher — includes unpublished)
# -------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def course_lessons_all(request, course_id):
    course = get_object_or_404(Course, id=course_id)

    if request.user.role not in ["ADMIN", "TEACHER"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    if request.user.role == "TEACHER" and not has_access_to_course(request.user, course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    lessons = course.lessons.order_by("order")

    data = [
        {
            "id": l.id,
            "title": l.title,
            "order": l.order,
            "is_published": l.is_published,
            "has_video": bool(l.video_url or l.hls_manifest_url),
            "has_pdf": bool(l.pdf_url),
            "has_text": bool(l.content),
            "video_url": l.video_url,
            "video_thumbnail_url": l.video_thumbnail_url,
            "video_duration": l.video_duration,
            "pdf_url": l.pdf_url,
            "thumbnail_url": l.thumbnail_url,
        }
        for l in lessons
    ]

    return JsonResponse(data, safe=False)


# -------------------------------------------------------
# LESSON DETAIL
# -------------------------------------------------------

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

    # Teacher notes visible to students
    notes = []
    if lesson.notes.filter(is_visible_to_students=True).exists():
        notes = list(
            lesson.notes.filter(is_visible_to_students=True)
            .select_related("author")
            .values("id", "content", "author__username", "created_at")
        )

    return JsonResponse({
        "id": lesson.id,
        "title": lesson.title,
        "content": lesson.content,
        "video_url": lesson.video_url,
        "video_thumbnail_url": lesson.video_thumbnail_url,
        "video_duration": lesson.video_duration,
        "hls_manifest_url": lesson.hls_manifest_url,
        "pdf_url": lesson.pdf_url,
        "thumbnail_url": lesson.thumbnail_url,
        "completed": progress.completed,
        "last_position": progress.last_position,
        "notes": notes,
    })


# -------------------------------------------------------
# LESSON CRUD (ADMIN + TEACHER)
# -------------------------------------------------------

@csrf_exempt
@require_roles(["ADMIN", "TEACHER"])
@require_http_methods(["POST"])
def create_lesson(request, course_id):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    course = get_object_or_404(Course, id=course_id)

    if request.user.role == "TEACHER" and not has_access_to_course(request.user, course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    title = body.get("title", "").strip()
    if not title:
        return JsonResponse({"error": "title is required"}, status=400)

    # Auto-assign next order
    last_order = course.lessons.aggregate(max=Count("id"))
    next_order = (course.lessons.order_by("-order").values_list("order", flat=True).first() or 0) + 1

    lesson = Lesson.objects.create(
        course=course,
        title=title,
        order=body.get("order", next_order),
        content=body.get("content", ""),
        video_url=body.get("video_url") or None,
        video_thumbnail_url=body.get("video_thumbnail_url") or None,
        video_duration=body.get("video_duration", ""),
        hls_manifest_url=body.get("hls_manifest_url") or None,
        pdf_url=body.get("pdf_url") or None,
        thumbnail_url=body.get("thumbnail_url") or None,
        is_published=body.get("is_published", False),
    )

    logger.info(
        "Lesson created: id=%s title='%s' course=%s by user id=%s",
        lesson.id, lesson.title, course.id, request.user.id
    )

    return JsonResponse({
        "id": lesson.id,
        "title": lesson.title,
        "order": lesson.order,
        "is_published": lesson.is_published,
    }, status=201)


@csrf_exempt
@require_roles(["ADMIN", "TEACHER"])
@require_http_methods(["PATCH"])
def update_lesson(request, lesson_id):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    lesson = get_object_or_404(Lesson, id=lesson_id)

    if request.user.role == "TEACHER" and not has_access_to_course(request.user, lesson.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    fields = [
        "title", "content", "video_url", "video_thumbnail_url",
        "video_duration", "hls_manifest_url", "pdf_url",
        "thumbnail_url", "is_published", "order",
    ]
    update_fields = []
    for field in fields:
        if field in body:
            value = body[field]
            # Convert empty string to None for URL fields
            if field.endswith("_url") and value == "":
                value = None
            setattr(lesson, field, value)
            update_fields.append(field)

    if update_fields:
        lesson.save(update_fields=update_fields)

    return JsonResponse({
        "id": lesson.id,
        "title": lesson.title,
        "order": lesson.order,
        "is_published": lesson.is_published,
    })


@csrf_exempt
@require_roles(["ADMIN"])
@require_http_methods(["DELETE"])
def delete_lesson(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)
    lesson.delete()
    return JsonResponse({"success": True})


# -------------------------------------------------------
# LESSON PROGRESS
# -------------------------------------------------------

@login_required
@require_http_methods(["PATCH"])
def lesson_progress(request, lesson_id):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    lesson = get_object_or_404(Lesson, id=lesson_id)

    if not has_access_to_course(request.user, lesson.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    progress = get_object_or_404(LessonProgress, lesson=lesson, user=request.user)

    update_fields = []
    if "completed" in body:
        progress.completed = bool(body["completed"])
        update_fields.append("completed")
    if "last_position" in body:
        progress.last_position = int(body["last_position"])
        update_fields.append("last_position")

    if update_fields:
        progress.save(update_fields=update_fields)

    return JsonResponse({
        "lesson_id": lesson.id,
        "completed": progress.completed,
        "last_position": progress.last_position,
    })


# -------------------------------------------------------
# COURSE PROGRESS
# -------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def course_progress(request, course_id):
    course = get_object_or_404(Course, id=course_id)

    if not has_access_to_course(request.user, course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    lessons = course.lessons.filter(is_published=True)
    total = lessons.count()
    progresses = LessonProgress.objects.filter(lesson__course=course, user=request.user)
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
# LESSON NOTES (TEACHER)
# -------------------------------------------------------

@csrf_exempt
@require_roles(["TEACHER", "ADMIN"])
@require_http_methods(["POST"])
def add_lesson_note(request, lesson_id):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    lesson = get_object_or_404(Lesson, id=lesson_id)

    if request.user.role == "TEACHER" and not has_access_to_course(request.user, lesson.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    content = body.get("content", "").strip()
    if not content:
        return JsonResponse({"error": "content is required"}, status=400)

    note = LessonNote.objects.create(
        lesson=lesson,
        author=request.user,
        content=content,
        is_visible_to_students=body.get("is_visible_to_students", True),
    )

    return JsonResponse({
        "id": note.id,
        "content": note.content,
        "author": request.user.username,
        "created_at": note.created_at.isoformat(),
    }, status=201)


# -------------------------------------------------------
# TEACHER ANALYTICS
# -------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def teacher_course_analytics(request):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    courses_qs = scope_queryset(request.user, Course.objects.all())

    data = []
    for course in courses_qs.select_related("subject"):
        total_lessons = course.lessons.filter(is_published=True).count()
        completed_lessons = LessonProgress.objects.filter(
            lesson__course=course, completed=True
        ).count()
        percentage = int((completed_lessons / total_lessons) * 100) if total_lessons else 0
        data.append({
            "course_id": course.id,
            "title": course.title,
            "subject": course.subject.name,
            "grade": course.grade,
            "total_lessons": total_lessons,
            "completed_lessons": completed_lessons,
            "percentage": percentage,
        })

    return JsonResponse(data, safe=False)


@login_required
@require_http_methods(["GET"])
def teacher_lesson_analytics(request):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    lessons_qs = scope_queryset(request.user, Lesson.objects.all())

    data = []
    for lesson in lessons_qs.select_related("course"):
        progress_qs = LessonProgress.objects.filter(lesson=lesson)
        agg = progress_qs.aggregate(
            total=Count("id"),
            completed=Count("id", filter=Q(completed=True)),
            avg_pos=Avg("last_position"),
        )
        data.append({
            "lesson_id": lesson.id,
            "lesson_title": lesson.title,
            "course_title": lesson.course.title,
            "completed_count": agg["completed"] or 0,
            "total_attempts": agg["total"] or 0,
            "avg_position": int(agg["avg_pos"] or 0),
        })

    return JsonResponse(data, safe=False)


@login_required
@require_http_methods(["GET"])
def teacher_class_analytics(request):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    classes = scope_queryset(request.user, ClassRoom.objects.all())

    if request.user.role == "TEACHER":
        classes = classes.filter(
            sections__teaching_assignments__teacher=request.user
        ).distinct()

    data = []
    for classroom in classes.select_related("institution"):
        student_ids = list(
            User.objects.filter(
                role="STUDENT", section__classroom=classroom
            ).values_list("id", flat=True)
        )
        total_students = len(student_ids)

        if student_ids:
            agg = AssessmentAttempt.objects.filter(
                user_id__in=student_ids, submitted_at__isnull=False
            ).aggregate(
                total=Count("id"),
                avg=Avg("score"),
                passes=Count("id", filter=Q(passed=True)),
            )
            total_attempts = agg["total"] or 0
            avg_score = agg["avg"] or 0
            pass_count = agg["passes"] or 0
        else:
            total_attempts = avg_score = pass_count = 0

        pass_rate = (pass_count / total_attempts * 100) if total_attempts else 0

        data.append({
            "class_id": classroom.id,
            "class_name": classroom.name,
            "institution": classroom.institution.name,
            "total_students": total_students,
            "total_attempts": total_attempts,
            "average_score": round(avg_score, 2),
            "pass_rate": round(pass_rate, 2),
        })

    return JsonResponse(data, safe=False)


@login_required
@require_http_methods(["GET"])
def teacher_assessment_analytics(request):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    if request.user.role == "TEACHER":
        subject_ids = request.user.teaching_assignments.values_list("subject_id", flat=True)
        assessments = Assessment.objects.filter(course__subject_id__in=subject_ids)
    else:
        assessments = scope_queryset(request.user, Assessment.objects.all())

    data = []
    for assessment in assessments.select_related("course", "course__subject"):
        attempts = assessment.attempts.filter(submitted_at__isnull=False)
        agg = attempts.aggregate(
            total=Count("id"),
            avg=Avg("score"),
            passes=Count("id", filter=Q(passed=True)),
        )
        total_attempts = agg["total"] or 0
        unique_students = attempts.values("user").distinct().count()
        avg_score = agg["avg"] or 0
        pass_count = agg["passes"] or 0
        pass_rate = (pass_count / total_attempts * 100) if total_attempts else 0

        data.append({
            "assessment_id": assessment.id,
            "title": assessment.title,
            "course": assessment.course.title,
            "subject": assessment.course.subject.name if assessment.course.subject else None,
            "total_attempts": total_attempts,
            "unique_students": unique_students,
            "average_score": round(avg_score, 2),
            "pass_count": pass_count,
            "fail_count": total_attempts - pass_count,
            "pass_rate": round(pass_rate, 2),
        })

    return JsonResponse(data, safe=False)


@login_required
@require_http_methods(["GET"])
def teacher_class_students(request, class_id):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    classroom = get_scoped_object_or_403(request.user, ClassRoom.objects, id=class_id)

    if request.user.role == "TEACHER":
        if not request.user.teaching_assignments.filter(section__classroom=classroom).exists():
            return JsonResponse({"detail": "Forbidden"}, status=403)

    students = User.objects.filter(role="STUDENT", section__classroom=classroom)

    data = []
    for student in students:
        agg = AssessmentAttempt.objects.filter(
            user=student, submitted_at__isnull=False
        ).aggregate(
            total=Count("id"),
            avg=Avg("score"),
            passes=Count("id", filter=Q(passed=True)),
        )
        total_attempts = agg["total"] or 0
        avg_score = agg["avg"] or 0
        pass_count = agg["passes"] or 0
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

    data = [
        {
            "assessment_id": a.assessment.id,
            "assessment_title": a.assessment.title,
            "score": a.score,
            "passed": a.passed,
            "submitted_at": a.submitted_at.isoformat(),
        }
        for a in attempts
    ]

    return JsonResponse({"student_id": student.id, "username": student.username, "attempts": data})