from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404


def scope_queryset(user, queryset):
    """
    Centralized institutional + district scoping.
    Use this everywhere going forward.
    """

    if not user.is_authenticated:
        return queryset.none()

    # ADMIN sees everything
    if user.role == "ADMIN":
        return queryset

    # OFFICIAL sees only their district (consistent with academics app)
    if user.role == "OFFICIAL":
        district_name = getattr(user, "district", None)
        if district_name:
            return queryset.filter(institution__district__name=district_name)
        return queryset.none()

    # PRINCIPAL / TEACHER / STUDENT limited to own institution
    if user.role in ["PRINCIPAL", "TEACHER", "STUDENT"]:
        institution = getattr(user, "institution", None)
        if institution:
            return queryset.filter(institution=institution)
        return queryset.none()

    return queryset.none()


def get_scoped_object_or_403(user, queryset, **lookup):
    """
    Safe object fetch with automatic scoping.
    Returns 404 if not found or not in user's scope (security best practice).
    """
    scoped_qs = scope_queryset(user, queryset)
    return get_object_or_404(scoped_qs, **lookup)