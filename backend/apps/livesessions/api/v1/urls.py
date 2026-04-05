"""
livesessions/api/v1/urls.py
Mounted at: /api/v1/live/
"""
from django.urls import path
from apps.livesessions import views

urlpatterns = [
    path("sessions/",                                  views.session_list_create),
    path("sessions/upcoming/",                         views.upcoming_sessions),
    path("sessions/<str:session_id>/start/",           views.session_start),
    path("sessions/<str:session_id>/end/",             views.session_end),
    path("sessions/<str:session_id>/join/",            views.join_session),
    path("sessions/<str:session_id>/token/",           views.session_token),
    path("sessions/<str:session_id>/attendance/",      views.session_attendance),
    path("sessions/<str:session_id>/remind/",          views.session_remind),
    # ── Recording endpoints ────────────────────────────────────────────────────
    path("recording-webhook/",                         views.recording_webhook),
    path("recordings/",                                views.recordings_list),
    path("recordings/auto-sync/",                      views.auto_sync_stale_recordings),
    path("recordings/<str:session_id>/sync/",          views.sync_recording),
    path("recordings/<str:session_id>/",               views.recording_detail),
]
