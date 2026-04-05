# apps/content/tests.py
"""
Tests for content app — courses, lessons, progress.
URLs verified against actual urlpatterns.
"""
import json
import pytest


@pytest.mark.django_db
class TestCourseList:
    def test_student_sees_courses(self, student_client, course):
        resp = student_client.get("/api/v1/courses/")
        assert resp.status_code == 200

    def test_anon_blocked(self, anon_client):
        resp = anon_client.get("/api/v1/courses/")
        assert resp.status_code in (401, 403)


@pytest.mark.django_db
class TestCourseCreate:
    def test_admin_creates(self, admin_client, subject):
        resp = admin_client.post(
            "/api/v1/courses/create/",
            data=json.dumps({"title": "Science 10", "subject_id": subject.id, "grade": 10}),
            content_type="application/json",
        )
        assert resp.status_code in (200, 201)

    def test_student_blocked(self, student_client, subject):
        resp = student_client.post(
            "/api/v1/courses/create/",
            data=json.dumps({"title": "Hack", "subject_id": subject.id, "grade": 10}),
            content_type="application/json",
        )
        assert resp.status_code in (403, 404)


@pytest.mark.django_db
class TestLessons:
    def test_lesson_list(self, admin_client, course, lesson):
        resp = admin_client.get(f"/api/v1/courses/{course.id}/lessons/")
        assert resp.status_code == 200

    def test_lesson_detail(self, admin_client, lesson):
        resp = admin_client.get(f"/api/v1/lessons/{lesson.id}/")
        assert resp.status_code == 200


@pytest.mark.django_db
class TestLessonProgress:
    def test_mark_progress(self, student_client, lesson):
        resp = student_client.post(
            f"/api/v1/lessons/{lesson.id}/progress/",
            data=json.dumps({"completed": True}),
            content_type="application/json",
        )
        # 200/201 if enrolled, 403 if not enrolled
        assert resp.status_code in (200, 201, 403)


@pytest.mark.django_db
class TestCourseProgress:
    def test_batch_progress(self, student_client, course):
        resp = student_client.get(f"/api/v1/courses/progress/batch/?ids={course.id}")
        assert resp.status_code == 200
