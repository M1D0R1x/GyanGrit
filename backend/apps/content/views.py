# apps.content.views
"""
content/views.py

Single authoritative views file for the content app.
Uses Django's function-based view pattern with JSON responses —
consistent with the rest of the codebase.

BUG FIX (2026-03-15):
  - Student grade filter: `section.grade` does not exist on Section.
    Grade lives on section.classroom.name (a string, e.g. "8").
    Fixed to: int(section.classroom.name) with ValueError guard.
"""
import json
import logging
import re

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db.models import Avg, Count, Q
from django.db.models.functions import Cast
from django.db.models import IntegerField
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from apps.accesscontrol.scoped_service import scope_queryset, get_scoped_object_or_403
from apps.academics.models import ClassRoom, ClassSubject, StudentSubject
from apps.assessments.models import Assessment, AssessmentAttempt
from .models import Course, Lesson, SectionLesson, LessonProgress, LessonNote

User = get_user_model()
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# SLUG HELPER — mirrors frontend utils/slugs.ts
# ─────────────────────────────────────────────────────────────────────────────

def _subject_matches_slug(subject_name: str, slug: str) -> bool:
    """
    Check whether a subject name matches a URL slug.

    Rules (must match frontend toSlug()):
      lowercase → spaces/underscores → hyphens → strip non-alphanumeric-hyphen
      → collapse hyphens → strip leading/trailing hyphens
    """
    normalised = re.sub(r"-+", "-", re.sub(r"[^a-z0-9-]", "", re.sub(r"[\s_]+", "-", subject_name.lower()))).strip("-")
    return normalised == slug.lower().strip()


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def health(request):
    return JsonResponse({
        "status": "ok",
        "service": "gyangrit-backend",
        "timestamp": timezone.now().isoformat(),
    })


# ─────────────────────────────────────────────────────────────────────────────
# ACCESS CONTROL HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def has_access_to_course(user, course):
    """Return True if the user is allowed to view this course."""
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


def _get_student_section(user):
    """Return the Section FK for a STUDENT, or None."""
    try:
        return user.section
    except AttributeError:
        return None


def _get_teacher_section(user):
    """Return the primary Section for a TEACHER via their assignment, or None."""
    assignment = getattr(user, "teaching_assignments", None)
    if assignment is None:
        return None
    first = assignment.first()
    return first.section if first else None


def _get_student_grade(user) -> int | None:
    """
    Derive the numeric grade for a STUDENT from their section's classroom name.

    Section has no `grade` field. Grade is stored as a string on ClassRoom.name
    (e.g. "8"). This function safely resolves the traversal:
        user.section → ClassRoom → name → int

    Returns None if the section, classroom, or name is missing/non-numeric.
    """
    section = _get_student_section(user)
    if section is None:
        return None
    classroom = getattr(section, "classroom", None)
    if classroom is None:
        return None
    try:
        return int(classroom.name.strip())
    except (ValueError, AttributeError):
        logger.warning(
            "Cannot parse grade from classroom name '%s' for user id=%s",
            getattr(classroom, "name", None),
            user.id,
        )
        return None


# ─────────────────────────────────────────────────────────────────────────────
# COURSES
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def courses(request):
    """
    GET /api/v1/courses/

    Returns courses scoped to the requesting user:
      STUDENT  → courses in their grade × enrolled subjects
      TEACHER  → courses for their assigned subjects (all grades)
      PRINCIPAL/OFFICIAL/ADMIN → all courses in scope

    Each course row includes subject__name, subject__id, and grade
    so the frontend can build human-readable slugs without extra API calls.
    """
    user = request.user

    base_qs = Course.objects.select_related("subject").order_by("grade", "subject__name")

    if user.role == "STUDENT":
        # Filter to the student's enrolled subjects
        enrolled_subjects = StudentSubject.objects.filter(student=user).values_list("subject_id", flat=True)
        qs = base_qs.filter(subject_id__in=enrolled_subjects)

        # Also filter by grade — student's classroom.name
        grade = _get_student_grade(user)
        if grade is not None:
            qs = qs.filter(grade=grade)

    elif user.role == "TEACHER":
        assigned_subjects = user.teaching_assignments.values_list("subject_id", flat=True).distinct()
        qs = base_qs.filter(subject_id__in=assigned_subjects)

    else:
        qs = scope_queryset(user, base_qs)

    data = [
        {
            "id":           c.id,
            "title":        c.title,
            "description":  c.description,
            "grade":        c.grade,
            "subject__name": c.subject.name,
            "subject__id":   c.subject.id,
            "is_core":      c.is_core,
        }
        for c in qs
    ]
    return JsonResponse(data, safe=False)


@login_required
@require_http_methods(["GET"])
def course_by_slug(request):
    """
    GET /api/v1/courses/by-slug/?grade=10&subject=punjabi

    Resolves a human-readable URL slug back to a course object.
    Used by LessonsPage when the URL is /courses/:grade/:subject.

    The subject param is a slug (lowercase, hyphenated).
    We match it against all Subject names using the same normalisation
    as the frontend toSlug() function.

    Returns the same shape as a course row in GET /courses/.
    Returns 404 if no matching course found.
    Returns 400 if grade or subject params are missing.
    """
    grade_str = request.GET.get("grade", "").strip()
    subject_slug = request.GET.get("subject", "").strip()

    if not grade_str or not subject_slug:
        return JsonResponse({"error": "grade and subject query params are required"}, status=400)

    try:
        grade = int(grade_str)
    except ValueError:
        return JsonResponse({"error": "grade must be an integer"}, status=400)

    # Fetch all courses for this grade, then match subject by slug
    candidates = (
        Course.objects
        .filter(grade=grade)
        .select_related("subject")
    )

    course = None
    for c in candidates:
        if _subject_matches_slug(c.subject.name, subject_slug):
            course = c
            break

    if course is None:
        return JsonResponse({"error": "Course not found"}, status=404)

    if not has_access_to_course(user=request.user, course=course):
        return JsonResponse({"error": "You do not have access to this course"}, status=403)

    return JsonResponse({
        "id":            course.id,
        "title":         course.title,
        "description":   course.description,
        "grade":         course.grade,
        "subject__name": course.subject.name,
        "subject__id":   course.subject.id,
        "is_core":       course.is_core,
    })


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def create_course(request):
    """POST /api/v1/courses/create/"""
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    from apps.academics.models import Subject
    subject_id = body.get("subject_id")
    grade      = body.get("grade")
    title      = body.get("title", "").strip()

    if not subject_id or not grade or not title:
        return JsonResponse({"error": "subject_id, grade, and title are required"}, status=400)

    subject = get_object_or_404(Subject, id=subject_id)

    course = Course.objects.create(
        subject=subject,
        grade=grade,
        title=title,
        description=body.get("description", ""),
        is_core=body.get("is_core", True),
    )

    logger.info("Course created: id=%s title=%s by user=%s", course.id, course.title, request.user.id)

    return JsonResponse({
        "id":          course.id,
        "title":       course.title,
        "grade":       course.grade,
        "subject":     subject.name,
        "subject_id":  subject.id,
        "description": course.description,
        "is_core":     course.is_core,
    }, status=201)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["PATCH"])
@csrf_exempt
def update_course(request, course_id):
    """PATCH /api/v1/courses/<id>/"""
    course = get_scoped_object_or_403(request.user, Course.objects.all(), id=course_id)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    if "title" in body:
        course.title = body["title"].strip()
    if "description" in body:
        course.description = body["description"]
    if "is_core" in body:
        course.is_core = body["is_core"]

    course.save()
    return JsonResponse({"success": True, "id": course.id, "title": course.title})


@require_roles(["ADMIN"])
@require_http_methods(["DELETE"])
@csrf_exempt
def delete_course(request, course_id):
    """DELETE /api/v1/courses/<id>/delete/"""
    course = get_object_or_404(Course, id=course_id)
    course.delete()
    logger.info("Course deleted: id=%s by user=%s", course_id, request.user.id)
    return JsonResponse({"success": True})


# ─────────────────────────────────────────────────────────────────────────────
# LESSONS
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def course_lessons(request, course_id):
    """
    GET /api/v1/courses/<id>/lessons/

    Merged list of global curriculum lessons + section lessons for this course.
    Scoped to the requesting user's section.

    Each item has:
      type: "global" | "section"
      completed: bool (from LessonProgress — global lessons only)
    """
    course = get_object_or_404(Course, id=course_id)

    if not has_access_to_course(request.user, course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    user = request.user

    # ── Global lessons ────────────────────────────────────────────────────────
    global_lessons = list(
        Lesson.objects
        .filter(course=course)
        .order_by("order")
        .values("id", "title", "order", "has_video", "has_pdf", "has_content")
    )

    # Fetch completed lesson IDs for this user in one query
    completed_ids = set(
        LessonProgress.objects
        .filter(user=user, lesson_id__in=[l["id"] for l in global_lessons], completed=True)
        .values_list("lesson_id", flat=True)
    )

    global_rows = [
        {
            **lesson,
            "type": "global",
            "completed": lesson["id"] in completed_ids,
        }
        for lesson in global_lessons
    ]

    # ── Section lessons ───────────────────────────────────────────────────────
    section = _get_student_section(user) if user.role == "STUDENT" else _get_teacher_section(user)

    section_rows = []
    if section:
        section_lessons = list(
            SectionLesson.objects
            .filter(course=course, section=section)
            .select_related("created_by")
            .order_by("order")
        )
        section_rows = [
            {
                "id":          sl.id,
                "type":        "section",
                "title":       sl.title,
                "order":       sl.order,
                "completed":   False,  # section lessons don't track progress
                "has_video":   bool(sl.video_url),
                "has_pdf":     bool(sl.pdf_url),
                "has_content": bool(sl.content),
                "section_label": section.name,
                "created_by":    sl.created_by.username if sl.created_by else None,
            }
            for sl in section_lessons
        ]

    combined = sorted(global_rows + section_rows, key=lambda x: x["order"])
    return JsonResponse(combined, safe=False)


@login_required
@require_http_methods(["GET"])
def course_lessons_all(request, course_id):
    """
    GET /api/v1/courses/<id>/lessons/all/

    All global lessons for this course — no section filtering.
    Used by teacher/admin lesson editors.
    """
    course = get_object_or_404(Course, id=course_id)
    lessons = list(
        Lesson.objects
        .filter(course=course)
        .order_by("order")
        .values("id", "title", "order", "has_video", "has_pdf", "has_content", "video_url", "pdf_url")
    )
    return JsonResponse(lessons, safe=False)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def create_lesson(request, course_id):
    """POST /api/v1/courses/<id>/lessons/create/"""
    course = get_scoped_object_or_403(request.user, Course.objects.all(), id=course_id)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    title = body.get("title", "").strip()
    if not title:
        return JsonResponse({"error": "title is required"}, status=400)

    last_order = Lesson.objects.filter(course=course).order_by("-order").values_list("order", flat=True).first()
    order = (last_order or 0) + 1

    lesson = Lesson.objects.create(
        course=course,
        title=title,
        order=body.get("order", order),
        content=body.get("content", ""),
        video_url=body.get("video_url", ""),
        video_type=body.get("video_type", "youtube"),
        pdf_url=body.get("pdf_url", ""),
    )

    logger.info("Lesson created: id=%s course=%s by user=%s", lesson.id, course_id, request.user.id)

    return JsonResponse({
        "id":          lesson.id,
        "title":       lesson.title,
        "order":       lesson.order,
        "has_video":   lesson.has_video,
        "has_pdf":     lesson.has_pdf,
        "has_content": lesson.has_content,
    }, status=201)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION LESSONS
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET", "POST"])
@csrf_exempt
def section_lesson_list_create(request, course_id):
    """
    GET  /api/v1/courses/<id>/section-lessons/  — list teacher-added lessons
    POST /api/v1/courses/<id>/section-lessons/  — create a new one
    """
    course = get_object_or_404(Course, id=course_id)

    if request.method == "GET":
        user    = request.user
        section = _get_student_section(user) if user.role == "STUDENT" else _get_teacher_section(user)
        if not section:
            return JsonResponse([], safe=False)

        lessons = list(
            SectionLesson.objects
            .filter(course=course, section=section)
            .select_related("created_by")
            .order_by("order")
        )
        data = [
            {
                "id":          sl.id,
                "title":       sl.title,
                "order":       sl.order,
                "has_video":   bool(sl.video_url),
                "has_pdf":     bool(sl.pdf_url),
                "has_content": bool(sl.content),
                "created_by":  sl.created_by.username if sl.created_by else None,
            }
            for sl in lessons
        ]
        return JsonResponse(data, safe=False)

    # POST
    if request.user.role not in ("TEACHER", "PRINCIPAL", "ADMIN"):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    title = body.get("title", "").strip()
    if not title:
        return JsonResponse({"error": "title is required"}, status=400)

    section_id = body.get("section_id")
    if not section_id:
        return JsonResponse({"error": "section_id is required"}, status=400)

    from apps.academics.models import Section
    section = get_object_or_404(Section, id=section_id)

    last_order = SectionLesson.objects.filter(course=course, section=section).order_by("-order").values_list("order", flat=True).first()
    order = (last_order or 0) + 1

    sl = SectionLesson.objects.create(
        course=course,
        section=section,
        title=title,
        order=body.get("order", order),
        content=body.get("content", ""),
        video_url=body.get("video_url", ""),
        pdf_url=body.get("pdf_url", ""),
        created_by=request.user,
    )

    return JsonResponse({"id": sl.id, "title": sl.title, "order": sl.order}, status=201)


# ─────────────────────────────────────────────────────────────────────────────
# LESSON DETAIL + CRUD
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def lesson_detail(request, lesson_id):
    """GET /api/v1/lessons/<id>/"""
    lesson = get_object_or_404(Lesson, id=lesson_id)

    if not has_access_to_course(request.user, lesson.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    # Fetch or create progress row — marks opened for resume logic
    progress, _ = LessonProgress.objects.get_or_create(
        user=request.user,
        lesson=lesson,
        defaults={"completed": False, "last_position": 0},
    )
    progress.mark_opened()

    return JsonResponse({
        "id":            lesson.id,
        "title":         lesson.title,
        "order":         lesson.order,
        "content":       lesson.content,
        "video_url":     lesson.video_url,
        "video_type":    lesson.video_type,
        "pdf_url":       lesson.pdf_url,
        "has_video":     lesson.has_video,
        "has_pdf":       lesson.has_pdf,
        "has_content":   lesson.has_content,
        "completed":     progress.completed,
        "last_position": progress.last_position,
        "course_id":     lesson.course_id,
        "grade":         lesson.course.grade,
        "subject_name":  lesson.course.subject.name,
    })


@login_required
@require_http_methods(["GET"])
def section_lesson_detail(request, lesson_id):
    """GET /api/v1/lessons/section/<id>/"""
    sl = get_object_or_404(SectionLesson.objects.select_related("course__subject", "section"), id=lesson_id)

    if not has_access_to_course(request.user, sl.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    return JsonResponse({
        "id":           sl.id,
        "title":        sl.title,
        "order":        sl.order,
        "content":      sl.content,
        "video_url":    sl.video_url,
        "pdf_url":      sl.pdf_url,
        "has_video":    bool(sl.video_url),
        "has_pdf":      bool(sl.pdf_url),
        "has_content":  bool(sl.content),
        "section_id":   sl.section_id,
        "course_id":    sl.course_id,
        "grade":        sl.course.grade,
        "subject_name": sl.course.subject.name,
    })


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["PATCH"])
@csrf_exempt
def update_lesson(request, lesson_id):
    """PATCH /api/v1/lessons/<id>/update/"""
    lesson = get_object_or_404(Lesson, id=lesson_id)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    for field in ("title", "content", "video_url", "video_type", "pdf_url"):
        if field in body:
            setattr(lesson, field, body[field])
    if "order" in body:
        lesson.order = int(body["order"])

    lesson.save()
    logger.info("Lesson updated: id=%s by user=%s", lesson_id, request.user.id)
    return JsonResponse({"success": True, "id": lesson.id})


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["PATCH"])
@csrf_exempt
def update_section_lesson(request, lesson_id):
    """PATCH /api/v1/lessons/section/<id>/update/"""
    sl = get_object_or_404(SectionLesson, id=lesson_id)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    for field in ("title", "content", "video_url", "pdf_url"):
        if field in body:
            setattr(sl, field, body[field])
    if "order" in body:
        sl.order = int(body["order"])

    sl.save()
    return JsonResponse({"success": True, "id": sl.id})


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["DELETE"])
@csrf_exempt
def delete_lesson(request, lesson_id):
    """DELETE /api/v1/lessons/<id>/delete/"""
    lesson = get_object_or_404(Lesson, id=lesson_id)
    lesson.delete()
    logger.info("Lesson deleted: id=%s by user=%s", lesson_id, request.user.id)
    return JsonResponse({"success": True})


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["DELETE"])
@csrf_exempt
def delete_section_lesson(request, lesson_id):
    """DELETE /api/v1/lessons/section/<id>/delete/"""
    sl = get_object_or_404(SectionLesson, id=lesson_id)
    sl.delete()
    return JsonResponse({"success": True})


# ─────────────────────────────────────────────────────────────────────────────
# LESSON PROGRESS
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def lesson_progress(request, lesson_id):
    """
    POST /api/v1/lessons/<id>/progress/

    Body: { "completed": true, "last_position": 45 }
    """
    lesson = get_object_or_404(Lesson, id=lesson_id)

    if not has_access_to_course(request.user, lesson.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    progress, created = LessonProgress.objects.get_or_create(
        user=request.user,
        lesson=lesson,
        defaults={"completed": False, "last_position": 0},
    )

    if "completed" in body and body["completed"]:
        progress.completed = True
    if "last_position" in body:
        progress.last_position = int(body["last_position"])

    progress.save()

    return JsonResponse({
        "completed":     progress.completed,
        "last_position": progress.last_position,
    })


@login_required
@require_http_methods(["POST"])
@csrf_exempt
def add_lesson_note(request, lesson_id):
    """POST /api/v1/lessons/<id>/notes/"""
    lesson = get_object_or_404(Lesson, id=lesson_id)

    if not has_access_to_course(request.user, lesson.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    text = body.get("text", "").strip()
    if not text:
        return JsonResponse({"error": "text is required"}, status=400)

    note = LessonNote.objects.create(
        user=request.user,
        lesson=lesson,
        text=text,
    )
    return JsonResponse({"id": note.id, "text": note.text}, status=201)


# ─────────────────────────────────────────────────────────────────────────────
# COURSE PROGRESS
# ─────────────────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def course_progress(request, course_id):
    """
    GET /api/v1/courses/<id>/progress/

    Returns derived progress — not stored anywhere.
    total_lessons: count of global lessons only
    completed_lessons: how many the user has completed
    percentage: 0–100 int
    """
    course = get_object_or_404(Course, id=course_id)

    if not has_access_to_course(request.user, course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    total     = Lesson.objects.filter(course=course).count()
    completed = LessonProgress.objects.filter(
        user=request.user, lesson__course=course, completed=True
    ).count()

    percentage = round((completed / total) * 100) if total else 0

    return JsonResponse({
        "course_id":          course_id,
        "total_lessons":      total,
        "completed_lessons":  completed,
        "percentage":         percentage,
    })


# ─────────────────────────────────────────────────────────────────────────────
# TEACHER ANALYTICS
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def teacher_course_analytics(request):
    """GET /api/v1/teacher/analytics/courses/"""
    courses_qs = scope_queryset(request.user, Course.objects.select_related("subject"))

    data = []
    for course in courses_qs:
        total     = Lesson.objects.filter(course=course).count()
        enrolled  = LessonProgress.objects.filter(lesson__course=course).values("user").distinct().count()
        completed = LessonProgress.objects.filter(lesson__course=course, completed=True).values("user").distinct().count()
        data.append({
            "id":          course.id,
            "title":       course.title,
            "grade":       course.grade,
            "subject":     course.subject.name,
            "total_lessons": total,
            "enrolled_students": enrolled,
            "completed_students": completed,
        })

    return JsonResponse(data, safe=False)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def teacher_lesson_analytics(request):
    """GET /api/v1/teacher/analytics/lessons/"""
    course_id = request.GET.get("course_id")
    if not course_id:
        return JsonResponse({"error": "course_id is required"}, status=400)

    course = get_scoped_object_or_403(request.user, Course.objects.all(), id=course_id)
    lessons = Lesson.objects.filter(course=course).order_by("order")

    data = []
    for lesson in lessons:
        views     = LessonProgress.objects.filter(lesson=lesson).count()
        completed = LessonProgress.objects.filter(lesson=lesson, completed=True).count()
        data.append({
            "id":        lesson.id,
            "title":     lesson.title,
            "order":     lesson.order,
            "views":     views,
            "completed": completed,
        })

    return JsonResponse(data, safe=False)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def teacher_class_analytics(request):
    """GET /api/v1/teacher/analytics/classes/"""
    user = request.user
    if user.role == "TEACHER":
        classroom_ids = (
            user.teaching_assignments
            .values_list("section__classroom_id", flat=True)
            .distinct()
        )
        classrooms = ClassRoom.objects.filter(id__in=classroom_ids).select_related("institution")
    else:
        classrooms = scope_queryset(user, ClassRoom.objects.select_related("institution"))

    data = [
        {
            "id":          c.id,
            "name":        c.name,
            "institution": c.institution.name if c.institution else None,
        }
        for c in classrooms
    ]
    return JsonResponse(data, safe=False)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def teacher_class_students(request, class_id):
    """GET /api/v1/teacher/analytics/classes/<id>/students/"""
    classroom = get_object_or_404(ClassRoom, id=class_id)
    students  = User.objects.filter(role="STUDENT", section__classroom=classroom)

    data = []
    for student in students:
        total     = LessonProgress.objects.filter(user=student).count()
        completed = LessonProgress.objects.filter(user=student, completed=True).count()
        data.append({
            "id":                student.id,
            "username":          student.username,
            "display_name":      student.display_name,
            "total_lessons":     total,
            "completed_lessons": completed,
        })

    return JsonResponse(data, safe=False)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def teacher_assessment_analytics(request):
    """GET /api/v1/teacher/analytics/assessments/"""
    user = request.user

    if user.role == "TEACHER":
        subject_ids = (
            user.teaching_assignments
            .values_list("subject_id", flat=True)
            .distinct()
        )
        assessments = Assessment.objects.filter(
            course__subject_id__in=subject_ids
        ).select_related("course__subject")
    else:
        courses     = scope_queryset(user, Course.objects.all())
        course_ids  = list(courses.values_list("id", flat=True))
        assessments = Assessment.objects.filter(
            course_id__in=course_ids
        ).select_related("course__subject")

    data = []
    for a in assessments:
        attempts = AssessmentAttempt.objects.filter(assessment=a, submitted_at__isnull=False)
        data.append({
            "id":             a.id,
            "title":          a.title,
            "grade":          a.course.grade,
            "subject":        a.course.subject.name,
            "course_id":      a.course_id,
            "total_marks":    a.total_marks,
            "pass_marks":     a.pass_marks,
            "total_attempts": attempts.count(),
            "pass_count":     attempts.filter(passed=True).count(),
            "avg_score":      round(attempts.aggregate(avg=Avg("score"))["avg"] or 0, 1),
        })

    return JsonResponse(data, safe=False)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def teacher_student_assessments(request, class_id, student_id):
    """GET /api/v1/teacher/analytics/classes/<id>/students/<id>/"""
    classroom = get_object_or_404(ClassRoom, id=class_id)

    student_qs = scope_queryset(request.user, User.objects.filter(role="STUDENT"))
    student    = get_object_or_404(student_qs, id=student_id)

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
            "assessment_id":    a.assessment.id,
            "assessment_title": a.assessment.title,
            "score":            a.score,
            "passed":           a.passed,
            "submitted_at":     a.submitted_at.isoformat(),
        }
        for a in attempts
    ]

    return JsonResponse({
        "student_id": student.id,
        "username":   student.username,
        "attempts":   data,
    })
