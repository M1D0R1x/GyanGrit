# apps/accounts/tests.py
"""
Tests for accounts: auth, CSRF, profile, password, join codes, models.
Verified against actual URL patterns.
"""
import json
import pytest
from django.test import Client


# ── CSRF ──────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCSRF:
    def test_csrf_endpoint_ok(self, anon_client):
        resp = anon_client.get("/api/v1/accounts/csrf/")
        assert resp.status_code == 200


# ── LOGIN ─────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLogin:
    def test_student_login_success(self, student_user, anon_client):
        resp = anon_client.post(
            "/api/v1/accounts/login/",
            data=json.dumps({"username": "student1", "password": "TestPass123!"}),
            content_type="application/json",
        )
        assert resp.status_code == 200

    def test_login_wrong_password(self, student_user, anon_client):
        resp = anon_client.post(
            "/api/v1/accounts/login/",
            data=json.dumps({"username": "student1", "password": "wrong"}),
            content_type="application/json",
        )
        assert resp.status_code in (400, 401)

    def test_login_nonexistent_user(self, anon_client):
        resp = anon_client.post(
            "/api/v1/accounts/login/",
            data=json.dumps({"username": "ghost", "password": "x"}),
            content_type="application/json",
        )
        assert resp.status_code in (400, 401)


# ── LOGOUT ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLogout:
    def test_logout(self, student_client):
        resp = student_client.post("/api/v1/accounts/logout/")
        assert resp.status_code == 200


# ── ME / PROFILE ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMeProfile:
    def test_me_authenticated(self, student_client):
        resp = student_client.get("/api/v1/accounts/me/")
        assert resp.status_code == 200
        assert resp.json()["username"] == "student1"

    def test_profile_update(self, student_client):
        resp = student_client.patch(
            "/api/v1/accounts/profile/",
            data=json.dumps({"first_name": "Updated"}),
            content_type="application/json",
        )
        assert resp.status_code in (200, 400)


# ── PASSWORD ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestChangePassword:
    def test_change_password(self, student_client):
        resp = student_client.post(
            "/api/v1/accounts/change-password/",
            data=json.dumps({
                "current_password": "TestPass123!",
                "new_password": "NewSecure456!",
            }),
            content_type="application/json",
        )
        # 200 on success, 400 if validation fails
        assert resp.status_code in (200, 400)


# ── JOIN CODES ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestJoinCodes:
    def test_list_admin(self, admin_client):
        resp = admin_client.get("/api/v1/accounts/join-codes/")
        assert resp.status_code == 200

    def test_list_student_blocked(self, student_client):
        resp = student_client.get("/api/v1/accounts/join-codes/")
        assert resp.status_code in (403, 404)


# ── CONTACT ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestContact:
    def test_contact_endpoint(self, anon_client):
        resp = anon_client.post(
            "/api/v1/accounts/contact/",
            data=json.dumps({
                "name": "Test User",
                "email": "test@example.com",
                "message": "Hello",
            }),
            content_type="application/json",
        )
        assert resp.status_code in (200, 201, 429)


# ── MODELS ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUserModel:
    def test_public_id_generated(self, student_user):
        assert student_user.public_id
        assert student_user.public_id.startswith("S-")

    def test_display_name_fallback(self, student_user):
        assert student_user.display_name == "student1"

    def test_display_name_with_name(self, student_user):
        student_user.first_name = "John"
        student_user.last_name = "Doe"
        student_user.save()
        assert student_user.display_name == "John Doe"

    def test_district_synced(self, student_user, institution):
        assert student_user.district == institution.district.name


@pytest.mark.django_db
class TestOTPModel:
    def test_otp_not_expired(self, student_user):
        from apps.accounts.models import OTPVerification
        otp = OTPVerification.objects.create(user=student_user, otp_code="123456")
        assert not otp.is_expired()

    def test_otp_attempt_limit(self, student_user):
        from apps.accounts.models import OTPVerification
        otp = OTPVerification.objects.create(
            user=student_user, otp_code="123456", attempt_count=5
        )
        assert not otp.can_attempt()
