from django.urls import path
from apps.learning import views

urlpatterns = [
    path("paths/", views.learning_paths),
    path("paths/<int:path_id>/", views.learning_path_detail),
    path("paths/<int:path_id>/progress/", views.learning_path_progress),
    path("paths/<int:path_id>/enroll/", views.enroll_learning_path),

    path("enrollments/", views.enrollments),
    path("enroll/", views.enroll_course),
    path("enrollments/<int:enrollment_id>/", views.update_enrollment),
]
