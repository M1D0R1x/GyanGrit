import json

from django.db.models import Avg
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required

from apps.assessments.models import (
    Assessment,
    AssessmentAttempt,
)
from apps.content.models import Course
from apps.accounts.models import ClassRoom, User


# =====================================================
# ACCESS CONTROL
# =====================================================

def has_access_to_course(user, course):

    if not user.is_authenticated:
        return False

    if user.role == "ADMIN":
        return True

    if not course.subject:
        return False

    if user.role == "OFFICIAL":
        return (
            course.subject.institution.district == user.district
        )

    if user.role == "PRINCIPAL":
        return (
            course.subject.institution == user.institution
        )

    if user.role == "TEACHER":
        return user.assignments.filter(
            subject=course.subject
        ).exists()

    if user.role == "STUDENT":
        return (
            user.section and
            user.section.classroom.institution
            == course.subject.institution
        )

    return False


# =====================================================
# COURSE ASSESSMENTS
# =====================================================

@login_required
@require_http_methods(["GET"])
def course_assessments(request, course_id):

    course = get_object_or_404(Course, id=course_id)

    if not has_access_to_course(request.user, course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    data = list(
        course.assessments
        .filter(is_published=True)
        .values(
            "id",
            "title",
            "description",
            "total_marks",
            "pass_marks",
        )
        .order_by("title")
    )

    return JsonResponse(data, safe=False)


# =====================================================
# ASSESSMENT DETAIL
# =====================================================

@login_required
@require_http_methods(["GET"])
def assessment_detail(request, assessment_id):

    assessment = get_object_or_404(
        Assessment,
        id=assessment_id,
        is_published=True,
    )

    if not has_access_to_course(request.user, assessment.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    questions = []

    for q in assessment.questions.all().order_by("order"):
        questions.append({
            "id": q.id,
            "text": q.text,
            "marks": q.marks,
            "order": q.order,
            "options": [
                {"id": opt.id, "text": opt.text}
                for opt in q.options.all()
            ],
        })

    return JsonResponse({
        "id": assessment.id,
        "title": assessment.title,
        "description": assessment.description,
        "total_marks": assessment.total_marks,
        "pass_marks": assessment.pass_marks,
        "questions": questions,
    })


# =====================================================
# START ASSESSMENT
# =====================================================

@login_required
@require_http_methods(["POST"])
def start_assessment(request, assessment_id):

    assessment = get_object_or_404(
        Assessment,
        id=assessment_id,
        is_published=True,
    )

    if not has_access_to_course(request.user, assessment.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    active_attempt = AssessmentAttempt.objects.filter(
        user=request.user,
        assessment=assessment,
        submitted_at__isnull=True
    ).first()

    if active_attempt:
        return JsonResponse({
            "attempt_id": active_attempt.id,
            "message": "Active attempt exists"
        })

    attempt = AssessmentAttempt.objects.create(
        assessment=assessment,
        user=request.user,
    )

    return JsonResponse({
        "attempt_id": attempt.id,
        "assessment_id": assessment.id,
        "started_at": attempt.started_at.isoformat(),
    })


# =====================================================
# SUBMIT ASSESSMENT
# =====================================================

@login_required
@require_http_methods(["POST"])
def submit_assessment(request, assessment_id):

    body = json.loads(request.body or "{}")
    attempt_id = body.get("attempt_id")
    selected_options = body.get("selected_options", {})

    attempt = get_object_or_404(
        AssessmentAttempt,
        id=attempt_id,
        assessment_id=assessment_id,
        user=request.user,
    )

    if attempt.submitted_at:
        return JsonResponse({"detail": "Already submitted"}, status=400)

    attempt.submit(selected_options)

    return JsonResponse({
        "attempt_id": attempt.id,
        "score": attempt.score,
        "passed": attempt.passed,
    })


# =====================================================
# MY ATTEMPTS
# =====================================================

@login_required
@require_http_methods(["GET"])
def my_attempts(request, assessment_id):

    assessment = get_object_or_404(Assessment, id=assessment_id)

    if not has_access_to_course(request.user, assessment.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    attempts = (
        AssessmentAttempt.objects
        .filter(
            assessment=assessment,
            user=request.user,
            submitted_at__isnull=False,
        )
        .values(
            "id",
            "score",
            "passed",
            "started_at",
            "submitted_at",
        )
        .order_by("-started_at")
    )

    return JsonResponse(list(attempts), safe=False)


# =====================================================
# TEACHER ASSESSMENT ANALYTICS
# =====================================================

@login_required
@require_http_methods(["GET"])
def teacher_assessment_analytics(request):

    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    if request.user.role == "TEACHER":
        subject_ids = request.user.assignments.values_list("subject_id", flat=True)
        assessments = Assessment.objects.filter(course__subject_id__in=subject_ids)

    elif request.user.role == "PRINCIPAL":
        assessments = Assessment.objects.filter(
            course__subject__institution=request.user.institution
        )

    elif request.user.role == "OFFICIAL":
        assessments = Assessment.objects.filter(
            course__subject__institution__district=request.user.district
        )

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
            "fail_count": fail_count,
            "pass_rate": round(pass_rate, 2),
        })

    return JsonResponse(data, safe=False)


# =====================================================
# TEACHER CLASS ANALYTICS
# =====================================================

@login_required
@require_http_methods(["GET"])
def teacher_class_analytics(request):

    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    if request.user.role == "TEACHER":
        classes = ClassRoom.objects.filter(
            sections__teaching_assignments__teacher=request.user
        ).distinct()

    elif request.user.role == "PRINCIPAL":
        classes = ClassRoom.objects.filter(
            institution=request.user.institution
        )

    elif request.user.role == "OFFICIAL":
        classes = ClassRoom.objects.filter(
            institution__district=request.user.district
        )

    else:
        classes = ClassRoom.objects.all()

    data = []

    for classroom in classes:

        students = User.objects.filter(
            role="STUDENT",
            section__classroom=classroom,
        )

        attempts = AssessmentAttempt.objects.filter(
            user__in=students,
            submitted_at__isnull=False,
        )

        total_students = students.count()
        total_attempts = attempts.count()
        avg_score = attempts.aggregate(avg=Avg("score"))["avg"] or 0
        pass_count = attempts.filter(passed=True).count()
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