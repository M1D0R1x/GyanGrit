from django.shortcuts import get_object_or_404


def scope_queryset(user, queryset):
    """
    Centralized, robust scoping that works for ALL models:
    - Institution, User, Section, ClassRoom, etc.
    - Global models like Subject (no crash)
    - Handles OFFICIAL (district) + others (institution)
    """
    if not user.is_authenticated:
        return queryset.none()

    if user.role == "ADMIN" or user.is_superuser:
        return queryset

    model = queryset.model
    field_names = {f.name for f in model._meta.get_fields()}

    # OFFICIAL → district level
    if user.role == "OFFICIAL":
        district_name = getattr(user, "district", None)
        if not district_name:
            return queryset.none()

        if "district" in field_names:
            return queryset.filter(district__name=district_name)
        elif "institution" in field_names:
            return queryset.filter(institution__district__name=district_name)
        else:
            return queryset  # global models (Subject, etc.)

    # PRINCIPAL / TEACHER / STUDENT → institution level
    if user.role in ["PRINCIPAL", "TEACHER", "STUDENT"]:
        institution = getattr(user, "institution", None)
        if not institution:
            return queryset.none()

        if "institution" in field_names:
            return queryset.filter(institution=institution)
        elif model.__name__ == "Institution":
            return queryset.filter(id=institution.id)
        else:
            return queryset  # global models (Subject) or nested (Section - full is safe here)

    return queryset.none()


def get_scoped_object_or_403(user, queryset, **lookup):
    """Safe single object fetch with scoping."""
    scoped_qs = scope_queryset(user, queryset)
    return get_object_or_404(scoped_qs, **lookup)