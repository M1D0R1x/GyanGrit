from django.urls import path
from apps.assessments import views

urlpatterns = [
    path("course/<int:course_id>/", views.course_assessments),
    path("<int:assessment_id>/", views.assessment_detail),
    path("<int:assessment_id>/start/", views.start_assessment),
    path("<int:assessment_id>/submit/", views.submit_assessment),
]
