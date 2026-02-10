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
    """
    assessment = get_object_or_404(
        Assessment,
        id=assessment_id,
        is_published=True,
    )

    attempt = AssessmentAttempt.objects.create(
        assessment=assessment,
        user=request.user if request.user.is_authenticated else None,
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

    Payload:
    {
        "attempt_id": 1,
        "answers": {
            "<question_id>": "<option_id>"
        }
    }
    """
    body = json.loads(request.body)

    attempt_id = body.get("attempt_id")
    answers = body.get("answers", {})

    attempt = get_object_or_404(
        AssessmentAttempt,
        id=attempt_id,
        assessment_id=assessment_id,
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

    attempt.score = score
    attempt.submitted_at = timezone.now()
    attempt.passed = score >= attempt.assessment.pass_marks
    attempt.save()

    return JsonResponse({
        "attempt_id": attempt.id,
        "score": attempt.score,
        "passed": attempt.passed,
    })
