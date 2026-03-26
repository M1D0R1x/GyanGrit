"""
analytics/api/v1/urls.py
Mounted at: /api/v1/analytics/
"""
from django.urls import path
from apps.analytics import views

urlpatterns = [
    path("heartbeat/",      views.heartbeat),
    path("event/",          views.log_event),
    path("my-summary/",     views.my_summary),
    path("class-summary/",  views.class_summary),
]
