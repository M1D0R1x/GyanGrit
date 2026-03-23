"""
chatrooms/api/v1/urls.py
Mounted at: /api/v1/chat/
"""
from django.urls import path
from apps.chatrooms import views

urlpatterns = [
    path("rooms/",                                views.list_rooms),
    path("rooms/<int:room_id>/",                  views.room_detail),
    path("rooms/<int:room_id>/history/",          views.message_history),
    path("rooms/<int:room_id>/message/",          views.save_message),
    path("rooms/<int:room_id>/pin/<int:message_id>/", views.pin_message),
    path("rooms/<int:room_id>/pinned/",           views.pinned_messages),
]
