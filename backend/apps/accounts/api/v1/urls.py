from django.urls import path
from apps.accounts import views

urlpatterns = [
    # Auth
    path("register/",           views.register),
    path("login/",              views.login_view),
    path("logout/",             views.logout_view),
    path("me/",                 views.me),
    path("csrf/",               views.csrf_token_view),

    # Profile
    path("profile/",            views.complete_profile),

    # Registration helpers
    path("student-register/",   views.student_register),
    path("verify-otp/",         views.verify_otp),
    path("validate-join-code/", views.validate_join_code),

    # Scoped lists
    path("users/",              views.users),
    path("teachers/",           views.teachers),
    path("sections/",           views.sections_list),
    path("subjects/",           views.subjects_list),
    path("institutions/",       views.institutions_list),

    # Join code management
    path("join-codes/",                           views.join_codes_list),
    path("join-codes/create/",                    views.create_join_code),
    path("join-codes/bulk/",                      views.bulk_create_join_codes),
    path("join-codes/export/",                    views.export_join_codes),
    path("join-codes/<int:code_id>/revoke/",      views.revoke_join_code),
    path("join-codes/<int:code_id>/email/",       views.email_join_code),
]