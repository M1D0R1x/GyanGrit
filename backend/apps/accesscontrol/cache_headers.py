# apps.accesscontrol.cache_headers
"""
HTTP cache headers for API responses.

On slow networks (3G/4G in Indian government schools), the browser round-trip
to the API server takes 200-800ms even for tiny JSON responses. By setting
Cache-Control: private, max-age=N, stale-while-revalidate=M on stable data,
the browser can serve from disk cache instantly and refresh in the background.

Usage:
    @cache_api(max_age=60, stale=120)
    def my_view(request):
        return JsonResponse(...)

The decorator adds these headers to successful (2xx) responses:
    Cache-Control: private, max-age=60, stale-while-revalidate=120
    Vary: Cookie

"private" ensures CDNs don't cache user-specific data (only the user's browser).
"Vary: Cookie" ensures different sessions get different cached responses.
"""

from functools import wraps


def cache_api(max_age: int = 60, stale: int = 120):
    """
    Decorator to add Cache-Control headers to API responses.

    Args:
        max_age: Seconds the response is considered fresh (browser uses cache without network)
        stale:   Seconds the browser can use a stale cache while revalidating in background
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            response = view_func(request, *args, **kwargs)
            # Only cache successful GET responses
            if request.method == "GET" and 200 <= response.status_code < 300:
                response["Cache-Control"] = (
                    f"private, max-age={max_age}, stale-while-revalidate={stale}"
                )
                response["Vary"] = "Cookie"
            return response
        return wrapper
    return decorator
