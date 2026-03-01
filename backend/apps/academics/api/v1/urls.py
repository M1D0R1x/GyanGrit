from django.urls import path
from apps.academics import views

urlpatterns = [
    path("institutions/", views.institutions),
    path("classes/", views.classes),
    path("sections/", views.sections),
    path("subjects/", views.subjects),
    path("teaching-assignments/", views.teaching_assignments),
]