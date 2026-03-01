from django.urls import path
from apps.content import views

urlpatterns = [
    # Health check
    path("health/", views.health, name="content-health"),

    # Courses & Lessons
    path("courses/", views.courses, name="courses-list"),
    path("courses/<int:course_id>/lessons/", views.course_lessons),
    path("courses/<int:course_id>/progress/", views.course_progress),

    path("lessons/<int:lesson_id>/", views.lesson_detail),
    path("lessons/<int:lesson_id>/progress/", views.lesson_progress),

    # Teacher Analytics
    path("teacher/analytics/courses/", views.teacher_course_analytics),
    path("teacher/analytics/lessons/", views.teacher_lesson_analytics),
    path("teacher/analytics/classes/", views.teacher_class_analytics),
    path("teacher/analytics/assessments/", views.teacher_assessment_analytics),
]