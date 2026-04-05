# apps/livesessions/tests.py
"""Live sessions — verified URLs."""
import pytest


@pytest.mark.django_db
class TestLiveSessionList:
    def test_teacher_list(self, teacher_client):
        resp = teacher_client.get("/api/v1/live/sessions/")
        assert resp.status_code == 200

    def test_student_blocked(self, student_client):
        resp = student_client.get("/api/v1/live/sessions/")
        assert resp.status_code in (403, 404)


@pytest.mark.django_db
class TestRecordings:
    def test_list_recordings(self, teacher_client):
        resp = teacher_client.get("/api/v1/live/recordings/")
        assert resp.status_code == 200
