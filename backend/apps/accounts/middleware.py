from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth import logout
from apps.accounts.models import DeviceSession

class SingleDeviceMiddleware(MiddlewareMixin):

    def process_request(self, request):

        user = request.user

        if not user.is_authenticated:
            return

        if user.role == "STUDENT":
            return

        try:
            device = DeviceSession.objects.get(user=user)
        except DeviceSession.DoesNotExist:
            logout(request)
            return

        if device.device_fingerprint != request.session.session_key:
            logout(request)