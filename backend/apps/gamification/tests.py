# apps/gamification/tests.py
"""Gamification — verified URLs: /api/v1/gamification/me/, leaderboard/class/, leaderboard/school/"""
import pytest


@pytest.mark.django_db
class TestGamificationSummary:
    def test_student_summary(self, student_client):
        resp = student_client.get("/api/v1/gamification/me/")
        assert resp.status_code == 200

    def test_anon_blocked(self, anon_client):
        resp = anon_client.get("/api/v1/gamification/me/")
        assert resp.status_code in (401, 403)


@pytest.mark.django_db
class TestLeaderboard:
    def test_class_leaderboard(self, student_client):
        resp = student_client.get("/api/v1/gamification/leaderboard/class/")
        assert resp.status_code in (200, 400)

    def test_school_leaderboard(self, student_client):
        resp = student_client.get("/api/v1/gamification/leaderboard/school/")
        assert resp.status_code in (200, 400)
