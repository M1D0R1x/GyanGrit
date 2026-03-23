"""
chatrooms/api/v1/urls.py
Mounted at: /api/v1/chat/
"""
from django.urls import path
from apps.chatrooms import views

urlpatterns = [
    # User-facing
    path("rooms/",                                        views.list_rooms),
    path("rooms/<int:room_id>/",                          views.room_detail),
    path("rooms/<int:room_id>/history/",                  views.message_history),
    path("rooms/<int:room_id>/thread/<int:message_id>/",  views.thread),
    path("rooms/<int:room_id>/message/",                  views.send_message),
    path("rooms/<int:room_id>/pin/<int:message_id>/",     views.pin_message),
    path("rooms/<int:room_id>/pinned/",                   views.pinned_messages),
    path("rooms/<int:room_id>/members/",                  views.room_members),

    # Admin management
    path("admin/rooms/",                                  views.admin_list_rooms),
    path("admin/rooms/<int:room_id>/messages/",           views.admin_room_messages),
]
