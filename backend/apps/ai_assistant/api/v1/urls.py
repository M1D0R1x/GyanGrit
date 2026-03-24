"""
ai_assistant/api/v1/urls.py
Mounted at: /api/v1/ai/
"""
from django.urls import path
from apps.ai_assistant import views

urlpatterns = [
    path("conversations/",               views.list_conversations),
    path("conversations/<int:conv_id>/",  views.conversation_detail),
    path("conversations/<int:conv_id>/delete/", views.delete_conversation),
    path("chat/",                         views.chat),
]
