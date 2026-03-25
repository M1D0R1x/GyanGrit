# apps.assessments.views
import json
import logging

from django.contrib.auth import get_user_model
from apps.accesscontrol.permissions import require_auth  # returns 401 JSON, not 302
from django.db.models import Avg, Count, Q, IntegerField
from django.db.models.functions import Cast
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.academics.models import ClassRoom
from apps.accesscontrol.permissions import require_roles
from apps.accesscontrol.scoped_service import scope_queryset, get_scoped_object_or_403
from apps.assessments.models import Assessment, AssessmentAttempt, Question, QuestionOption
from apps.content.models import Course
from apps.learning.models import Enrollment

User = get_user_model()
logger = logging.getLogger(__name__)


# =====================================================
# ACCESS CHECK
# =====================================================

def has_access_to_course(user, course):
    if not user.is_authenticated:
        return False
    if user.is_superuser or user.role == "ADMIN":
        return True
    if user.role == "STUDENT":
        return Enrollment.objects.filter(user=user, course=course).exists()
    if user.role == "TEACHER":
        return user.teaching_assignments.filter(subject=course.subject).exists()
    if user.role == "PRINCIPAL":
        if not user.institution:
            return False
        return course.subject.classrooms.filter(classroom__institution=user.institution).exists()
    if user.role == "OFFICIAL":
        if not user.district:
            return False
        return course.subject.classrooms.filter(
            classroom__institution__district__name=user.district
        ).exists()
    return False


# =====================================================
# ASSESSMENT CRUD
# =====================================================

@csrf_exempt
@require_roles(["ADMIN", "TEACHER", "PRINCIPAL"])
@require_http_methods(["POST"])
def create_assessment(request, course_id):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    course = get_object_or_404(Course, id=course_id)

    if request.user.role in ["TEACHER", "PRINCIPAL"]:
        if not has_access_to_course(request.user, course):
            return JsonResponse({"detail": "Forbidden"}, status=403)

    title = body.get("title", "").strip()
    if not title:
        return JsonResponse({"error": "title is required"}, status=400)

    assessment = Assessment.objects.create(
        course=course,
        title=title,
        description=body.get("description", ""),
        pass_marks=body.get("pass_marks", 0),
        is_published=body.get("is_published", False),
    )

    logger.info(
        "Assessment created: id=%s by user id=%s role=%s",
        assessment.id, request.user.id, request.user.role,
    )

    return JsonResponse({
        "id": assessment.id,
        "title": assessment.title,
        "description": assessment.description,
        "pass_marks": assessment.pass_marks,
        "total_marks": assessment.total_marks,
        "is_published": assessment.is_published,
    }, status=201)


@csrf_exempt
@require_roles(["ADMIN", "TEACHER", "PRINCIPAL"])
@require_http_methods(["PATCH"])
def update_assessment(request, assessment_id):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    assessment = get_object_or_404(Assessment, id=assessment_id)

    if request.user.role in ["TEACHER", "PRINCIPAL"]:
        if not has_access_to_course(request.user, assessment.course):
            return JsonResponse({"detail": "Forbidden"}, status=403)

    was_published = assessment.is_published

    update_fields = []
    for field in ["title", "description", "pass_marks", "is_published"]:
        if field in body:
            setattr(assessment, field, body[field])
            update_fields.append(field)

    if update_fields:
        assessment.save(update_fields=update_fields)

    # Push notification when assessment is newly published
    if not was_published and assessment.is_published:
        try:
            from apps.notifications.push import send_push_to_users
            # Find all students enrolled in this course
            enrolled_ids = list(
                Enrollment.objects.filter(course=assessment.course, status="enrolled")
                .values_list("user_id", flat=True)
            )
            if enrolled_ids:
                send_push_to_users(
                    user_ids=enrolled_ids,
                    title="New Assessment Available",
                    body=f"{assessment.title} — {assessment.course.title}",
                    url=f"/assessments",
                    tag=f"assessment-published-{assessment.id}",
                )
                logger.info("Push sent for published assessment %s to %d students", assessment.id, len(enrolled_ids))
        except Exception as exc:
            logger.warning("Push failed for assessment %s: %s", assessment.id, exc)

    return JsonResponse({
        "id": assessment.id,
        "title": assessment.title,
        "description": assessment.description,
        "pass_marks": assessment.pass_marks,
        "total_marks": assessment.total_marks,
        "is_published": assessment.is_published,
    })


@csrf_exempt
@require_roles(["ADMIN", "TEACHER", "PRINCIPAL"])
@require_http_methods(["DELETE", "POST"])
def delete_assessment(request, assessment_id):
    assessment = get_object_or_404(Assessment, id=assessment_id)

    if request.user.role in ["TEACHER", "PRINCIPAL"]:
        if not has_access_to_course(request.user, assessment.course):
            return JsonResponse({"detail": "Forbidden"}, status=403)

    assessment.delete()
    return JsonResponse({"success": True})


# =====================================================
# QUESTION CRUD
# =====================================================

@csrf_exempt
@require_roles(["ADMIN", "TEACHER", "PRINCIPAL"])
@require_http_methods(["POST"])
def create_question(request, assessment_id):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    assessment = get_object_or_404(Assessment, id=assessment_id)

    if request.user.role in ["TEACHER", "PRINCIPAL"]:
        if not has_access_to_course(request.user, assessment.course):
            return JsonResponse({"detail": "Forbidden"}, status=403)

    text = body.get("text", "").strip()
    if not text:
        return JsonResponse({"error": "text is required"}, status=400)

    options_data = body.get("options", [])
    if len(options_data) < 2:
        return JsonResponse({"error": "At least 2 options required"}, status=400)

    correct_count = sum(1 for o in options_data if o.get("is_correct"))
    if correct_count != 1:
        return JsonResponse({"error": "Exactly one correct option required"}, status=400)

    next_order = (
        assessment.questions.order_by("-order").values_list("order", flat=True).first() or 0
    ) + 1

    question = Question.objects.create(
        assessment=assessment,
        text=text,
        marks=body.get("marks", 1),
        order=body.get("order", next_order),
    )

    for opt in options_data:
        QuestionOption.objects.create(
            question=question,
            text=opt.get("text", "").strip(),
            is_correct=bool(opt.get("is_correct", False)),
        )

    return JsonResponse({
        "id": question.id,
        "text": question.text,
        "marks": question.marks,
        "order": question.order,
        "options": [
            {"id": o.id, "text": o.text, "is_correct": o.is_correct}
            for o in question.options.all()
        ],
    }, status=201)


@csrf_exempt
@require_roles(["ADMIN", "TEACHER", "PRINCIPAL"])
@require_http_methods(["PATCH"])
def update_question(request, question_id):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    question = get_object_or_404(Question, id=question_id)

    if request.user.role in ["TEACHER", "PRINCIPAL"]:
        if not has_access_to_course(request.user, question.assessment.course):
            return JsonResponse({"detail": "Forbidden"}, status=403)

    update_fields = []
    for field in ["text", "marks", "order"]:
        if field in body:
            setattr(question, field, body[field])
            update_fields.append(field)

    if update_fields:
        question.save(update_fields=update_fields)

    if "options" in body:
        options_data = body["options"]
        correct_count = sum(1 for o in options_data if o.get("is_correct"))
        if correct_count != 1:
            return JsonResponse({"error": "Exactly one correct option required"}, status=400)
        question.options.all().delete()
        for opt in options_data:
            QuestionOption.objects.create(
                question=question,
                text=opt.get("text", "").strip(),
                is_correct=bool(opt.get("is_correct", False)),
            )

    return JsonResponse({
        "id": question.id,
        "text": question.text,
        "marks": question.marks,
        "order": question.order,
        "options": [
            {"id": o.id, "text": o.text, "is_correct": o.is_correct}
            for o in question.options.all()
        ],
    })


@csrf_exempt
@require_roles(["ADMIN", "TEACHER", "PRINCIPAL"])
@require_http_methods(["DELETE", "POST"])
def delete_question(request, question_id):
    question = get_object_or_404(Question, id=question_id)

    if request.user.role in ["TEACHER", "PRINCIPAL"]:
        if not has_access_to_course(request.user, question.assessment.course):
            return JsonResponse({"detail": "Forbidden"}, status=403)

    question.delete()
    return JsonResponse({"success": True})


# =====================================================
# STUDENT-FACING ASSESSMENT ENDPOINTS
# =====================================================

@require_auth
@require_http_methods(["GET"])
def course_assessments(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    if not has_access_to_course(request.user, course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    data = list(
        course.assessments.filter(is_published=True)
        .values("id", "title", "description", "total_marks", "pass_marks")
        .order_by("title")
    )
    return JsonResponse(data, safe=False)


@require_auth
@require_http_methods(["GET"])
def assessment_detail(request, assessment_id):
    assessment = get_object_or_404(Assessment, id=assessment_id, is_published=True)
    if not has_access_to_course(request.user, assessment.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    questions = []
    for q in assessment.questions.prefetch_related("options").order_by("order"):
        questions.append({
            "id": q.id,
            "text": q.text,
            "marks": q.marks,
            "order": q.order,
            # is_correct intentionally excluded — never send to client
            "options": [{"id": opt.id, "text": opt.text} for opt in q.options.all()],
        })

    return JsonResponse({
        "id": assessment.id,
        "title": assessment.title,
        "description": assessment.description,
        "total_marks": assessment.total_marks,
        "pass_marks": assessment.pass_marks,
        "questions": questions,
    })


@require_auth
@require_http_methods(["GET"])
def assessment_detail_admin(request, assessment_id):
    """
    GET /api/v1/assessments/:id/admin/
    Returns is_correct for builder UI. ADMIN, TEACHER, PRINCIPAL only.
    """
    if request.user.role not in ["ADMIN", "TEACHER", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    assessment = get_object_or_404(Assessment, id=assessment_id)

    if request.user.role in ["TEACHER", "PRINCIPAL"]:
        if not has_access_to_course(request.user, assessment.course):
            return JsonResponse({"detail": "Forbidden"}, status=403)

    questions = []
    for q in assessment.questions.prefetch_related("options").order_by("order"):
        questions.append({
            "id": q.id,
            "text": q.text,
            "marks": q.marks,
            "order": q.order,
            "options": [
                {"id": opt.id, "text": opt.text, "is_correct": opt.is_correct}
                for opt in q.options.all()
            ],
        })

    return JsonResponse({
        "id": assessment.id,
        "title": assessment.title,
        "description": assessment.description,
        "total_marks": assessment.total_marks,
        "pass_marks": assessment.pass_marks,
        "is_published": assessment.is_published,
        "questions": questions,
    })


@csrf_exempt
@require_auth
@require_http_methods(["POST"])
def start_assessment(request, assessment_id):
    """
    POST /api/v1/assessments/:id/start/
    @csrf_exempt because frontend sends session cookie auth — CSRF not needed here.
    """
    assessment = get_object_or_404(Assessment, id=assessment_id, is_published=True)
    if not has_access_to_course(request.user, assessment.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    active_attempt = AssessmentAttempt.objects.filter(
        user=request.user, assessment=assessment, submitted_at__isnull=True
    ).first()

    if active_attempt:
        return JsonResponse({
            "attempt_id": active_attempt.id,
            "assessment_id": assessment.id,
            "started_at": active_attempt.started_at.isoformat(),
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


@csrf_exempt
@require_auth
@require_http_methods(["POST"])
def submit_assessment(request, assessment_id):
    """POST /api/v1/assessments/:id/submit/"""
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    attempt_id       = body.get("attempt_id")
    selected_options = body.get("selected_options", {})

    if not attempt_id:
        return JsonResponse({"error": "attempt_id is required"}, status=400)

    attempt = get_object_or_404(
        AssessmentAttempt, id=attempt_id, assessment_id=assessment_id, user=request.user
    )

    if attempt.submitted_at:
        return JsonResponse({"detail": "Already submitted"}, status=400)

    try:
        attempt.submit(selected_options)
    except Exception:
        logger.exception("Failed to submit attempt id=%s", attempt_id)
        return JsonResponse({"error": "Submission failed"}, status=500)

    return JsonResponse({
        "attempt_id": attempt.id,
        "score": attempt.score,
        "passed": attempt.passed,
        "total_marks": attempt.assessment.total_marks,
        "pass_marks": attempt.assessment.pass_marks,
    })


@require_auth
@require_http_methods(["GET"])
def my_attempts(request, assessment_id):
    assessment = get_object_or_404(Assessment, id=assessment_id)
    if not has_access_to_course(request.user, assessment.course):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    attempts = (
        AssessmentAttempt.objects
        .filter(assessment=assessment, user=request.user, submitted_at__isnull=False)
        .values("id", "score", "passed", "started_at", "submitted_at")
        .order_by("-started_at")
    )
    return JsonResponse(list(attempts), safe=False)


@require_auth
@require_http_methods(["GET"])
def all_my_attempts(request):
    """
    GET /api/v1/assessments/my-history/
    STUDENT → own attempts
    ADMIN   → any student via ?user_id=, or empty list
    Others  → 403
    """
    user = request.user

    if user.role == "STUDENT":
        target_user = user
    elif user.is_superuser or user.role == "ADMIN":
        user_id_param = request.GET.get("user_id")
        if user_id_param:
            target_user = get_object_or_404(User, id=user_id_param)
        else:
            return JsonResponse([], safe=False)
    else:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    attempts = (
        AssessmentAttempt.objects
        .filter(user=target_user, submitted_at__isnull=False)
        .select_related(
            "assessment",
            "assessment__course",
            "assessment__course__subject",
        )
        .order_by("-submitted_at")
    )

    data = [
        {
            "id": a.id,
            "score": a.score,
            "passed": a.passed,
            "submitted_at": a.submitted_at.isoformat(),
            "assessment_id": a.assessment.id,
            "assessment_title": a.assessment.title,
            "total_marks": a.assessment.total_marks,
            "pass_marks": a.assessment.pass_marks,
            "subject": a.assessment.course.subject.name,
            "grade": a.assessment.course.grade,
            "course_title": a.assessment.course.title,
        }
        for a in attempts
    ]
    return JsonResponse(data, safe=False)


@require_auth
@require_http_methods(["GET"])
def my_assessments(request):
    """
    GET /api/v1/assessments/my/
    STUDENT   → enrolled courses, with attempt stats
    ADMIN     → all published (no attempt stats)
    TEACHER   → subjects they teach (no attempt stats)
    PRINCIPAL → their institution (no attempt stats)
    OFFICIAL  → their district (no attempt stats)
    """
    user = request.user

    if user.role == "STUDENT":
        enrolled_course_ids = Enrollment.objects.filter(
            user=user, status="enrolled"
        ).values_list("course_id", flat=True)
        assessments_qs = (
            Assessment.objects
            .filter(course_id__in=enrolled_course_ids, is_published=True)
            .select_related("course", "course__subject")
            .order_by("course__grade", "course__subject__name", "title")
        )

    elif user.is_superuser or user.role == "ADMIN":
        assessments_qs = (
            Assessment.objects
            .filter(is_published=True)
            .select_related("course", "course__subject")
            .order_by("course__grade", "course__subject__name", "title")
        )

    elif user.role == "TEACHER":
        subject_ids = user.teaching_assignments.values_list("subject_id", flat=True)
        assessments_qs = (
            Assessment.objects
            .filter(course__subject_id__in=subject_ids, is_published=True)
            .select_related("course", "course__subject")
            .order_by("course__grade", "course__subject__name", "title")
        )

    elif user.role == "PRINCIPAL":
        if not user.institution:
            return JsonResponse({"detail": "No institution assigned"}, status=400)
        assessments_qs = (
            Assessment.objects
            .filter(
                course__subject__classrooms__classroom__institution=user.institution,
                is_published=True,
            )
            .distinct()
            .select_related("course", "course__subject")
            .order_by("course__grade", "course__subject__name", "title")
        )

    elif user.role == "OFFICIAL":
        if not user.district:
            return JsonResponse({"detail": "No district assigned"}, status=400)
        assessments_qs = (
            Assessment.objects
            .filter(
                course__subject__classrooms__classroom__institution__district__name=user.district,
                is_published=True,
            )
            .distinct()
            .select_related("course", "course__subject")
            .order_by("course__grade", "course__subject__name", "title")
        )

    else:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    data = []
    for assessment in assessments_qs:
        if user.role == "STUDENT":
            attempts      = AssessmentAttempt.objects.filter(
                user=user, assessment=assessment, submitted_at__isnull=False,
            )
            attempt_count = attempts.count()
            best          = attempts.order_by("-score").first()
            best_score    = best.score  if best else None
            passed        = best.passed if best else False
        else:
            attempt_count = None
            best_score    = None
            passed        = False

        data.append({
            "id":           assessment.id,
            "title":        assessment.title,
            "description":  assessment.description,
            "total_marks":  assessment.total_marks,
            "pass_marks":   assessment.pass_marks,
            "course_title": assessment.course.title,
            "subject":      assessment.course.subject.name,
            "grade":        assessment.course.grade,
            "attempt_count": attempt_count,
            "best_score":   best_score,
            "passed":       passed,
        })

    return JsonResponse(data, safe=False)


# =====================================================
# TEACHER / ANALYTICS ENDPOINTS
# =====================================================

@require_auth
@require_http_methods(["GET"])
def teacher_assessment_analytics(request):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    if request.user.role == "TEACHER":
        subject_ids = request.user.teaching_assignments.values_list("subject_id", flat=True)
        assessments = Assessment.objects.filter(course__subject_id__in=subject_ids)
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
    else:
        assessments = Assessment.objects.all()

    data = []
    for assessment in assessments.select_related(
        "course", "course__subject"
    ).order_by("course__grade", "title"):
        attempts        = assessment.attempts.filter(submitted_at__isnull=False)
        agg             = attempts.aggregate(
            total=Count("id"),
            avg=Avg("score"),
            passes=Count("id", filter=Q(passed=True)),
        )
        total_attempts  = agg["total"] or 0
        unique_students = attempts.values("user").distinct().count()
        avg_score       = agg["avg"] or 0
        pass_count      = agg["passes"] or 0
        pass_rate       = (pass_count / total_attempts * 100) if total_attempts else 0

        data.append({
            "assessment_id":  assessment.id,
            "course_id":      assessment.course.id,
            "title":          assessment.title,
            "course":         assessment.course.title,
            "subject":        assessment.course.subject.name if assessment.course.subject else None,
            "total_attempts": total_attempts,
            "unique_students": unique_students,
            "average_score":  round(avg_score, 2),
            "pass_count":     pass_count,
            "fail_count":     total_attempts - pass_count,
            "pass_rate":      round(pass_rate, 2),
        })

    return JsonResponse(data, safe=False)


@require_auth
@require_http_methods(["GET"])
def teacher_class_analytics(request):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    # Cast("name", IntegerField()) sorts "6","7","8","9","10" numerically.
    # String sort would put "10" before "6".
    int_name = Cast("name", IntegerField())

    if request.user.role == "TEACHER":
        classes = ClassRoom.objects.filter(
            sections__teaching_assignments__teacher=request.user
        ).distinct().order_by(int_name)
    elif request.user.role == "PRINCIPAL":
        if not request.user.institution:
            return JsonResponse({"detail": "No institution assigned"}, status=400)
        classes = ClassRoom.objects.filter(
            institution=request.user.institution
        ).order_by(int_name)
    elif request.user.role == "OFFICIAL":
        if not request.user.district:
            return JsonResponse({"detail": "No district assigned"}, status=400)
        classes = ClassRoom.objects.filter(
            institution__district__name=request.user.district
        ).order_by(int_name)
    else:
        classes = ClassRoom.objects.all().order_by(int_name)

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
            avg_score      = agg["avg"]   or 0
            pass_count     = agg["passes"] or 0
        else:
            total_attempts = avg_score = pass_count = 0

        pass_rate = (pass_count / total_attempts * 100) if total_attempts else 0

        data.append({
            "class_id":      classroom.id,
            "class_name":    classroom.name,
            "institution":   classroom.institution.name,
            "total_students": total_students,
            "total_attempts": total_attempts,
            "average_score": round(avg_score, 2),
            "pass_rate":     round(pass_rate, 2),
        })

    return JsonResponse(data, safe=False)


@require_auth
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
        avg_score      = agg["avg"]   or 0
        pass_count     = agg["passes"] or 0
        pass_rate      = (pass_count / total_attempts * 100) if total_attempts else 0

        data.append({
            "student_id":    student.id,
            "username":      student.username,
            "total_attempts": total_attempts,
            "average_score": round(avg_score, 2),
            "pass_rate":     round(pass_rate, 2),
        })

    return JsonResponse(data, safe=False)


@require_auth
@require_http_methods(["GET"])
def teacher_student_assessments(request, class_id, student_id):
    if request.user.role not in ["TEACHER", "OFFICIAL", "ADMIN", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    classroom  = get_scoped_object_or_403(request.user, ClassRoom.objects, id=class_id)
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