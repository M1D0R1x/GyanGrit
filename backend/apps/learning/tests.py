# apps/learning/tests.py
"""
Tests for learning app: paths, enrollments.
"""
import pytest


@pytest.mark.django_db
class TestLearningPaths:
    def test_student_paths(self, student_client):
        resp = student_client.get("/api/v1/learning/paths/")
        assert resp.status_code == 200

    def test_anon_blocked(self, anon_client):
        resp = anon_client.get("/api/v1/learning/paths/")
        assert resp.status_code in (401, 403)


@pytest.mark.django_db
class TestEnrollments:
    def test_student_enrollments(self, student_client):
        resp = student_client.get("/api/v1/learning/enrollments/")
        assert resp.status_code == 200
