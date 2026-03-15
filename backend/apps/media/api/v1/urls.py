from django.urls import path
from apps.media import views

urlpatterns = [
    path("upload/", views.upload),
]