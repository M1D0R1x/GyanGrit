import json

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from django.utils import timezone

from apps.assessments.models import (
    Assessment,
    QuestionOption,
    AssessmentAttempt,
)
from apps.content.models import Course


@require_http_methods(["GET"])
def course_assessments(request, course_id):
    """
    List all published assessments for a course.
    """
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
    """
    Fetch assessment with questions (NO correct answers exposed).
    """
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
                {
                    "id": opt.id,
                    "text": opt.text,
                }
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
    """
    Create a new attempt.
    Authentication required.
    """

    if not request.user.is_authenticated:
        return JsonResponse(
            {"detail": "Authentication required"},
            status=401,
        )

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
    """
    Submit answers and calculate score.
    """

    if not request.user.is_authenticated:
        return JsonResponse(
            {"detail": "Authentication required"},
            status=401,
        )

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
        return JsonResponse(
            {"detail": "Attempt already submitted"},
            status=400,
        )

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
    """
    Return all attempts of the logged-in user
    for a given assessment.
    """

    if not request.user.is_authenticated:
        return JsonResponse(
            {"detail": "Authentication required"},
            status=401,
        )

    assessment = get_object_or_404(
        Assessment,
        id=assessment_id,
    )

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
