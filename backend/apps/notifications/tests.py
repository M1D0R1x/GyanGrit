# apps/notifications/tests.py
"""Notifications — verified URLs."""
import json
import pytest


@pytest.mark.django_db
class TestNotificationList:
    def test_list_authenticated(self, student_client):
        resp = student_client.get("/api/v1/notifications/")
        assert resp.status_code == 200

    def test_list_anon(self, anon_client):
        resp = anon_client.get("/api/v1/notifications/")
        assert resp.status_code in (401, 403)


@pytest.mark.django_db
class TestNotificationRead:
    def test_read_all(self, student_client):
        resp = student_client.post("/api/v1/notifications/read-all/")
        assert resp.status_code == 200


@pytest.mark.django_db
class TestNotificationSend:
    def test_student_cannot_send(self, student_client):
        resp = student_client.post(
            "/api/v1/notifications/send/",
            data=json.dumps({"title": "Hack", "message": "x", "target_role": "STUDENT"}),
            content_type="application/json",
        )
        assert resp.status_code in (403, 404)
