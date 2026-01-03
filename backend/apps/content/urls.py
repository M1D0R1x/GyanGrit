from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health),

    path("courses/", views.courses),
    path("courses/<int:course_id>/lessons/", views.course_lessons),
    path("courses/<int:course_id>/progress/", views.course_progress),

    path("lessons/<int:lesson_id>/", views.lesson_detail),
    path("lessons/<int:lesson_id>/progress/", views.lesson_progress),
    path("teacher/analytics/", views.teacher_course_analytics),
]
