def institution_scope_queryset(user, queryset):
    """
    Restrict queryset based on user role and institution.
    """

    if user.role == "ADMIN":
        return queryset

    if user.role == "OFFICIAL":
        return queryset.filter(institution__district=user.district)

    if user.role == "PRINCIPAL":
        return queryset.filter(institution=user.institution)

    if user.role == "TEACHER":
        return queryset.filter(institution=user.institution)

    if user.role == "STUDENT":
        return queryset.filter(institution=user.institution)

    return queryset.none()