import logging
import time
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth import logout
from apps.accounts.models import DeviceSession

logger = logging.getLogger(__name__)

# Exact paths that must be excluded from session enforcement.
# Using exact match (not prefix) to prevent accidental bypass
# of future endpoints whose path starts with an excluded prefix.
_EXEMPT_PATHS = frozenset([
    "/api/v1/accounts/login/",
    "/api/v1/accounts/verify-otp/",
    "/api/v1/accounts/logout/",
    "/api/v1/accounts/csrf/",
    "/api/v1/accounts/register/",
    "/api/v1/accounts/student-register/",
    "/api/v1/accounts/validate-join-code/",
    "/api/v1/accounts/resend-otp/",
    "/api/v1/academics/districts/",
    "/api/v1/academics/schools/",
])

# Path prefixes that are always exempt (admin UI, static, media)
_EXEMPT_PREFIXES = ("/admin/", "/static/", "/media/")


class SingleActiveSessionMiddleware(MiddlewareMixin):
    """
    Enforces single active session per user across all roles.

    On every authenticated request:
    1. Looks up the stored DeviceSession for the user.
    2. Compares the stored session key with the current request's session key.
    3. If they differ, the user has logged in from another device/browser.
       The current request's session is terminated (logout).

    This implements FR-02 from the SRS: single-device session enforcement.

    Security notes:
    - Exempt paths are exact matches to prevent prefix-collision bypass.
    - Errors are logged with full stack trace — never silently swallowed.
    - DeviceSession is created in login_view / verify_otp after session.save()
      to guarantee session_key is never None.
    """

    def process_request(self, request):
        if not request.user.is_authenticated:
            return

        path = request.path_info

        # Exempt admin UI, static, and media
        if path.startswith(_EXEMPT_PREFIXES):
            return

        # Exempt exact auth paths
        if path in _EXEMPT_PATHS:
            return

        try:
            device_session = DeviceSession.objects.get(user=request.user)

            current_key = request.session.session_key

            # session_key can be None for new anonymous sessions that haven't
            # been saved yet. Save to ensure we have a real key to compare.
            if not current_key:
                request.session.save()
                current_key = request.session.session_key

            if device_session.device_fingerprint != current_key:
                logger.warning(
                    "Session mismatch for user id=%s: stored=%s current=%s — "
                    "forcing logout (single-session enforcement).",
                    request.user.id,
                    device_session.device_fingerprint,
                    current_key,
                )
                logout(request)
                device_session.delete()

                # Return a JSON response so the frontend can show a message
                # instead of silently redirecting to login.
                from django.http import JsonResponse
                return JsonResponse(
                    {"error": "session_kicked", "message": "You were logged out because your account was signed in on another device."},
                    status=401,
                )

        except DeviceSession.DoesNotExist:
            # No device session on record — login view will create one.
            # This is normal immediately after account creation.
            pass

        except Exception:
            # Log with full traceback so production issues are visible.
            # Do NOT swallow silently — this middleware protects session integrity.
            logger.exception(
                "Unexpected error in SingleActiveSessionMiddleware for user id=%s.",
                getattr(request.user, "id", "unknown"),
            )


# ─────────────────────────────────────────────────────────────────────────────
# Inactivity timeout for OTP-protected roles
# ─────────────────────────────────────────────────────────────────────────────
# TEACHER, PRINCIPAL, OFFICIAL log in with OTP — their sessions should be
# stricter. If no API request for 30 min → force logout.
#
# How it works:
#   1. verify_otp() stamps session['_otp_role'] = True
#   2. On each request, this middleware updates session['_last_activity']
#   3. If >30 min since last activity → force logout, return 401
#   4. STUDENT/ADMIN have no _otp_role flag → unaffected
# ─────────────────────────────────────────────────────────────────────────────

OTP_INACTIVITY_SECONDS = 30 * 60  # 30 minutes


class HardSessionExpiryMiddleware(MiddlewareMixin):
    """Logout OTP roles after 30 min of inactivity."""

    def process_request(self, request):
        if not request.user.is_authenticated:
            return

        if not request.session.get("_otp_role"):
            return  # STUDENT/ADMIN — skip, use normal 1-hour sliding window

        now = time.time()
        last_activity = request.session.get("_last_activity")

        if last_activity and (now - last_activity) > OTP_INACTIVITY_SECONDS:
            username = getattr(request.user, "username", "unknown")
            role = getattr(request.user, "role", "unknown")
            logger.info(
                "Inactivity timeout for user=%s role=%s (idle %.0f min) — forcing re-login.",
                username, role, (now - last_activity) / 60,
            )
            logout(request)
            from django.http import JsonResponse
            return JsonResponse(
                {
                    "error": "session_expired",
                    "message": "Your session has expired due to inactivity. Please log in again.",
                },
                status=401,
            )

        # Update last activity timestamp
        request.session["_last_activity"] = now