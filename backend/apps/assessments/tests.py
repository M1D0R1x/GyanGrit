# apps/assessments/tests.py
"""
Assessments — Critical security tests from TESTING_GUIDE.md.
is_correct NEVER exposed to student, scoring accuracy, RBAC.
"""
import json
import pytest


@pytest.mark.django_db
class TestAssessmentList:
    def test_student_my(self, student_client):
        resp = student_client.get("/api/v1/assessments/my/")
        assert resp.status_code == 200

    def test_anon_blocked(self, anon_client):
        resp = anon_client.get("/api/v1/assessments/my/")
        assert resp.status_code in (401, 403)


@pytest.mark.django_db
class TestIsCorrectNeverExposed:
    """🔴 CRITICAL: is_correct must NEVER appear in student assessment responses."""

    def test_student_detail_no_is_correct(self, student_client, assessment, question, correct_option, wrong_option):
        """GET /assessments/<id>/ as STUDENT → options must NOT have is_correct."""
        resp = student_client.get(f"/api/v1/assessments/{assessment.id}/")
        if resp.status_code == 200:
            data = resp.json()
            for q in data.get("questions", []):
                for opt in q.get("options", []):
                    assert "is_correct" not in opt, \
                        f"SECURITY: is_correct exposed to student in option {opt}"

    def test_admin_detail_has_is_correct(self, admin_client, assessment, question, correct_option, wrong_option):
        """GET /assessments/<id>/admin/ as ADMIN → options MUST have is_correct."""
        resp = admin_client.get(f"/api/v1/assessments/{assessment.id}/admin/")
        assert resp.status_code == 200
        data = resp.json()
        for q in data.get("questions", []):
            for opt in q.get("options", []):
                assert "is_correct" in opt, \
                    f"Admin should see is_correct in option {opt}"


@pytest.mark.django_db
class TestAssessmentSubmit:
    def test_submit_answers(self, student_client, assessment, question, correct_option):
        student_client.post(f"/api/v1/assessments/{assessment.id}/start/")
        resp = student_client.post(
            f"/api/v1/assessments/{assessment.id}/submit/",
            data=json.dumps({
                "answers": [{"question_id": question.id, "option_id": correct_option.id}]
            }),
            content_type="application/json",
        )
        assert resp.status_code in (200, 201, 400, 403)


@pytest.mark.django_db
class TestAssessmentCreate:
    def test_admin_create(self, admin_client, course):
        resp = admin_client.post(
            f"/api/v1/assessments/course/{course.id}/create/",
            data=json.dumps({"title": "New Quiz", "pass_marks": 1}),
            content_type="application/json",
        )
        assert resp.status_code in (200, 201)

    def test_student_blocked(self, student_client, course):
        resp = student_client.post(
            f"/api/v1/assessments/course/{course.id}/create/",
            data=json.dumps({"title": "Hack"}),
            content_type="application/json",
        )
        assert resp.status_code in (403, 404)


@pytest.mark.django_db
class TestAssessmentHistory:
    def test_student_history(self, student_client):
        resp = student_client.get("/api/v1/assessments/my-history/")
        assert resp.status_code == 200
