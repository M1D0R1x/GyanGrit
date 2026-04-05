from .base import *

DEBUG = True

ALLOWED_HOSTS = ["*", "localhost", "127.0.0.1", "10.0.2.2"]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://10.0.2.2:8000",
]

CORS_ALLOW_ALL_ORIGINS = True  # allows Android emulator + any dev client

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://10.0.2.2:8000",
    "http://10.90.215.152:8000",
]

SESSION_COOKIE_DOMAIN = None
CSRF_COOKIE_DOMAIN = None

SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Custom cookie names
SESSION_COOKIE_NAME = "gyangrit_sessionid"
CSRF_COOKIE_NAME = "gyangrit_csrftoken"

# ─────────────────────────────────────────────────────────────────────────────
# Email — console backend in dev
# OTP codes print to terminal instead of sending real emails.
# Production uses Gmail SMTP configured in base.py.
# ─────────────────────────────────────────────────────────────────────────────

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# ─────────────────────────────────────────────────────────────────────────────
# Dev Caching
# ─────────────────────────────────────────────────────────────────────────────

import os
_raw_redis_url = os.environ.get("UPSTASH_REDIS_KV_URL", "")
UPSTASH_REDIS_URL = _raw_redis_url[1:-1] if len(_raw_redis_url) >= 2 and _raw_redis_url[0] == _raw_redis_url[-1] and _raw_redis_url[0] in ('"', "'") else _raw_redis_url

if UPSTASH_REDIS_URL:
    try:
        import redis
        CACHES = {
            "default": {
                "BACKEND": "django.core.cache.backends.redis.RedisCache",
                "LOCATION": UPSTASH_REDIS_URL,
                "OPTIONS": {
                    "ssl_cert_reqs": None,
                },
                "TIMEOUT": 300,
            }
        }
        SESSION_ENGINE = "django.contrib.sessions.backends.cache"
        SESSION_CACHE_ALIAS = "default"
    except ImportError:
        pass
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "gyangrit-local-dev",
        }
    }
