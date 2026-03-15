from django.urls import path
from apps.content import views

urlpatterns = [
    path("health/", views.health, name="content-health"),

    # Courses
    path("courses/", views.courses, name="courses-list"),
    path("courses/create/", views.create_course),
    path("courses/<int:course_id>/", views.update_course),
    path("courses/<int:course_id>/delete/", views.delete_course),
    path("courses/<int:course_id>/lessons/", views.course_lessons),
    path("courses/<int:course_id>/lessons/all/", views.course_lessons_all),
    path("courses/<int:course_id>/lessons/create/", views.create_lesson),
    path("courses/<int:course_id>/progress/", views.course_progress),

    # Lessons
    path("lessons/<int:lesson_id>/", views.lesson_detail),
    path("lessons/<int:lesson_id>/update/", views.update_lesson),
    path("lessons/<int:lesson_id>/delete/", views.delete_lesson),
    path("lessons/<int:lesson_id>/progress/", views.lesson_progress),
    path("lessons/<int:lesson_id>/notes/", views.add_lesson_note),

    # Teacher analytics
    path("teacher/analytics/courses/", views.teacher_course_analytics),
    path("teacher/analytics/lessons/", views.teacher_lesson_analytics),
    path("teacher/analytics/classes/", views.teacher_class_analytics),
    path("teacher/analytics/assessments/", views.teacher_assessment_analytics),
    path("teacher/analytics/classes/<int:class_id>/students/", views.teacher_class_students),
    path("teacher/analytics/classes/<int:class_id>/students/<int:student_id>/", views.teacher_student_assessments),
]