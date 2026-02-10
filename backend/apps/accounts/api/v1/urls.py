from django.urls import path
from apps.accounts import views

urlpatterns = [
    path("register/", views.register),
    path("login/", views.login_view),
    path("logout/", views.logout_view),
    path("me/", views.me),

    # Admin-only
    path("users/", views.users),
]
