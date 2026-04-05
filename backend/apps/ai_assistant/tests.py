# apps/ai_assistant/tests.py
"""AI assistant — verified URLs: /api/v1/ai/"""
import json
import pytest


@pytest.mark.django_db
class TestAIConversations:
    def test_list_conversations(self, student_client):
        resp = student_client.get("/api/v1/ai/conversations/")
        assert resp.status_code == 200

    def test_anon_blocked(self, anon_client):
        resp = anon_client.get("/api/v1/ai/conversations/")
        assert resp.status_code in (401, 403)
