# apps/analytics/tests.py
"""Analytics — verified URLs."""
import pytest


@pytest.mark.django_db
class TestAnalytics:
    def test_heartbeat(self, student_client):
        resp = student_client.post("/api/v1/analytics/heartbeat/")
        assert resp.status_code in (200, 201, 400)

    def test_my_summary(self, student_client):
        resp = student_client.get("/api/v1/analytics/my-summary/")
        assert resp.status_code == 200

    def test_my_risk(self, student_client):
        resp = student_client.get("/api/v1/analytics/my-risk/")
        assert resp.status_code == 200

    def test_class_summary_teacher(self, teacher_client):
        resp = teacher_client.get("/api/v1/analytics/class-summary/")
        # Returns 200 or 400 (missing section_id param)
        assert resp.status_code in (200, 400)

    def test_class_summary_student_blocked(self, student_client):
        resp = student_client.get("/api/v1/analytics/class-summary/")
        assert resp.status_code in (403, 404)
