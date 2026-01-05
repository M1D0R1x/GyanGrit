from django.urls import path
from apps.learning import views

urlpatterns = [
    path("enrollments/", views.enrollments),
    path("enroll/", views.enroll_course),
    path("enrollments/<int:enrollment_id>/", views.update_enrollment),
]
