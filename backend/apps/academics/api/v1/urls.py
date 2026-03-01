from django.urls import path
from apps.academics import views

urlpatterns = [
    path("institutions/", views.institutions),
    path("classes/", views.classes),
    path("sections/", views.sections),
    path("subjects/", views.subjects),

    # Admin / Official / Principal
    path("teaching-assignments/", views.teaching_assignments),

    # Teacher self view
    path("my-assignments/", views.my_assignments),
]