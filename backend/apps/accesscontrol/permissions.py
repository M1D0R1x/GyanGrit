import logging
from functools import wraps
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def require_auth(view_func):
    """
    Ensures the request has an authenticated user.
    Use this when no role restriction is needed beyond being logged in.
    For role-restricted views, use require_roles() directly — it includes
    the auth check so you do not need both decorators.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Authentication required"}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper


def require_roles(allowed_roles):
    """
    Ensures the request has an authenticated user whose role is in allowed_roles.

    Usage:
        @require_roles(["ADMIN", "PRINCIPAL"])
        def my_view(request): ...

    Security notes:
    - Returns 401 if unauthenticated (not 403) to avoid leaking endpoint existence.
    - Returns 403 if authenticated but role is not permitted.
    - Guards against missing role attribute (e.g. superuser created via shell).
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({"error": "Authentication required"}, status=401)

            # Guard: role attribute may be missing on shell-created superusers
            user_role = getattr(request.user, "role", None)

            if user_role is None:
                logger.warning(
                    "User id=%s has no role attribute — access denied to protected view.",
                    request.user.id,
                )
                return JsonResponse({"error": "Forbidden"}, status=403)

            if user_role not in allowed_roles:
                logger.warning(
                    "User id=%s role=%s attempted access — allowed roles: %s.",
                    request.user.id,
                    user_role,
                    allowed_roles,
                )
                return JsonResponse({"error": "Forbidden"}, status=403)

            return view_func(request, *args, **kwargs)

        return wrapper
    return decorator