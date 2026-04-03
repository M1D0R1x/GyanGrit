# apps/ai_assistant/ratelimit.py
"""
Redis-based sliding-window rate limiter for the AI chatbot (ADR-003).

Replaces the previous time.sleep() approach which blocked Gunicorn gthread
workers and reduced effective concurrency from 20 to 1 per retry.

Usage:
    from apps.ai_assistant.ratelimit import check_ai_rate_limit

    if not check_ai_rate_limit(request.user.id):
        return JsonResponse({"error": "Too many requests. Try again in a minute."}, status=429)

Limit: 10 AI requests per user per minute.
This is PER-USER so a single busy user can't starve others.
"""
import logging
import time

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Configurable limits
AI_RATE_LIMIT_PER_MIN = 10   # max AI requests per user per 60s window
WINDOW_SECONDS = 60           # sliding window size
KEY_TTL = 90                  # Redis key TTL — slightly longer than window for safety


def check_ai_rate_limit(user_id: int, max_per_minute: int = AI_RATE_LIMIT_PER_MIN) -> bool:
    """
    Check and increment the AI request count for a user in a 60-second window.

    Uses Redis INCR + EXPIRE for an atomic counter-based sliding window.
    The key is bucketed per minute (floor division), so a new bucket opens
    every 60 seconds — this is a "fixed window per minute" strategy.

    Args:
        user_id:        The authenticated user's primary key.
        max_per_minute: Maximum allowed requests per 60-second window.

    Returns:
        True  → request is allowed (count is within limit)
        False → request is blocked (count exceeds limit)
    """
    minute_bucket = int(time.time() // WINDOW_SECONDS)
    key = f"ai_rate:{user_id}:{minute_bucket}"

    try:
        count = cache.incr(key)
        if count == 1:
            # First request in this window — set TTL
            cache.expire(key, KEY_TTL)
    except Exception as exc:
        # Redis unavailable — fail open (don't block the user)
        logger.warning("Rate limiter Redis error: %s — allowing request", exc)
        return True

    allowed = count <= max_per_minute
    if not allowed:
        logger.warning(
            "AI rate limit hit: user_id=%s count=%d limit=%d",
            user_id, count, max_per_minute,
        )
    return allowed


def get_ai_request_count(user_id: int) -> int:
    """
    Returns the current AI request count for the user in the current window.
    Useful for returning X-RateLimit-Remaining headers.
    """
    minute_bucket = int(time.time() // WINDOW_SECONDS)
    key = f"ai_rate:{user_id}:{minute_bucket}"
    try:
        count = cache.get(key, default=0)
        return int(count)
    except Exception:
        return 0
