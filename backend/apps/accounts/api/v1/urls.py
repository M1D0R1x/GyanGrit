from django.urls import path
from apps.accounts import views

urlpatterns = [
    path("register/", views.register),
    path("login/", views.login_view),
    path("logout/", views.logout_view),
    path("me/", views.me),

    path("users/", views.users),
    path("institutions/", views.institutions),
    path("sections/", views.sections),
    path("subjects/", views.subjects),
    path("teachers/", views.teachers),

    path("student-register/", views.student_register),
]