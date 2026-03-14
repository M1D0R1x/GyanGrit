import json
import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db.models import Avg, Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from apps.academics.models import ClassRoom
from apps.accesscontrol.scoped_service import scope_queryset, get_scoped_object_or_403
from apps.assessments.models import Assessment, AssessmentAttempt
from apps.content.models import Course
from apps.learning.models import Enrollment

User = get_user_model()
logger = logging.getLogger(__name__)


# =====================================================
# INTERNAL: Course access check
#
# Subject has no institution field — institution scope is
# determined by ClassSubject (which classrooms teach this subject).
#
# Access rules:
# - ADMIN: always
# - STUDENT: must be enrolled in the course
# - TEACHER: must have a TeachingAssignment for the course's subject
# - PRINCIPAL: course subject must be taught in their institution
# - OFFICIAL: course subject must be taught in their district
# =====================================================

def has_access_to_course(user, course):
    """
    Returns True if the user is permitted to access this course's assessments.
    """
    if not user.is_authenticated:
        return False

    if user.is_superuser or user.role == "ADMIN":
        return True

    if user.role == "STUDENT":
        return Enrollment.objects.filter(
            user=user,
            course=course,
        ).exists()

    if user.role == "TEACHER":
        return user.teaching_assignments.filter(
            subject=course.subject,
        ).exists()

    if user.role == "PRINCIPAL":
        if not user.institution:
            return False
        # Course is accessible if its subject is taught in any classroom
        # of the principal's institution
        return course.subject.classrooms.filter(
            classroom__institution=user.institution,
        ).exists()

    if user.role == "OFFICIAL":
        if not user.district:
            return False
        return course.subject.classrooms.filter(
            classroom__institution__district__name=user.district,
        ).exists()

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
        .values("id", "title", "description", "total_marks", "pass_marks")
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
    for q in assessment.questions.prefetch_related("options").order_by("order"):
        questions.append({
            "id": q.id,
            "text": q.text,
            "marks": q.marks,
            "order": q.order,
            # Options returned WITHOUT is_correct — never expose answer to client
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

    # Return existing active attempt if one exists
    active_attempt = AssessmentAttempt.objects.filter(
        user=request.user,
        assessment=assessment,
        submitted_at__isnull=True,
    ).first()

    if active_attempt:
        return JsonResponse({
            "attempt_id": active_attempt.id,
            "message": "Active attempt exists",
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
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    attempt_id = body.get("attempt_id")
    selected_options = body.get("selected_options", {})

    if not attempt_id:
        return JsonResponse({"error": "attempt_id is required"}, status=400)

    attempt = get_object_or_404(
        AssessmentAttempt,
        id=attempt_id,
        assessment_id=assessment_id,
        user=request.user,
    )

    if attempt.submitted_at:
        return JsonResponse({"detail": "Already submitted"}, status=400)

    try:
        attempt.submit(selected_options)
    except Exception:
        logger.exception(
            "Failed to submit attempt id=%s for user id=%s",
            attempt_id,
            request.user.id,
        )
        return JsonResponse({"error": "Submission failed"}, status=500)

    return JsonResponse({
        "attempt_id": attempt.id,
        "score": attempt.score,
        "passed": attempt.passed,
        "total_marks": attempt.assessment.total_marks,
        "pass_marks": attempt.assessment.pass_marks,
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
        .values("id", "score", "passed", "started_at", "submitted_at")
        .order_by("-started_at")
    )
    return JsonResponse(list(attempts), safe=False)


# =====================================================
# TEACHER / ADMIN ASSESSMENT ANALYTICS
# =====================================================

@login_required
@require_http_methods(["GET"])
def teacher_assessment_analytics(request):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    if request.user.role == "TEACHER":
        subject_ids = request.user.teaching_assignments.values_list(
            "subject_id", flat=True
        )
        assessments = Assessment.objects.filter(
            course__subject_id__in=subject_ids
        )

    elif request.user.role == "PRINCIPAL":
        if not request.user.institution:
            return JsonResponse({"detail": "No institution assigned"}, status=400)
        assessments = Assessment.objects.filter(
            course__subject__classrooms__classroom__institution=request.user.institution
        ).distinct()

    elif request.user.role == "OFFICIAL":
        if not request.user.district:
            return JsonResponse({"detail": "No district assigned"}, status=400)
        assessments = Assessment.objects.filter(
            course__subject__classrooms__classroom__institution__district__name=request.user.district
        ).distinct()

    else:  # ADMIN
        assessments = Assessment.objects.all()

    data = []
    for assessment in assessments.select_related("course", "course__subject"):
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
            "subject": assessment.course.subject.name if assessment.course.subject else None,
            "total_attempts": total_attempts,
            "unique_students": unique_students,
            "average_score": round(avg_score, 2),
            "pass_count": pass_count,
            "fail_count": total_attempts - pass_count,
            "pass_rate": round(pass_rate, 2),
        })

    return JsonResponse(data, safe=False)


# =====================================================
# TEACHER CLASS ANALYTICS
# Optimised: uses a single aggregated query per classroom
# instead of N+1 pattern.
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
        if not request.user.institution:
            return JsonResponse({"detail": "No institution assigned"}, status=400)
        classes = ClassRoom.objects.filter(institution=request.user.institution)

    elif request.user.role == "OFFICIAL":
        if not request.user.district:
            return JsonResponse({"detail": "No district assigned"}, status=400)
        classes = ClassRoom.objects.filter(
            institution__district__name=request.user.district
        )

    else:  # ADMIN
        classes = ClassRoom.objects.all()

    classes = classes.select_related("institution")

    data = []
    for classroom in classes:
        # Single aggregated query per classroom instead of separate
        # students query + attempts query
        student_ids = list(
            User.objects.filter(
                role="STUDENT",
                section__classroom=classroom,
            ).values_list("id", flat=True)
        )

        total_students = len(student_ids)

        if student_ids:
            attempts = AssessmentAttempt.objects.filter(
                user_id__in=student_ids,
                submitted_at__isnull=False,
            )
            agg = attempts.aggregate(
                total=Count("id"),
                avg=Avg("score"),
                passes=Count("id", filter=Q(passed=True)),
            )
            total_attempts = agg["total"] or 0
            avg_score = agg["avg"] or 0
            pass_count = agg["passes"] or 0
        else:
            total_attempts = 0
            avg_score = 0
            pass_count = 0

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


# =====================================================
# TEACHER CLASS STUDENTS
# =====================================================

@login_required
@require_http_methods(["GET"])
def teacher_class_students(request, class_id):
    classroom = get_scoped_object_or_403(
        request.user, ClassRoom.objects, id=class_id
    )

    if request.user.role == "TEACHER":
        if not request.user.teaching_assignments.filter(
            section__classroom=classroom
        ).exists():
            return JsonResponse({"detail": "Forbidden"}, status=403)

    students = User.objects.filter(
        role="STUDENT",
        section__classroom=classroom,
    )

    data = []
    for student in students:
        attempts = AssessmentAttempt.objects.filter(
            user=student,
            submitted_at__isnull=False,
        )
        agg = attempts.aggregate(
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


# =====================================================
# TEACHER STUDENT ASSESSMENTS
# =====================================================

@login_required
@require_http_methods(["GET"])
def teacher_student_assessments(request, class_id, student_id):
    classroom = get_scoped_object_or_403(
        request.user, ClassRoom.objects, id=class_id
    )
    student_qs = scope_queryset(
        request.user,
        User.objects.filter(role="STUDENT"),
    )
    student = get_object_or_404(student_qs, id=student_id)

    if student.section and student.section.classroom != classroom:
        return JsonResponse(
            {"detail": "Student not in this class"},
            status=400,
        )

    attempts = (
        AssessmentAttempt.objects
        .filter(user=student, submitted_at__isnull=False)
        .select_related("assessment")
        .order_by("-submitted_at")
    )

    data = [
        {
            "assessment_id": attempt.assessment.id,
            "assessment_title": attempt.assessment.title,
            "score": attempt.score,
            "passed": attempt.passed,
            "submitted_at": attempt.submitted_at.isoformat(),
        }
        for attempt in attempts
    ]

    return JsonResponse({
        "student_id": student.id,
        "username": student.username,
        "attempts": data,
    })