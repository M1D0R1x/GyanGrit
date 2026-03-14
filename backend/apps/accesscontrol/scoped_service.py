import logging
from django.shortcuts import get_object_or_404

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Explicit traversal map
#
# Maps a model name to the ORM lookup path that reaches:
#   - "institution"  for institution-level scoping
#   - "district"     for district-level scoping
#
# If a model is not listed here it is treated as globally accessible
# (e.g. Subject, District — no institution/district ownership).
#
# Add new models here as the system grows. Using an explicit map instead of
# field introspection avoids silent failures when traversal depth > 1.
# ---------------------------------------------------------------------------

# model_name -> ORM filter kwarg for institution-level scoping
INSTITUTION_SCOPE_MAP = {
    "Institution": "id",                                        # filter by institution.id
    "ClassRoom": "institution",
    "Section": "classroom__institution",
    "TeachingAssignment": "section__classroom__institution",
    "StudentSubject": "classroom__institution",
    "ClassSubject": "classroom__institution",
    "User": "institution",
    "Enrollment": "course__institution",
    "LessonProgress": "lesson__course__institution",
    "AssessmentAttempt": "assessment__course__institution",
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
}


def scope_queryset(user, queryset):
    """
    Apply role-based data scoping to a queryset.

    Rules:
    - ADMIN / superuser: full access, no filtering.
    - OFFICIAL: filtered to their district.
    - PRINCIPAL / TEACHER / STUDENT: filtered to their institution.
    - Any user missing required profile data (district/institution): returns none.
    - Models not in the scope maps are treated as globally readable
      (e.g. Subject, District).

    Security:
    - Uses an explicit traversal map instead of field introspection to avoid
      silent data leakage on models with nested foreign keys.
    - Logs a warning whenever access is denied due to missing profile data.
    """
    if not user.is_authenticated:
        return queryset.none()

    # Superuser or ADMIN: unrestricted
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
            # Model has no district ownership — globally accessible (e.g. Subject)
            return queryset

        return queryset.filter(**{scope_field: district_name})

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
            # Model has no institution ownership — globally accessible (e.g. Subject)
            return queryset

        # Special case: Institution model — filter by pk, not a traversal
        if model_name == "Institution":
            return queryset.filter(id=institution.id)

        return queryset.filter(**{scope_field: institution})

    # Unknown role — deny by default
    logger.warning(
        "Unknown role '%s' for user id=%s — returning empty queryset.",
        getattr(user, "role", "MISSING"),
        user.id,
    )
    return queryset.none()


def get_scoped_object_or_404(user, queryset, **lookup):
    """
    Fetch a single object within the user's scope.
    Returns 404 (not 403) if the object is outside scope —
    this is intentional: we do not confirm the object exists to the caller.
    """
    scoped_qs = scope_queryset(user, queryset)
    return get_object_or_404(scoped_qs, **lookup)


# ---------------------------------------------------------------------------
# Backward-compatible alias.
# content/views.py imports this name. It will be cleaned up when the
# content app is reviewed and replaced with get_scoped_object_or_404.
# ---------------------------------------------------------------------------
get_scoped_object_or_403 = get_scoped_object_or_404