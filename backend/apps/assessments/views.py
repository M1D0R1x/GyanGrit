import json

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.db.models import Avg

from apps.assessments.models import (
    Assessment,
    QuestionOption,
    AssessmentAttempt,
)
from apps.content.models import Course


@require_http_methods(["GET"])
def course_assessments(request, course_id):
    course = get_object_or_404(Course, id=course_id)

    data = list(
        Assessment.objects
        .filter(course=course, is_published=True)
        .values(
            "id",
            "title",
            "description",
            "total_marks",
            "pass_marks",
        )
    )

    return JsonResponse(data, safe=False)


@require_http_methods(["GET"])
def assessment_detail(request, assessment_id):
    assessment = get_object_or_404(
        Assessment,
        id=assessment_id,
        is_published=True,
    )

    questions = []
    for q in assessment.questions.all():
        questions.append({
            "id": q.id,
            "text": q.text,
            "marks": q.marks,
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


@require_http_methods(["POST"])
def start_assessment(request, assessment_id):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    if not request.user.institution:
        return JsonResponse({"detail": "No institution assigned"}, status=400)

    assessment = get_object_or_404(
        Assessment,
        id=assessment_id,
        is_published=True,
    )

    attempt = AssessmentAttempt.objects.create(
        assessment=assessment,
        user=request.user,
    )

    return JsonResponse({
        "attempt_id": attempt.id,
        "assessment_id": assessment.id,
        "started_at": attempt.started_at,
    })


@require_http_methods(["POST"])
def submit_assessment(request, assessment_id):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    body = json.loads(request.body)

    attempt_id = body.get("attempt_id")
    answers = body.get("answers", {})

    attempt = get_object_or_404(
        AssessmentAttempt,
        id=attempt_id,
        assessment_id=assessment_id,
        user=request.user,
    )

    if attempt.submitted_at is not None:
        return JsonResponse({"detail": "Already submitted"}, status=400)

    score = 0

    for question_id, option_id in answers.items():
        try:
            option = QuestionOption.objects.get(
                id=option_id,
                question_id=question_id,
            )
            if option.is_correct:
                score += option.question.marks
        except QuestionOption.DoesNotExist:
            continue

    attempt.answers = answers
    attempt.score = score
    attempt.submitted_at = timezone.now()
    attempt.passed = score >= attempt.assessment.pass_marks
    attempt.save()

    return JsonResponse({
        "attempt_id": attempt.id,
        "assessment_id": assessment_id,
        "score": attempt.score,
        "passed": attempt.passed,
    })


@require_http_methods(["GET"])
def my_attempts(request, assessment_id):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    assessment = get_object_or_404(Assessment, id=assessment_id)

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


@require_http_methods(["GET"])
def teacher_assessment_analytics(request):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    assessments = Assessment.objects.all()
    data = []

    for assessment in assessments:
        attempts = assessment.attempts.filter(
            submitted_at__isnull=False
        )

        if request.user.role == "TEACHER":
            attempts = attempts.filter(
                user__institution=request.user.institution
            )

        total_attempts = attempts.count()
        unique_students = attempts.values("user").distinct().count()
        avg_score = attempts.aggregate(avg=Avg("score"))["avg"] or 0
        pass_count = attempts.filter(passed=True).count()
        fail_count = attempts.filter(passed=False).count()

        pass_rate = (
            (pass_count / total_attempts) * 100
            if total_attempts > 0
            else 0
        )

        data.append({
            "assessment_id": assessment.id,
            "title": assessment.title,
            "total_attempts": total_attempts,
            "unique_students": unique_students,
            "average_score": round(avg_score, 2),
            "pass_count": pass_count,
            "fail_count": fail_count,
            "pass_rate": round(pass_rate, 2),
        })

    return JsonResponse(data, safe=False)


from django.db.models import Avg


@require_http_methods(["GET"])
def teacher_class_analytics(request):
    """
    Class-level assessment analytics.

    TEACHER:
        Only their classes.

    OFFICIAL / ADMIN:
        All classes.
    """

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    from apps.accounts.models import ClassRoom

    # Determine classes visible to user
    if request.user.role == "TEACHER":
        classes = request.user.teaching_classes.all()
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

        pass_rate = (
            (pass_count / total_attempts) * 100
            if total_attempts > 0
            else 0
        )

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

@require_http_methods(["GET"])
def teacher_class_students(request, class_id):
    """
    Student-level analytics for a class.
    """

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    from apps.accounts.models import ClassRoom

    classroom = get_object_or_404(ClassRoom, id=class_id)

    # Teacher restriction
    if request.user.role == "TEACHER":
        if classroom not in request.user.teaching_classes.all():
            return JsonResponse({"detail": "Forbidden"}, status=403)

    students = classroom.students.all()

    data = []

    for student in students:
        attempts = AssessmentAttempt.objects.filter(
            user=student,
            submitted_at__isnull=False,
        )

        total_attempts = attempts.count()
        avg_score = attempts.aggregate(avg=Avg("score"))["avg"] or 0
        pass_count = attempts.filter(passed=True).count()

        pass_rate = (
            (pass_count / total_attempts) * 100
            if total_attempts > 0
            else 0
        )

        data.append({
            "student_id": student.id,
            "username": student.username,
            "total_attempts": total_attempts,
            "average_score": round(avg_score, 2),
            "pass_rate": round(pass_rate, 2),
        })

    return JsonResponse(data, safe=False)
