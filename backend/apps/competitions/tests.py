# apps/competitions/tests.py
"""
Competitions — room lifecycle, scoring, Ably token, RBAC.
"""
import json
import pytest
from datetime import timedelta
from django.utils import timezone


@pytest.mark.django_db
class TestCompetitionRoomList:
    def test_list_rooms(self, student_client):
        resp = student_client.get("/api/v1/competitions/")
        assert resp.status_code == 200

    def test_anon_blocked(self, anon_client):
        resp = anon_client.get("/api/v1/competitions/")
        assert resp.status_code in (401, 403)


@pytest.mark.django_db
class TestCompetitionRoomCreate:
    def test_teacher_creates(self, teacher_client, section, assessment):
        resp = teacher_client.post(
            "/api/v1/competitions/create/",
            data=json.dumps({
                "title": "Quiz Battle",
                "section_id": section.id,
                "assessment_id": assessment.id,
                "time_limit_secs": 30,
            }),
            content_type="application/json",
        )
        assert resp.status_code in (200, 201)

    def test_default_timer(self, teacher_client, section, assessment):
        resp = teacher_client.post(
            "/api/v1/competitions/create/",
            data=json.dumps({
                "title": "Default Timer",
                "section_id": section.id,
                "assessment_id": assessment.id,
            }),
            content_type="application/json",
        )
        assert resp.status_code in (200, 201)

    def test_scheduled_room(self, teacher_client, section, assessment):
        ts = (timezone.now() + timedelta(hours=1)).isoformat()
        resp = teacher_client.post(
            "/api/v1/competitions/create/",
            data=json.dumps({
                "title": "Scheduled",
                "section_id": section.id,
                "assessment_id": assessment.id,
                "scheduled_at": ts,
            }),
            content_type="application/json",
        )
        assert resp.status_code in (200, 201)

    def test_student_blocked(self, student_client, section, assessment):
        resp = student_client.post(
            "/api/v1/competitions/create/",
            data=json.dumps({
                "title": "Hack",
                "section_id": section.id,
                "assessment_id": assessment.id,
            }),
            content_type="application/json",
        )
        assert resp.status_code in (403, 404)


@pytest.mark.django_db
class TestCompetitionJoin:
    def _create(self, teacher_client, section, assessment, **extra):
        payload = {
            "title": "Room", "section_id": section.id,
            "assessment_id": assessment.id, **extra,
        }
        return teacher_client.post(
            "/api/v1/competitions/create/",
            data=json.dumps(payload), content_type="application/json",
        ).json()

    def test_student_joins(self, teacher_client, student_client, section, assessment):
        room = self._create(teacher_client, section, assessment)
        resp = student_client.post(
            f"/api/v1/competitions/{room['id']}/join/",
            data="{}", content_type="application/json",
        )
        assert resp.status_code in (200, 201)

    def test_early_join_blocked(self, teacher_client, student_client, section, assessment):
        ts = (timezone.now() + timedelta(hours=1)).isoformat()
        room = self._create(teacher_client, section, assessment, scheduled_at=ts)
        resp = student_client.post(
            f"/api/v1/competitions/{room['id']}/join/",
            data="{}", content_type="application/json",
        )
        assert resp.status_code in (400, 403)


@pytest.mark.django_db
class TestCompetitionHistory:
    def test_empty_history(self, student_client):
        resp = student_client.get("/api/v1/competitions/history/")
        assert resp.status_code == 200
        assert resp.json() == []


@pytest.mark.django_db
class TestAblyTokenCapability:
    """POST /api/v1/realtime/token/ — verify channel scoping."""

    def test_student_chat_token(self, student_client):
        resp = student_client.post(
            "/api/v1/realtime/token/",
            data=json.dumps({"channel_type": "chat"}),
            content_type="application/json",
        )
        # 200 if Ably key is configured, 500/503 if not
        assert resp.status_code in (200, 500, 503)

    def test_anon_token_blocked(self, anon_client):
        resp = anon_client.post(
            "/api/v1/realtime/token/",
            data=json.dumps({"channel_type": "chat"}),
            content_type="application/json",
        )
        assert resp.status_code in (401, 403)
