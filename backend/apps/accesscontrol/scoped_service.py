import logging
from django.shortcuts import get_object_or_404

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Explicit traversal map
#
# Maps a model name to the ORM lookup path that reaches institution
# or district scope.
#
# If a model is not listed here it is treated as globally accessible
# (e.g. Subject, District — no institution/district ownership).
#
# Add new models here as the system grows. Using an explicit map instead of
# field introspection avoids silent failures when traversal depth > 1.
# ---------------------------------------------------------------------------

# model_name -> ORM filter kwarg for institution-level scoping
INSTITUTION_SCOPE_MAP = {
    "Institution": "id",
    "ClassRoom": "institution",
    "Section": "classroom__institution",
    "TeachingAssignment": "section__classroom__institution",
    "StudentSubject": "classroom__institution",
    "ClassSubject": "classroom__institution",
    "User": "institution",
    # Content models — scoped via subject → ClassSubject → classroom → institution
    "Course": "subject__classrooms__classroom__institution",
    "Lesson": "course__subject__classrooms__classroom__institution",
    "Assessment": "course__subject__classrooms__classroom__institution",
    # Learning models
    "Enrollment": "course__subject__classrooms__classroom__institution",
    "LessonProgress": "lesson__course__subject__classrooms__classroom__institution",
    "AssessmentAttempt": "assessment__course__subject__classrooms__classroom__institution",
}

# model_name -> ORM filter kwarg for district-level scoping
DISTRICT_SCOPE_MAP = {
    "Institution": "district__name",
    "ClassRoom": "institution__district__name",
    "Section": "classroom__institution__district__name",
    "TeachingAssignment": "section__classroom__institution__district__name",
    "StudentSubject": "classroom__institution__district__name",
    "ClassSubject": "classroom__institution__district__name",
    "User": "institution__district__name",
    # Content models
    "Course": "subject__classrooms__classroom__institution__district__name",
    "Lesson": "course__subject__classrooms__classroom__institution__district__name",
    "Assessment": "course__subject__classrooms__classroom__institution__district__name",
    # Learning models
    "Enrollment": "course__subject__classrooms__classroom__institution__district__name",
    "LessonProgress": "lesson__course__subject__classrooms__classroom__institution__district__name",
    "AssessmentAttempt": "assessment__course__subject__classrooms__classroom__institution__district__name",
}


def scope_queryset(user, queryset):
    """
    Apply role-based data scoping to a queryset.

    Rules:
    - ADMIN / superuser: full access, no filtering.
    - OFFICIAL: filtered to their district.
    - PRINCIPAL / TEACHER / STUDENT: filtered to their institution.
    - Any user missing required profile data: returns empty queryset.
    - Models not in scope maps are globally accessible (e.g. Subject, District).

    Security:
    - Uses explicit traversal map to avoid silent data leakage on nested FKs.
    - Logs warnings when access is denied due to missing profile data.
    """
    if not user.is_authenticated:
        return queryset.none()

    if user.is_superuser or getattr(user, "role", None) == "ADMIN":
        return queryset

    model_name = queryset.model.__name__

    # -----------------------------------------------------------------------
    # OFFICIAL → district-level scope
    # -----------------------------------------------------------------------
    if user.role == "OFFICIAL":
        district_name = getattr(user, "district", None)

        if not district_name:
            logger.warning(
                "OFFICIAL user id=%s has no district assigned — "
                "returning empty queryset.",
                user.id,
            )
            return queryset.none()

        scope_field = DISTRICT_SCOPE_MAP.get(model_name)

        if scope_field is None:
            return queryset  # globally accessible model

        return queryset.filter(**{scope_field: district_name}).distinct()

    # -----------------------------------------------------------------------
    # PRINCIPAL / TEACHER / STUDENT → institution-level scope
    # -----------------------------------------------------------------------
    if user.role in ("PRINCIPAL", "TEACHER", "STUDENT"):
        institution = getattr(user, "institution", None)

        if not institution:
            logger.warning(
                "User id=%s role=%s has no institution assigned — "
                "returning empty queryset.",
                user.id,
                user.role,
            )
            return queryset.none()

        scope_field = INSTITUTION_SCOPE_MAP.get(model_name)

        if scope_field is None:
            return queryset  # globally accessible model

        if model_name == "Institution":
            return queryset.filter(id=institution.id)

        return queryset.filter(**{scope_field: institution}).distinct()

    logger.warning(
        "Unknown role '%s' for user id=%s — returning empty queryset.",
        getattr(user, "role", "MISSING"),
        user.id,
    )
    return queryset.none()


def get_scoped_object_or_404(user, queryset, **lookup):
    """
    Fetch a single object within the user's scope.
    Returns 404 if outside scope — does not reveal object existence.
    """
    scoped_qs = scope_queryset(user, queryset)
    return get_object_or_404(scoped_qs, **lookup)


# Backward-compatible alias — will be removed after all imports are updated
get_scoped_object_or_403 = get_scoped_object_or_404