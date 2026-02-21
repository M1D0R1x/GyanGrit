from django.urls import path
from apps.content import views

urlpatterns = [
    # Health check
    path("health/", views.health, name="content-health"),

    # Courses & Lessons (student-facing)
    path("courses/", views.courses, name="courses-list"),
    path("courses/<int:course_id>/lessons/", views.course_lessons, name="course-lessons"),
    path("courses/<int:course_id>/progress/", views.course_progress, name="course-progress"),

    # Lesson detail & progress
    path("lessons/<int:lesson_id>/", views.lesson_detail, name="lesson-detail"),
    path("lessons/<int:lesson_id>/progress/", views.lesson_progress, name="lesson-progress"),

    # Teacher Analytics (no duplicates!)
    path("teacher/analytics/courses/", views.teacher_course_analytics, name="teacher-course-analytics"),
    path("teacher/analytics/lessons/", views.teacher_lesson_analytics, name="teacher-lesson-analytics"),
    path("teacher/analytics/classes/", views.teacher_class_analytics, name="teacher-class-analytics"),
    path("teacher/analytics/assessments/", views.teacher_assessment_analytics, name="teacher-assessment-analytics"),
]