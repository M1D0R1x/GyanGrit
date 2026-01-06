from django.urls import path
from apps.accounts import views

urlpatterns = [
    path("register/", views.register),
    path("login/", views.login_view),
    path("me/", views.me),
]
