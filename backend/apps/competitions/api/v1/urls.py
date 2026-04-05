"""
competitions/api/v1/urls.py
Mounted at: /api/v1/competitions/
Ably token mounted at: /api/v1/realtime/
"""
from django.urls import path
from apps.competitions import views

urlpatterns = [
    path("",                         views.list_rooms),
    path("history/",                 views.competition_history),
    path("create/",                  views.create_room),
    path("<int:room_id>/",           views.room_detail),
    path("<int:room_id>/join/",      views.join_room),
    path("<int:room_id>/start/",     views.start_room),
    path("<int:room_id>/finish/",    views.finish_room),
    path("<int:room_id>/answer/",    views.submit_answer),
]

# Ably token endpoint — separate urlconf mounted at /api/v1/realtime/
realtime_urlpatterns = [
    path("token/", views.ably_token),
]
