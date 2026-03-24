"""
livesessions/api/v1/urls.py
Mounted at: /api/v1/live/
"""
from django.urls import path
from apps.livesessions import views

urlpatterns = [
    path("sessions/",                                  views.session_list_create),
    path("sessions/upcoming/",                         views.upcoming_sessions),
    path("sessions/<int:session_id>/start/",           views.session_start),
    path("sessions/<int:session_id>/end/",             views.session_end),
    path("sessions/<int:session_id>/join/",            views.join_session),
    path("sessions/<int:session_id>/token/",           views.session_token),
    path("sessions/<int:session_id>/attendance/",      views.session_attendance),
]
