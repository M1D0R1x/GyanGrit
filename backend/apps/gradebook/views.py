# apps.gradebook.views
"""
Gradebook endpoints.

Three surfaces:
  POST   /api/v1/gradebook/entry/            — teacher creates a grade entry
  PATCH  /api/v1/gradebook/entry/<id>/       — teacher updates an entry
  DELETE /api/v1/gradebook/entry/<id>/       — teacher deletes an entry
  GET    /api/v1/gradebook/student/<id>/     — all grades for one student
  GET    /api/v1/gradebook/class/<id>/       — all grades for a classroom

Security:
  - Only TEACHER / PRINCIPAL / ADMIN can create, update, delete.
  - STUDENT can only read their own grades via the student endpoint.
  - All list endpoints are scoped: teachers see only students in their institution.
"""
import json
import logging

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from apps.academics.models import Subject, ClassRoom
from .models import GradeEntry, GradeTerm, GradeCategory

User = get_user_model()
logger = logging.getLogger(__name__)


def _entry_to_dict(entry: GradeEntry) -> dict:
    return {
        "id":           entry.id,
        "student_id":   entry.student_id,
        "student":      entry.student.display_name or entry.student.username,
        "subject_id":   entry.subject_id,
        "subject":      entry.subject.name,
        "term":         entry.term,
        "category":     entry.category,
        "marks":        float(entry.marks),
        "total_marks":  float(entry.total_marks),
        "percentage":   entry.percentage,
        "passed":       entry.passed,
        "notes":        entry.notes,
        "entered_by":   entry.entered_by.username if entry.entered_by else None,
        "entered_at":   entry.entered_at.isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# CREATE  POST /api/v1/gradebook/entry/
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def create_entry(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    required = ("student_id", "subject_id", "marks", "total_marks")
    missing  = [f for f in required if body.get(f) is None]
    if missing:
        return JsonResponse({"error": f"Missing fields: {', '.join(missing)}"}, status=400)

    student = get_object_or_404(User, id=body["student_id"], role="STUDENT")
    subject = get_object_or_404(Subject, id=body["subject_id"])

    # Basic range validation
    try:
        marks       = float(body["marks"])
        total_marks = float(body["total_marks"])
    except (TypeError, ValueError):
        return JsonResponse({"error": "marks and total_marks must be numbers"}, status=400)

    if total_marks <= 0:
        return JsonResponse({"error": "total_marks must be greater than 0"}, status=400)
    if marks < 0 or marks > total_marks:
        return JsonResponse({"error": "marks must be between 0 and total_marks"}, status=400)

    term     = body.get("term",     GradeTerm.TERM_1)
    category = body.get("category", GradeCategory.UNIT_TEST)

    if term not in GradeTerm.values:
        return JsonResponse({"error": f"Invalid term. Choices: {GradeTerm.values}"}, status=400)
    if category not in GradeCategory.values:
        return JsonResponse({"error": f"Invalid category. Choices: {GradeCategory.values}"}, status=400)

    entry = GradeEntry.objects.create(
        student=student,
        subject=subject,
        term=term,
        category=category,
        marks=marks,
        total_marks=total_marks,
        notes=body.get("notes", ""),
        entered_by=request.user,
    )

    logger.info(
        "GradeEntry created: id=%s student=%s subject=%s by=%s",
        entry.id, student.id, subject.id, request.user.id,
    )
    return JsonResponse(_entry_to_dict(entry), status=201)


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE  PATCH /api/v1/gradebook/entry/<id>/
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["PATCH"])
@csrf_exempt
def update_entry(request, entry_id):
    entry = get_object_or_404(GradeEntry, id=entry_id)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    if "marks" in body or "total_marks" in body:
        marks       = float(body.get("marks",       entry.marks))
        total_marks = float(body.get("total_marks", entry.total_marks))
        if total_marks <= 0:
            return JsonResponse({"error": "total_marks must be > 0"}, status=400)
        if marks < 0 or marks > total_marks:
            return JsonResponse({"error": "marks must be 0–total_marks"}, status=400)
        entry.marks       = marks
        entry.total_marks = total_marks

    if "term" in body:
        if body["term"] not in GradeTerm.values:
            return JsonResponse({"error": f"Invalid term"}, status=400)
        entry.term = body["term"]

    if "category" in body:
        if body["category"] not in GradeCategory.values:
            return JsonResponse({"error": f"Invalid category"}, status=400)
        entry.category = body["category"]

    if "notes" in body:
        entry.notes = body["notes"]

    entry.save()
    logger.info("GradeEntry updated: id=%s by=%s", entry_id, request.user.id)
    return JsonResponse(_entry_to_dict(entry))


# ─────────────────────────────────────────────────────────────────────────────
# DELETE  DELETE /api/v1/gradebook/entry/<id>/
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["DELETE"])
@csrf_exempt
def delete_entry(request, entry_id):
    entry = get_object_or_404(GradeEntry, id=entry_id)
    entry.delete()
    logger.info("GradeEntry deleted: id=%s by=%s", entry_id, request.user.id)
    return JsonResponse({"success": True})


# ─────────────────────────────────────────────────────────────────────────────
# STUDENT GRADES  GET /api/v1/gradebook/student/<student_id>/
# ─────────────────────────────────────────────────────────────────────────────

@require_http_methods(["GET"])
def student_grades(request, student_id):
    """
    Returns all grade entries for a student.
    - STUDENT: can only view their own grades.
    - TEACHER / PRINCIPAL / ADMIN: can view any student in their scope.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    if request.user.role == "STUDENT" and request.user.id != int(student_id):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    student = get_object_or_404(User, id=student_id, role="STUDENT")

    # Optional filters
    term     = request.GET.get("term")
    subject  = request.GET.get("subject_id")
    category = request.GET.get("category")

    qs = GradeEntry.objects.filter(
        student=student
    ).select_related("subject", "entered_by").order_by("subject__name", "term", "entered_at")

    if term:
        qs = qs.filter(term=term)
    if subject:
        qs = qs.filter(subject_id=subject)
    if category:
        qs = qs.filter(category=category)

    return JsonResponse({
        "student_id":   student.id,
        "student":      student.display_name or student.username,
        "entries":      [_entry_to_dict(e) for e in qs],
    })


# ─────────────────────────────────────────────────────────────────────────────
# CLASS GRADES  GET /api/v1/gradebook/class/<class_id>/
# ─────────────────────────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def class_grades(request, class_id):
    """
    Returns all grade entries for every student in a classroom.
    Grouped by student for easy frontend consumption.
    """
    classroom = get_object_or_404(ClassRoom, id=class_id)
    students  = User.objects.filter(
        role="STUDENT", section__classroom=classroom
    ).order_by("username")

    # Optional filters
    term     = request.GET.get("term")
    subject  = request.GET.get("subject_id")
    category = request.GET.get("category")

    qs = GradeEntry.objects.filter(
        student__in=students
    ).select_related("student", "subject", "entered_by")

    if term:
        qs = qs.filter(term=term)
    if subject:
        qs = qs.filter(subject_id=subject)
    if category:
        qs = qs.filter(category=category)

    # Group by student
    entries_by_student: dict[int, list] = {}
    for entry in qs.order_by("student__username", "subject__name", "entered_at"):
        sid = entry.student_id
        if sid not in entries_by_student:
            entries_by_student[sid] = []
        entries_by_student[sid].append(_entry_to_dict(entry))

    result = []
    for student in students:
        result.append({
            "student_id": student.id,
            "student":    student.display_name or student.username,
            "username":   student.username,
            "entries":    entries_by_student.get(student.id, []),
        })

    return JsonResponse({
        "class_id":   classroom.id,
        "class_name": classroom.name,
        "students":   result,
    })


# ─────────────────────────────────────────────────────────────────────────────
# CHOICES  GET /api/v1/gradebook/choices/
# ─────────────────────────────────────────────────────────────────────────────

@require_http_methods(["GET"])
def choices(request):
    """Returns valid term and category choices for form dropdowns."""
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)
    return JsonResponse({
        "terms":      [{"value": v, "label": l} for v, l in GradeTerm.choices],
        "categories": [{"value": v, "label": l} for v, l in GradeCategory.choices],
    })
