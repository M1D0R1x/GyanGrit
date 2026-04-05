# apps/roster/tests.py
"""Roster — verified URLs: /api/v1/roster/records/"""
import pytest


@pytest.mark.django_db
class TestRosterRecords:
    def test_teacher_sees_roster(self, teacher_client):
        resp = teacher_client.get("/api/v1/roster/records/")
        assert resp.status_code == 200

    def test_student_blocked(self, student_client):
        resp = student_client.get("/api/v1/roster/records/")
        assert resp.status_code in (403, 404)
