from django.urls import path
from apps.learning import views

urlpatterns = [
    path("paths/", views.learning_paths),
    path("paths/<int:path_id>/", views.learning_path_detail),
    path("paths/<int:path_id>/progress/", views.learning_path_progress),
]
