from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required

from .models import (
    Institution,
    ClassRoom,
    Section,
    Subject,
    TeachingAssignment,
    District,
)
from ..content.models import Lesson, LessonProgress, Course


# =========================================================
# INSTITUTIONS
# =========================================================

@login_required
@require_http_methods(["GET"])
def institutions(request):
    if request.user.role not in ["ADMIN", "OFFICIAL", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    queryset = Institution.objects.select_related("district")

    if request.user.role == "OFFICIAL":
        queryset = queryset.filter(district__name=request.user.district)

    elif request.user.role == "PRINCIPAL":
        if not request.user.institution:
            return JsonResponse({"detail": "No institution assigned"}, status=400)
        queryset = queryset.filter(id=request.user.institution.id)

    return JsonResponse(
        list(queryset.values("id", "name", "district__name")),
        safe=False
    )


# =========================================================
# CLASSES (was one of the slowest)
# =========================================================

@login_required
@require_http_methods(["GET"])
def classes(request):
    queryset = ClassRoom.objects.select_related("institution")

    if request.user.role in ["PRINCIPAL", "TEACHER", "STUDENT"]:
        if not request.user.institution:
            return JsonResponse({"detail": "No institution assigned"}, status=400)
        queryset = queryset.filter(institution=request.user.institution)

    elif request.user.role == "OFFICIAL":
        if not request.user.district:
            return JsonResponse({"detail": "No district assigned"}, status=400)
        queryset = queryset.filter(institution__district__name=request.user.district)

    return JsonResponse(
        list(queryset.values("id", "name", "institution_id")),
        safe=False
    )


# =========================================================
# SECTIONS (was also very slow)
# =========================================================

@login_required
@require_http_methods(["GET"])
def sections(request):
    classroom_id = request.GET.get("classroom_id")

    queryset = Section.objects.select_related("classroom", "classroom__institution")

    if classroom_id:
        queryset = queryset.filter(classroom_id=classroom_id)

    if request.user.role in ["PRINCIPAL", "TEACHER", "STUDENT"]:
        if request.user.institution:
            queryset = queryset.filter(classroom__institution=request.user.institution)

    elif request.user.role == "OFFICIAL":
        if request.user.district:
            queryset = queryset.filter(classroom__institution__district__name=request.user.district)

    return JsonResponse(
        list(queryset.values("id", "name", "classroom_id")),
        safe=False
    )


# =========================================================
# SUBJECTS
# =========================================================

from .models import StudentSubject
from ..content.models import Lesson, LessonProgress, Course


@login_required
@require_http_methods(["GET"])
def subjects(request):

    if request.user.role == "STUDENT":

        student_subjects = (
            StudentSubject.objects
            .select_related("subject", "classroom")
            .filter(student=request.user)
        )

        data = []

        for ss in student_subjects:
            subject = ss.subject
            classroom = ss.classroom

            # courses for this subject + class
            courses = Course.objects.filter(
                subject=subject,
                grade=int(classroom.name)
            )

            total_lessons = Lesson.objects.filter(
                course__in=courses,
                is_published=True
            ).count()

            completed_lessons = LessonProgress.objects.filter(
                lesson__course__in=courses,
                user=request.user,
                completed=True
            ).count()

            progress = int((completed_lessons / total_lessons) * 100) if total_lessons else 0

            data.append({
                "id": subject.id,
                "name": subject.name,
                "total_lessons": total_lessons,
                "completed_lessons": completed_lessons,
                "progress": progress,
            })

        return JsonResponse(data, safe=False)


    elif request.user.role == "TEACHER":

        queryset = Subject.objects.filter(
            teaching_assignments__teacher=request.user
        ).distinct()

        return JsonResponse(
            list(queryset.values("id", "name")),
            safe=False
        )


    else:

        queryset = Subject.objects.all()

        return JsonResponse(
            list(queryset.values("id", "name")),
            safe=False
        )

# =========================================================
# TEACHING ASSIGNMENTS
# =========================================================

@login_required
@require_http_methods(["GET"])
def teaching_assignments(request):
    if request.user.role not in ["ADMIN", "OFFICIAL", "PRINCIPAL"]:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    queryset = TeachingAssignment.objects.select_related(
        "teacher", "subject", "section", "section__classroom", "section__classroom__institution"
    )

    if request.user.role == "PRINCIPAL":
        queryset = queryset.filter(section__classroom__institution=request.user.institution)

    elif request.user.role == "OFFICIAL":
        queryset = queryset.filter(section__classroom__institution__district__name=request.user.district)

    data = []
    for a in queryset:
        data.append({
            "id": a.id,
            "teacher_id": a.teacher.id,
            "teacher_username": a.teacher.username,
            "subject_id": a.subject.id,
            "subject_name": a.subject.name,
            "section_id": a.section.id,
            "section_name": a.section.name,
            "class_name": a.section.classroom.name,
        })

    return JsonResponse(data, safe=False)


# =========================================================
# MY ASSIGNMENTS (TEACHER ONLY)
# =========================================================

@login_required
@require_http_methods(["GET"])
def my_assignments(request):
    if request.user.role != "TEACHER":
        return JsonResponse({"detail": "Forbidden"}, status=403)

    assignments = TeachingAssignment.objects.filter(
        teacher=request.user
    ).select_related("subject", "section", "section__classroom", "section__classroom__institution")

    data = []
    for a in assignments:
        data.append({
            "subject_id": a.subject.id,
            "subject_name": a.subject.name,
            "section_id": a.section.id,
            "section_name": a.section.name,
            "class_name": a.section.classroom.name,
        })

    return JsonResponse(data, safe=False)


# =========================================================
# PUBLIC HELPERS
# =========================================================

@require_http_methods(["GET"])
def districts(request):
    query = request.GET.get("q", "")
    districts = District.objects.filter(name__icontains=query).order_by("name")
    return JsonResponse(list(districts.values("id", "name")), safe=False)


@require_http_methods(["GET"])
def schools(request):
    district_id = request.GET.get("district_id")
    query = request.GET.get("q", "")

    schools = Institution.objects.select_related("district")

    if district_id:
        schools = schools.filter(district_id=district_id)
    if query:
        schools = schools.filter(name__icontains=query)

    data = list(
        schools.values(
            "id",
            "name",
            "district__name",
            "is_government",
        ).order_by("name")
    )

    return JsonResponse(data, safe=False)