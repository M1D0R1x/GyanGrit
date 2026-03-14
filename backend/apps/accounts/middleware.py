# middleware.py
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth import logout
from django.http import HttpRequest
from apps.accounts.models import DeviceSession


class SingleActiveSessionMiddleware(MiddlewareMixin):
    """
    Enforces single active session for ALL authenticated users.
    Invalidates old sessions when a new one is detected.
    """

    def process_request(self, request: HttpRequest):
        # Skip for unauthenticated users
        if not request.user.is_authenticated:
            return

        # ✅ REMOVED student skip — all roles enforce single session now

        # Skip sensitive / public paths to avoid interference
        path = request.path_info.lower()
        if any(
            path.startswith(p)
            for p in [
                "/api/v1/accounts/login/",
                "/api/v1/accounts/verify-otp/",
                "/api/v1/accounts/logout/",
                "/api/v1/accounts/csrf/",
                "/admin/",
                "/static/",
                "/media/",
            ]
        ):
            return

        try:
            device_session = DeviceSession.objects.select_related("user").get(user=request.user)

            current_session_key = request.session.session_key

            if not current_session_key:
                request.session.save()
                current_session_key = request.session.session_key

            if device_session.device_fingerprint != current_session_key:
                logout(request)
                device_session.delete()

        except DeviceSession.DoesNotExist:
            # No device session yet — login view will create it
            pass

        except Exception as e:
            print(f"SingleSessionMiddleware error: {e}")
            pass