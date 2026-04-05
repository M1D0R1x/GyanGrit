# apps/academics/tests.py
"""
Tests for academics app: subjects, institutions, districts.
"""
import pytest


@pytest.mark.django_db
class TestSubjects:
    def test_list_subjects(self, student_client, subject):
        resp = student_client.get("/api/v1/academics/subjects/")
        assert resp.status_code == 200

    def test_anon_blocked(self, anon_client):
        resp = anon_client.get("/api/v1/academics/subjects/")
        assert resp.status_code in (401, 403)


@pytest.mark.django_db
class TestInstitutions:
    def test_admin_sees_institutions(self, admin_client, institution):
        resp = admin_client.get("/api/v1/academics/institutions/")
        assert resp.status_code == 200

    def test_student_blocked(self, student_client):
        resp = student_client.get("/api/v1/academics/institutions/")
        assert resp.status_code in (403, 404)


@pytest.mark.django_db
class TestDistricts:
    def test_admin_sees_districts(self, admin_client, district):
        resp = admin_client.get("/api/v1/academics/districts/")
        assert resp.status_code == 200
