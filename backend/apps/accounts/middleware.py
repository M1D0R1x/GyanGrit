# middleware.py
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth import logout
from django.http import HttpRequest
from apps.accounts.models import DeviceSession


class SingleActiveSessionMiddleware(MiddlewareMixin):
    """
    Enforces single active session for non-student users.
    Invalidates old sessions when a new one is detected.
    """

    def process_request(self, request: HttpRequest):
        # Skip for unauthenticated users
        if not request.user.is_authenticated:
            return

        # Skip for students (as per your requirement)
        if request.user.role == "STUDENT":
            return

        # Skip sensitive / public paths to avoid interference
        path = request.path_info.lower()
        if any(
            path.startswith(p)
            for p in [
                "/api/v1/accounts/login/",
                "/api/v1/accounts/verify-otp/",
                "/api/v1/accounts/logout/",
                "/admin/",
                "/static/",
                "/media/",
            ]
        ):
            return

        try:
            device_session = DeviceSession.objects.select_related("user").get(user=request.user)

            current_session_key = request.session.session_key

            # If no session key yet (very rare, but possible on first request)
            if not current_session_key:
                # Force session to be saved/created
                request.session.save()
                current_session_key = request.session.session_key

            if device_session.device_fingerprint != current_session_key:
                # Mismatch → this is an old/stale session → log user out
                logout(request)

                # Clean up the stale record (important!)
                device_session.delete()

                # Optional: log this event
                # from apps.accounts.models import AuditLog
                # AuditLog.objects.create(
                #     actor=request.user,
                #     action="session_invalidated",
                #     target_model="DeviceSession",
                #     target_id=str(device_session.id),
                # )

        except DeviceSession.DoesNotExist:
            # No device session exists → this can happen right after login
            # before the view had chance to create it
            # → do NOT logout here, let the view create it
            pass

        except Exception as e:
            # Very defensive: don't crash the whole site
            # In production: log this
            print(f"SingleSessionMiddleware error: {e}")
            pass