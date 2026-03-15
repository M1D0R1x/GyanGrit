from django.urls import path
from apps.assessments import views

urlpatterns = [
    # Student-facing
    path("my/", views.my_assessments),
    path("course/<int:course_id>/", views.course_assessments),
    path("<int:assessment_id>/", views.assessment_detail),
    path("<int:assessment_id>/admin/", views.assessment_detail_admin),
    path("<int:assessment_id>/start/", views.start_assessment),
    path("<int:assessment_id>/submit/", views.submit_assessment),
    path("<int:assessment_id>/my-attempts/", views.my_attempts),

    # Admin CRUD
    path("course/<int:course_id>/create/", views.create_assessment),
    path("<int:assessment_id>/update/", views.update_assessment),
    path("<int:assessment_id>/delete/", views.delete_assessment),
    path("<int:assessment_id>/questions/create/", views.create_question),
    path("questions/<int:question_id>/update/", views.update_question),
    path("questions/<int:question_id>/delete/", views.delete_question),

    # Teacher / admin analytics
    path("teacher/analytics/", views.teacher_assessment_analytics),
    path("teacher/analytics/classes/", views.teacher_class_analytics),
    path("teacher/analytics/classes/<int:class_id>/students/", views.teacher_class_students),
    path("teacher/analytics/classes/<int:class_id>/students/<int:student_id>/", views.teacher_student_assessments),
]