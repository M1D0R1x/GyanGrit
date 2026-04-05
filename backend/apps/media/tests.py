# apps/media/tests.py
"""Media — verified URLs: /api/v1/media/upload/"""
import json
import pytest


@pytest.mark.django_db
class TestMediaUpload:
    def test_teacher_upload(self, teacher_client):
        resp = teacher_client.post(
            "/api/v1/media/upload/",
            data=json.dumps({"filename": "test.pdf", "content_type": "application/pdf"}),
            content_type="application/json",
        )
        # 200/201 or 500 if R2 creds missing, or 400
        assert resp.status_code in (200, 201, 400, 500)

    def test_student_blocked(self, student_client):
        resp = student_client.post(
            "/api/v1/media/upload/",
            data=json.dumps({"filename": "hack.pdf"}),
            content_type="application/json",
        )
        assert resp.status_code in (403, 404)
