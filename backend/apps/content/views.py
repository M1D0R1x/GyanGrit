# apps.content.views
"""
content/views.py

BUG FIX (2026-03-15):
  - Student grade filter: section.grade does not exist. Grade lives on
    section.classroom.name (a string, "6"–"10"). Fixed with int() guard.

BUG FIX (2026-03-17):
  - course_lessons + course_lessons_all: has_video / has_pdf / has_content are
    Python @property methods on Lesson, NOT DB columns. .values() only works
    with real DB fields. Fixed: fetch video_url / pdf_url / content and derive
    booleans in Python.
  - lesson_detail: referenced lesson.video_type — field does not exist on the
    model. Removed. Added hls_manifest_url, video_thumbnail_url to response.
  - create_lesson: passed video_type to Lesson.objects.create() — field does
    not exist. Removed.
  - add_lesson_note: LessonNote uses author= + content=, not user= + text=.
    Fixed field names throughout.

BUG FIX (2026-03-18):
  - course_progress: added resume_lesson_id (next incomplete lesson) so the
    dashboard "Continue →" button works.
  - lesson_detail: was not returning notes at all — added notes list.
  - lesson_progress: was POST-only but frontend sends PATCH. Fixed to accept both.

BUG FIX (2026-03-22):
  - teacher_course_analytics: was using scope_queryset() for all roles, which
    follows the institution path. For TEACHER this returns ALL courses in the
    institution (all grades, all subjects). Correct behaviour: TEACHER sees only
    courses for their assigned subjects (same pattern as teacher_assessment_analytics).
    Fixed: added explicit role check — TEACHER filters by subject_id__in from
    teaching_assignments. PRINCIPAL/OFFICIAL/ADMIN use scope_queryset as before.
"""
import json
import logging
import re

from django.contrib.auth import get_user_model
from apps.accesscontrol.permissions import require_auth  # returns 401 JSON, not 302
from django.db.models import Avg
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
# SLUG HELPER — mirrors frontend utils/slugs.ts toSlug()
# ─────────────────────────────────────────────────────────────────────────────

def _subject_matches_slug(subject_name: str, slug: str) -> bool:
    normalised = re.sub(
        r"-+", "-",
        re.sub(r"[^a-z0-9-]", "",
               re.sub(r"[\s_]+", "-", subject_name.lower()))
    ).strip("-")
    return normalised == slug.lower().strip()


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH
# ─────────────────────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["GET", "POST", "HEAD"])
def health(request):
    """
    Unauthenticated health check for uptime monitors (QStash, UptimeRobot, etc.).

    Returns:
      200 + JSON body with status, DB check, and timestamp.
      503 if the database is unreachable.
    """
    import time as _time

    # DB connectivity check
    db_ok = True
    db_latency_ms = None
    try:
        from django.db import connection
        t0 = _time.monotonic()
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
        db_latency_ms = round((_time.monotonic() - t0) * 1000, 1)
    except Exception:
        db_ok = False

    status_code = 200 if db_ok else 503
    return JsonResponse({
        "status":       "ok" if db_ok else "degraded",
        "service":      "gyangrit-backend",
        "db":           "ok" if db_ok else "unreachable",
        "db_latency_ms": db_latency_ms,
        "timestamp":    timezone.now().isoformat(),
    }, status=status_code)


# ─────────────────────────────────────────────────────────────────────────────
# ACCESS CONTROL HELPERS
# ─────────────────────────────────────────────────────────────────────────────

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


def _get_student_section(user):
    try:
        return user.section
    except AttributeError:
        return None


def _get_teacher_section(user):
    assignment = getattr(user, "teaching_assignments", None)
    if assignment is None:
        return None
    first = assignment.first()
    return first.section if first else None


def _get_student_grade(user):
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

@require_auth
@require_http_methods(["GET"])
def courses(request):
    user    = request.user
    base_qs = Course.objects.select_related("subject").order_by("grade", "subject__name")

    if user.role == "STUDENT":
        enrolled = StudentSubject.objects.filter(
            student=user
        ).values_list("subject_id", flat=True)
        qs    = base_qs.filter(subject_id__in=enrolled)
        grade = _get_student_grade(user)
        if grade is not None:
            qs = qs.filter(grade=grade)
    elif user.role == "TEACHER":
        assigned = user.teaching_assignments.values_list(
            "subject_id", flat=True
        ).distinct()
        qs = base_qs.filter(subject_id__in=assigned)
    else:
        qs = scope_queryset(user, base_qs)

    data = [
        {
            "id":            c.id,
            "title":         c.title,
            "description":   c.description,
            "grade":         c.grade,
            "subject__name": c.subject.name,
            "subject__id":   c.subject.id,
            "is_core":       c.is_core,
        }
        for c in qs
    ]
    return JsonResponse(data, safe=False)


@require_auth
@require_http_methods(["GET"])
def course_by_slug(request):
    grade_str    = request.GET.get("grade",   "").strip()
    subject_slug = request.GET.get("subject", "").strip()

    if not grade_str or not subject_slug:
        return JsonResponse(
            {"error": "grade and subject query params are required"}, status=400
        )
    try:
        grade = int(grade_str)
    except ValueError:
        return JsonResponse({"error": "grade must be an integer"}, status=400)

    candidates = Course.objects.filter(grade=grade).select_related("subject")
    course = next(
        (c for c in candidates if _subject_matches_slug(c.subject.name, subject_slug)),
        None,
    )
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
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    from apps.academics.models import Subject
    subject_id = body.get("subject_id")
    grade      = body.get("grade")
    title      = body.get("title", "").strip()

    if not subject_id or not grade or not title:
        return JsonResponse(
            {"error": "subject_id, grade, and title are required"}, status=400
        )

    subject = get_object_or_404(Subject, id=subject_id)
    course  = Course.objects.create(
        subject=subject,
        grade=grade,
        title=title,
        description=body.get("description", ""),
        is_core=body.get("is_core", True),
    )
    logger.info("Course created: id=%s by user=%s", course.id, request.user.id)
    return JsonResponse({
        "id": course.id, "title": course.title, "grade": course.grade,
        "subject": subject.name, "subject_id": subject.id,
        "description": course.description, "is_core": course.is_core,
    }, status=201)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["PATCH"])
@csrf_exempt
def update_course(request, course_id):
    course = get_scoped_object_or_403(request.user, Course.objects.all(), id=course_id)
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    if "title"       in body: course.title       = body["title"].strip()
    if "description" in body: course.description = body["description"]
    if "is_core"     in body: course.is_core     = body["is_core"]
    course.save()
    return JsonResponse({"success": True, "id": course.id, "title": course.title})


@require_roles(["ADMIN"])
@require_http_methods(["DELETE"])
@csrf_exempt
def delete_course(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    course.delete()
    logger.info("Course deleted: id=%s by user=%s", course_id, request.user.id)
    return JsonResponse({"success": True})


# ─────────────────────────────────────────────────────────────────────────────
# LESSONS
# ─────────────────────────────────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def course_lessons(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    if not has_access_to_course(request.user, course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    user = request.user

    raw = list(
        Lesson.objects
        .filter(course=course)
        .order_by("order")
        .values("id", "title", "order", "video_url", "hls_manifest_url",
                "pdf_url", "content")
    )

    lesson_ids    = [l["id"] for l in raw]
    completed_ids = set(
        LessonProgress.objects
        .filter(user=user, lesson_id__in=lesson_ids, completed=True)
        .values_list("lesson_id", flat=True)
    )

    global_rows = [
        {
            "id":          l["id"],
            "title":       l["title"],
            "order":       l["order"],
            "type":        "global",
            "completed":   l["id"] in completed_ids,
            "has_video":   bool(l["video_url"] or l["hls_manifest_url"]),
            "has_pdf":     bool(l["pdf_url"]),
            "has_content": bool(l["content"]),
        }
        for l in raw
    ]

    section = (
        _get_student_section(user) if user.role == "STUDENT"
        else _get_teacher_section(user)
    )
    section_rows = []
    if section:
        for sl in (
            SectionLesson.objects
            .filter(course=course, section=section)
            .select_related("created_by")
            .order_by("order")
        ):
            section_rows.append({
                "id":            sl.id,
                "title":         sl.title,
                "order":         sl.order,
                "type":          "section",
                "completed":     False,
                "has_video":     bool(sl.video_url or sl.hls_manifest_url),
                "has_pdf":       bool(sl.pdf_url),
                "has_content":   bool(sl.content),
                "section_label": section.name,
                "created_by":    sl.created_by.username if sl.created_by else None,
            })

    combined = sorted(global_rows + section_rows, key=lambda x: x["order"])
    return JsonResponse(combined, safe=False)


@require_auth
@require_http_methods(["GET"])
def course_lessons_all(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    raw    = list(
        Lesson.objects
        .filter(course=course)
        .order_by("order")
        .values("id", "title", "order", "is_published",
                "video_url", "hls_manifest_url", "pdf_url", "content",
                "video_thumbnail_url", "video_duration")
    )
    lessons = [
        {
            "id":                  l["id"],
            "title":               l["title"],
            "order":               l["order"],
            "is_published":        l["is_published"],
            "video_url":           l["video_url"],
            "hls_manifest_url":    l["hls_manifest_url"],
            "video_thumbnail_url": l["video_thumbnail_url"],
            "video_duration":      l["video_duration"],
            "pdf_url":             l["pdf_url"],
            "has_video":           bool(l["video_url"] or l["hls_manifest_url"]),
            "has_pdf":             bool(l["pdf_url"]),
            "has_content":         bool(l["content"]),
        }
        for l in raw
    ]
    return JsonResponse(lessons, safe=False)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def create_lesson(request, course_id):
    course = get_scoped_object_or_403(request.user, Course.objects.all(), id=course_id)
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    title = body.get("title", "").strip()
    if not title:
        return JsonResponse({"error": "title is required"}, status=400)

    last_order = (
        Lesson.objects.filter(course=course)
        .order_by("-order").values_list("order", flat=True).first()
    )
    order = (last_order or 0) + 1

    lesson = Lesson.objects.create(
        course=course,
        title=title,
        order=body.get("order", order),
        content=body.get("content", ""),
        video_url=body.get("video_url") or None,
        hls_manifest_url=body.get("hls_manifest_url") or None,
        video_thumbnail_url=body.get("video_thumbnail_url") or None,
        video_duration=body.get("video_duration", ""),
        pdf_url=body.get("pdf_url") or None,
        is_published=body.get("is_published", False),
    )
    logger.info("Lesson created: id=%s course=%s by user=%s", lesson.id, course_id, request.user.id)
    return JsonResponse({
        "id":          lesson.id,
        "title":       lesson.title,
        "order":       lesson.order,
        "is_published": lesson.is_published,
        "has_video":   bool(lesson.video_url or lesson.hls_manifest_url),
        "has_pdf":     bool(lesson.pdf_url),
        "has_content": bool(lesson.content),
    }, status=201)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION LESSONS
# ─────────────────────────────────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET", "POST"])
@csrf_exempt
def section_lesson_list_create(request, course_id):
    course = get_object_or_404(Course, id=course_id)

    if request.method == "GET":
        user    = request.user
        section = (
            _get_student_section(user) if user.role == "STUDENT"
            else _get_teacher_section(user)
        )
        if not section:
            return JsonResponse([], safe=False)

        data = [
            {
                "id":          sl.id,
                "title":       sl.title,
                "order":       sl.order,
                "has_video":   bool(sl.video_url or sl.hls_manifest_url),
                "has_pdf":     bool(sl.pdf_url),
                "has_content": bool(sl.content),
                "created_by":  sl.created_by.username if sl.created_by else None,
            }
            for sl in SectionLesson.objects
            .filter(course=course, section=section)
            .select_related("created_by")
            .order_by("order")
        ]
        return JsonResponse(data, safe=False)

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
    section    = get_object_or_404(Section, id=section_id)
    last_order = (
        SectionLesson.objects.filter(course=course, section=section)
        .order_by("-order").values_list("order", flat=True).first()
    )
    order = (last_order or 0) + 1

    sl = SectionLesson.objects.create(
        course=course, section=section,
        title=title,
        order=body.get("order", order),
        content=body.get("content", ""),
        video_url=body.get("video_url") or None,
        hls_manifest_url=body.get("hls_manifest_url") or None,
        video_thumbnail_url=body.get("video_thumbnail_url") or None,
        video_duration=body.get("video_duration", ""),
        pdf_url=body.get("pdf_url") or None,
        created_by=request.user,
    )
    return JsonResponse({"id": sl.id, "title": sl.title, "order": sl.order}, status=201)


# ─────────────────────────────────────────────────────────────────────────────
# LESSON DETAIL + CRUD
# ─────────────────────────────────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def lesson_detail(request, lesson_id):
    lesson = get_object_or_404(
        Lesson.objects.select_related("course__subject"), id=lesson_id
    )
    if not has_access_to_course(request.user, lesson.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    progress, _ = LessonProgress.objects.get_or_create(
        user=request.user, lesson=lesson,
        defaults={"completed": False, "last_position": 0},
    )
    progress.mark_opened()

    # Notes — students only see is_visible_to_students=True
    notes_qs = LessonNote.objects.filter(lesson=lesson).select_related("author")
    if request.user.role == "STUDENT":
        notes_qs = notes_qs.filter(is_visible_to_students=True)

    notes = [
        {
            "id":              n.id,
            "content":         n.content,
            "author__username": n.author.username,
            "created_at":      n.created_at.isoformat(),
        }
        for n in notes_qs.order_by("created_at")
    ]

    return JsonResponse({
        "id":                  lesson.id,
        "title":               lesson.title,
        "order":               lesson.order,
        "content":             lesson.content,
        "video_url":           lesson.video_url,
        "hls_manifest_url":    lesson.hls_manifest_url,
        "video_thumbnail_url": lesson.video_thumbnail_url,
        "video_duration":      lesson.video_duration,
        "pdf_url":             lesson.pdf_url,
        "thumbnail_url":       lesson.thumbnail_url,
        "has_video":           bool(lesson.video_url or lesson.hls_manifest_url),
        "has_pdf":             bool(lesson.pdf_url),
        "has_content":         bool(lesson.content),
        "completed":           progress.completed,
        "last_position":       progress.last_position,
        "notes":               notes,
        "course": {
            "id":      lesson.course_id,
            "title":   lesson.course.title,
            "grade":   lesson.course.grade,
            "subject": lesson.course.subject.name,
        },
    })


@require_auth
@require_http_methods(["GET"])
def section_lesson_detail(request, lesson_id):
    sl = get_object_or_404(
        SectionLesson.objects.select_related("course__subject", "section"),
        id=lesson_id,
    )
    if not has_access_to_course(request.user, sl.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    return JsonResponse({
        "id":                  sl.id,
        "title":               sl.title,
        "order":               sl.order,
        "content":             sl.content,
        "video_url":           sl.video_url,
        "hls_manifest_url":    sl.hls_manifest_url,
        "video_thumbnail_url": sl.video_thumbnail_url,
        "video_duration":      sl.video_duration,
        "pdf_url":             sl.pdf_url,
        "has_video":           bool(sl.video_url or sl.hls_manifest_url),
        "has_pdf":             bool(sl.pdf_url),
        "has_content":         bool(sl.content),
        "section_id":          sl.section_id,
        "course_id":           sl.course_id,
        "grade":               sl.course.grade,
        "subject_name":        sl.course.subject.name,
    })


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["PATCH"])
@csrf_exempt
def update_lesson(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    for field in (
        "title", "content", "video_url", "hls_manifest_url",
        "video_thumbnail_url", "video_duration", "pdf_url",
        "thumbnail_url", "is_published",
    ):
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
    sl = get_object_or_404(SectionLesson, id=lesson_id)
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    for field in (
        "title", "content", "video_url", "hls_manifest_url",
        "video_thumbnail_url", "video_duration", "pdf_url", "is_published",
    ):
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
    lesson = get_object_or_404(Lesson, id=lesson_id)
    lesson.delete()
    logger.info("Lesson deleted: id=%s by user=%s", lesson_id, request.user.id)
    return JsonResponse({"success": True})


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["DELETE"])
@csrf_exempt
def delete_section_lesson(request, lesson_id):
    sl = get_object_or_404(SectionLesson, id=lesson_id)
    sl.delete()
    return JsonResponse({"success": True})


# ─────────────────────────────────────────────────────────────────────────────
# LESSON PROGRESS
# ─────────────────────────────────────────────────────────────────────────────

@require_auth
@require_http_methods(["POST", "PATCH"])
@csrf_exempt
def lesson_progress(request, lesson_id):
    """
    POST or PATCH /api/v1/lessons/<id>/progress/

    FIX 2026-03-18: frontend sends PATCH but the decorator previously only
    allowed POST → 405. Now accepts both (identical semantics).
    """
    lesson = get_object_or_404(Lesson, id=lesson_id)
    if not has_access_to_course(request.user, lesson.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    progress, _ = LessonProgress.objects.get_or_create(
        user=request.user, lesson=lesson,
        defaults={"completed": False, "last_position": 0},
    )
    if body.get("completed"):
        progress.completed = True
    if "last_position" in body:
        progress.last_position = int(body["last_position"])
    progress.save()

    return JsonResponse({
        "completed":     progress.completed,
        "last_position": progress.last_position,
    })


@require_auth
@require_http_methods(["POST"])
@csrf_exempt
def add_lesson_note(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)
    if not has_access_to_course(request.user, lesson.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    content = body.get("content", body.get("text", "")).strip()
    if not content:
        return JsonResponse({"error": "content is required"}, status=400)

    note = LessonNote.objects.create(
        author=request.user,
        lesson=lesson,
        content=content,
    )
    return JsonResponse({"id": note.id, "content": note.content}, status=201)


# ─────────────────────────────────────────────────────────────────────────────
# COURSE PROGRESS
# ─────────────────────────────────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def course_progress(request, course_id):
    """
    GET /api/v1/courses/<id>/progress/

    FIX 2026-03-18: added resume_lesson_id — the ID of the first lesson the
    student has not yet completed, in lesson order.
    """
    course = get_object_or_404(Course, id=course_id)
    if not has_access_to_course(request.user, course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    lessons = list(
        Lesson.objects
        .filter(course=course, is_published=True)
        .order_by("order")
        .values("id")
    )
    total = len(lessons)

    if total == 0:
        return JsonResponse({
            "course_id":         course_id,
            "total_lessons":     0,
            "completed_lessons": 0,
            "percentage":        0,
            "resume_lesson_id":  None,
        })

    lesson_ids = [l["id"] for l in lessons]
    completed_ids = set(
        LessonProgress.objects.filter(
            user=request.user,
            lesson_id__in=lesson_ids,
            completed=True,
        ).values_list("lesson_id", flat=True)
    )

    completed = len(completed_ids)
    percentage = round((completed / total) * 100) if total else 0

    resume_lesson_id = next(
        (l["id"] for l in lessons if l["id"] not in completed_ids),
        None,
    )

    return JsonResponse({
        "course_id":         course_id,
        "total_lessons":     total,
        "completed_lessons": completed,
        "percentage":        percentage,
        "resume_lesson_id":  resume_lesson_id,
    })


# ─────────────────────────────────────────────────────────────────────────────
# TEACHER ANALYTICS
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def teacher_course_analytics(request):
    """
    BUG FIX 2026-03-22:
    For TEACHER: scope_queryset() follows the institution path, returning ALL
    courses in the institution across all grades and subjects. Correct behaviour
    is to scope by the teacher's own assigned subjects only.
    PRINCIPAL / OFFICIAL / ADMIN keep institution/district scoping via scope_queryset.
    """
    user = request.user
    if user.role == "TEACHER":
        subject_ids = (
            user.teaching_assignments
            .values_list("subject_id", flat=True)
            .distinct()
        )
        qs = Course.objects.filter(
            subject_id__in=subject_ids
        ).select_related("subject")
    else:
        qs = scope_queryset(user, Course.objects.select_related("subject"))

    data = []
    for course in qs:
        total_lessons      = Lesson.objects.filter(course=course, is_published=True).count()
        enrolled_students  = (
            LessonProgress.objects.filter(lesson__course=course)
            .values("user").distinct().count()
        )
        completed_students = (
            LessonProgress.objects.filter(lesson__course=course, completed=True)
            .values("user").distinct().count()
        )
        completed_lessons = (
            LessonProgress.objects.filter(lesson__course=course, completed=True)
            .values("lesson").distinct().count()
        )
        percentage = round(completed_lessons / total_lessons * 100) if total_lessons else 0
        data.append({
            "course_id":          course.id,
            "title":              course.title,
            "grade":              course.grade,
            "subject":            course.subject.name,
            "total_lessons":      total_lessons,
            "completed_lessons":  completed_lessons,
            "percentage":         percentage,
            "enrolled_students":  enrolled_students,
            "completed_students": completed_students,
        })
    return JsonResponse(data, safe=False)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def teacher_lesson_analytics(request):
    course_id = request.GET.get("course_id")
    if not course_id:
        return JsonResponse({"error": "course_id is required"}, status=400)

    course  = get_scoped_object_or_403(request.user, Course.objects.all(), id=course_id)

    # Single query: annotate views + completions for all lessons at once
    from django.db.models import Count as _Count
    lessons = (
        Lesson.objects
        .filter(course=course)
        .annotate(
            view_count=_Count("lessonprogress"),
            completed_count=_Count("lessonprogress", filter=Q(lessonprogress__completed=True)),
        )
        .order_by("order")
    )
    data = [
        {
            "id": l.id, "title": l.title, "order": l.order,
            "views":     l.view_count,
            "completed": l.completed_count,
        }
        for l in lessons
    ]
    return JsonResponse(data, safe=False)



@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def teacher_class_analytics(request):
    user = request.user
    if user.role == "TEACHER":
        classroom_ids = (
            user.teaching_assignments
            .values_list("section__classroom_id", flat=True).distinct()
        )
        classrooms = ClassRoom.objects.filter(
            id__in=classroom_ids
        ).select_related("institution")
    else:
        classrooms = scope_queryset(user, ClassRoom.objects.select_related("institution"))

    data = []
    
    # Try to import StudentRiskScore inside to avoid circular imports just in case
    try:
        from apps.analytics.models import StudentRiskScore
        has_risk_models = True
    except ImportError:
        has_risk_models = False

    for c in classrooms:
        students_qs = User.objects.filter(role="STUDENT", section__classroom=c)
        total_students = students_qs.count()
        attempts = AssessmentAttempt.objects.filter(
            user__section__classroom=c, submitted_at__isnull=False
        )
        total_att = attempts.count()
        pass_att  = attempts.filter(passed=True).count()
        pass_rate = round(pass_att / total_att * 100) if total_att else 0
        
        high_risk_count = 0
        medium_risk_count = 0
        
        if has_risk_models and total_students > 0:
            student_ids = students_qs.values_list("id", flat=True)
            risks = StudentRiskScore.objects.filter(student_id__in=student_ids)
            for r in risks:
                if r.risk_level == "HIGH":
                    high_risk_count += 1
                elif r.risk_level == "MEDIUM":
                    medium_risk_count += 1
            
        data.append({
            "class_id":       c.id,
            "class_name":     c.name,
            "institution":    c.institution.name if c.institution else None,
            "total_students": total_students,
            "total_attempts": total_att,
            "pass_rate":      pass_rate,
            "high_risk_count": high_risk_count,
            "medium_risk_count": medium_risk_count,
        })
    return JsonResponse(data, safe=False)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def teacher_class_students(request, class_id):
    classroom = get_object_or_404(ClassRoom, id=class_id)
    students  = list(User.objects.filter(role="STUDENT", section__classroom=classroom))

    # Fetch risk scores
    try:
        from apps.analytics.models import StudentRiskScore
        student_ids = [s.id for s in students]
        risk_map = {
            r["user_id"]: {"risk_level": r["risk_level"], "risk_score": r["score"]}
            for r in StudentRiskScore.objects.filter(user_id__in=student_ids)
                .values("user_id", "risk_level", "score")
        }
    except Exception:
        risk_map = {}


    # Bulk-aggregate lesson progress — 2 queries total instead of 2N
    from django.db.models import Count as _Count
    progress_qs = (
        LessonProgress.objects
        .filter(user__in=students)
        .values("user_id")
        .annotate(total=_Count("id"), completed=_Count("id", filter=Q(completed=True)))
    )
    progress_map = {row["user_id"]: row for row in progress_qs}

    data = [
        {
            "id":                s.id,
            "username":          s.username,
            "display_name":      s.display_name,
            "total_lessons":     progress_map.get(s.id, {}).get("total", 0),
            "completed_lessons": progress_map.get(s.id, {}).get("completed", 0),
            "risk_level":        risk_map.get(s.id, {}).get("risk_level", "LOW"),
            "risk_score":        risk_map.get(s.id, {}).get("risk_score", 0),
        }
        for s in students
    ]
    return JsonResponse(data, safe=False)



@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def teacher_assessment_analytics(request):
    user = request.user
    if user.role == "TEACHER":
        subject_ids = (
            user.teaching_assignments.values_list("subject_id", flat=True).distinct()
        )
        assessments = Assessment.objects.filter(
            course__subject_id__in=subject_ids
        ).select_related("course__subject")
    else:
        course_ids  = list(
            scope_queryset(user, Course.objects.all()).values_list("id", flat=True)
        )
        assessments = Assessment.objects.filter(
            course_id__in=course_ids
        ).select_related("course__subject")

    data = []
    for a in assessments:
        attempts = AssessmentAttempt.objects.filter(
            assessment=a, submitted_at__isnull=False
        )
        total_att       = attempts.count()
        pass_count      = attempts.filter(passed=True).count()
        fail_count      = total_att - pass_count
        pass_rate       = round(pass_count / total_att * 100) if total_att else 0
        unique_students = attempts.values("user").distinct().count()
        avg_score       = round(attempts.aggregate(avg=Avg("score"))["avg"] or 0, 1)
        data.append({
            "assessment_id":   a.id,
            "title":           a.title,
            "grade":           a.course.grade,
            "subject":         a.course.subject.name,
            "course":          a.course.title,
            "course_id":       a.course_id,
            "total_marks":     a.total_marks,
            "pass_marks":      a.pass_marks,
            "total_attempts":  total_att,
            "unique_students": unique_students,
            "pass_count":      pass_count,
            "fail_count":      fail_count,
            "pass_rate":       pass_rate,
            "average_score":   avg_score,
        })
    return JsonResponse(data, safe=False)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def teacher_student_assessments(request, class_id, student_id):
    classroom  = get_object_or_404(ClassRoom, id=class_id)
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
    return JsonResponse({
        "student_id": student.id,
        "username":   student.username,
        "attempts": [
            {
                "assessment_id":    a.assessment.id,
                "assessment_title": a.assessment.title,
                "score":            a.score,
                "passed":           a.passed,
                "submitted_at":     a.submitted_at.isoformat(),
            }
            for a in attempts
        ],
    })


# ─────────────────────────────────────────────────────────────────────────────
# MEDIA PROXY
# Streams R2 / Cloudflare media through the backend so the browser can fetch
# it without hitting CORS restrictions on the R2 bucket.
# Only authenticated users can use it; URL must be from the configured R2 domain.
# ─────────────────────────────────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def media_proxy(request):
    """
    GET /api/v1/media-proxy/?url=https://pub-…r2.dev/videos/xxx.mp4

    Streams R2 content to the browser using chunked transfer.
    Django never buffers the full file — bytes flow straight through.
    Survives large videos without memory pressure.
    """
    import urllib.request as _urllib
    import os
    from django.http import StreamingHttpResponse

    url = request.GET.get("url", "").strip()
    if not url:
        return JsonResponse({"error": "url param required"}, status=400)

    r2_base = os.environ.get("CLOUDFLARE_R2_PUBLIC_URL", "")
    if not (url.startswith(r2_base) or ".r2.dev/" in url):
        return JsonResponse({"error": "Forbidden URL"}, status=403)

    try:
        req = _urllib.Request(url, headers={"User-Agent": "GyanGrit-MediaProxy/1.0"})
        upstream = _urllib.urlopen(req, timeout=120)
    except Exception as exc:
        logger.warning("media_proxy open failed for %s: %s", url, exc)
        return JsonResponse({"error": "Failed to fetch media"}, status=502)

    content_type = upstream.headers.get("Content-Type", "application/octet-stream")
    content_length = upstream.headers.get("Content-Length", "")

    def _stream(conn):
        try:
            while True:
                chunk = conn.read(256 * 1024)  # 256 KB chunks
                if not chunk:
                    break
                yield chunk
        finally:
            conn.close()

    response = StreamingHttpResponse(_stream(upstream), content_type=content_type)
    if content_length:
        response["Content-Length"] = content_length
    response["Cache-Control"]               = "private, max-age=3600"
    response["Access-Control-Allow-Origin"] = "*"
    return response

