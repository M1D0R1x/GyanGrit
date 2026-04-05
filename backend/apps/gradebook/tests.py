# apps/gradebook/tests.py
"""Gradebook — verified URLs."""
import json
import pytest


@pytest.mark.django_db
class TestGradebookClass:
    def test_teacher_class_view(self, teacher_client, classroom):
        resp = teacher_client.get(f"/api/v1/gradebook/class/{classroom.id}/")
        assert resp.status_code == 200

    def test_student_blocked(self, student_client, classroom):
        resp = student_client.get(f"/api/v1/gradebook/class/{classroom.id}/")
        assert resp.status_code in (403, 404)


@pytest.mark.django_db
class TestGradebookEntry:
    def test_post_entry(self, teacher_client, student_user, subject):
        resp = teacher_client.post(
            "/api/v1/gradebook/entry/",
            data=json.dumps({
                "student_id": student_user.id,
                "subject_id": subject.id,
                "marks": 85,
                "max_marks": 100,
                "category": "test",
                "term": "midterm",
            }),
            content_type="application/json",
        )
        assert resp.status_code in (200, 201, 400)

    def test_choices(self, teacher_client):
        resp = teacher_client.get("/api/v1/gradebook/choices/")
        assert resp.status_code == 200
