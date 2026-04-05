# apps/accesscontrol/tests.py
"""Access control RBAC — verified URLs."""
import pytest


@pytest.mark.django_db
class TestRoleGates:
    def test_admin_system_stats(self, admin_client):
        resp = admin_client.get("/api/v1/accounts/system-stats/")
        assert resp.status_code == 200

    def test_student_stats_blocked(self, student_client):
        resp = student_client.get("/api/v1/accounts/system-stats/")
        assert resp.status_code in (403, 404)

    def test_teacher_cannot_delete_course(self, teacher_client, course):
        resp = teacher_client.delete(f"/api/v1/courses/{course.id}/delete/")
        assert resp.status_code in (403, 404, 405)
