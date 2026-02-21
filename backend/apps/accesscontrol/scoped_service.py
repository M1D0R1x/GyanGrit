from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404


def scope_queryset(user, queryset):
    """
    Centralized institutional scoping.
    """

    if not user.is_authenticated:
        return queryset.none()

    # ADMIN sees everything
    if user.role == "ADMIN":
        return queryset

    # OFFICIAL sees all institutions (change later if district-based)
    if user.role == "OFFICIAL":
        return queryset

    # PRINCIPAL limited to own institution
    if user.role == "PRINCIPAL":
        return queryset.filter(institution=user.institution)

    # TEACHER limited to own institution
    if user.role == "TEACHER":
        return queryset.filter(institution=user.institution)

    # STUDENT limited to own institution
    if user.role == "STUDENT":
        return queryset.filter(institution=user.institution)

    return queryset.none()


def get_scoped_object_or_403(user, queryset, **lookup):
    """
    Safe object fetch with automatic scoping.
    """

    scoped_qs = scope_queryset(user, queryset)
    obj = get_object_or_404(scoped_qs, **lookup)

    if not obj:
        raise PermissionDenied("Access denied.")

    return obj