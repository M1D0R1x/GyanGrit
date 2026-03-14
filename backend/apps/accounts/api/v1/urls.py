from django.urls import path
from apps.accounts import views

urlpatterns = [
    path("register/", views.register),
    path("login/", views.login_view),
    path("logout/", views.logout_view),
    path("me/", views.me),
    path("csrf/", views.csrf_token_view),

    path("users/", views.users),
    path("student-register/", views.student_register),
    path("verify-otp/", views.verify_otp),
    path("validate-join-code/", views.validate_join_code),

    # NEW: Required for Principal Dashboard
    path("teachers/", views.teachers),
]