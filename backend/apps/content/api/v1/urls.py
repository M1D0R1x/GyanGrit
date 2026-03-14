from django.urls import path
from apps.content import views

urlpatterns = [
    path("health/", views.health, name="content-health"),

    path("courses/", views.courses, name="courses-list"),
    path("courses/<int:course_id>/lessons/", views.course_lessons),
    path("courses/<int:course_id>/progress/", views.course_progress),

    path("lessons/<int:lesson_id>/", views.lesson_detail),
    path("lessons/<int:lesson_id>/progress/", views.lesson_progress),

    path("teacher/analytics/courses/", views.teacher_course_analytics),
    path("teacher/analytics/lessons/", views.teacher_lesson_analytics),
    path("teacher/analytics/classes/", views.teacher_class_analytics),
    path("teacher/analytics/assessments/", views.teacher_assessment_analytics),

    # ✅ ADD THESE — frontend hits /api/v1/teacher/analytics/classes/<id>/students/
    path("teacher/analytics/classes/<int:class_id>/students/", views.teacher_class_students),
    path("teacher/analytics/classes/<int:class_id>/students/<int:student_id>/", views.teacher_student_assessments),
]