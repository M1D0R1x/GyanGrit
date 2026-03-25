import logging
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