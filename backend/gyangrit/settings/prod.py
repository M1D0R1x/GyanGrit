"""
gyangrit/settings/prod.py — Production settings for Oracle Cloud Mumbai.

All sensitive values come from environment variables.
Never hardcode secrets or domain names here.
"""
import os
import logging

import dj_database_url

from .base import *

logger = logging.getLogger(__name__)


def _strip_quotes(val: str) -> str:
    if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
        return val[1:-1]
    return val


def _parse_hosts(raw: str) -> list[str]:
    hosts = []
    for h in raw.split(","):
        h = _strip_quotes(h.strip()).rstrip("/")
        if "://" in h:
            h = h.split("://", 1)[1]
        h = h.split("/")[0]
        if h:
            hosts.append(h)
    return hosts


def _parse_origins(raw: str) -> list[str]:
    origins = []
    for o in raw.split(","):
        o = _strip_quotes(o.strip()).rstrip("/")
        if o:
            origins.append(o)
    return origins


# ─────────────────────────────────────────────────────────────────────────────
# Core
# ─────────────────────────────────────────────────────────────────────────────

DEBUG = False
SECRET_KEY = os.environ["SECRET_KEY"]
_env_hosts = _parse_hosts(os.environ.get("ALLOWED_HOSTS", ""))
# Always allow internal health checks (QStash / nginx / gunicorn pings locally)
ALLOWED_HOSTS = _env_hosts + ["127.0.0.1", "localhost"]

# ─────────────────────────────────────────────────────────────────────────────
# Password hashing — Argon2 is 3-5x faster than PBKDF2 at equal security.
#
# PBKDF2 (Django default): ~130ms per login on Oracle A1 ARM CPU
# Argon2id:                ~30-40ms per login — same security, less CPU
#
# Requires: pip install argon2-cffi (already in prod.txt via django[argon2])
# Django docs: https://docs.djangoproject.com/en/4.2/topics/auth/passwords/
# ─────────────────────────────────────────────────────────────────────────────
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",  # primary — fast
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",  # fallback for old hashes
]

# ─────────────────────────────────────────────────────────────────────────────
# Sentry
# ─────────────────────────────────────────────────────────────────────────────

SENTRY_DSN = os.environ.get("SENTRY_DSN", "")

if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        def _before_send(event, hint):
            """Drop bot-scanner noise from Sentry."""
            # Ignore DisallowedHost — bots hit random hostnames, not a real bug
            exc_info = hint.get("exc_info")
            if exc_info:
                from django.core.exceptions import DisallowedHost
                if isinstance(exc_info[1], DisallowedHost):
                    return None
            # Also drop via logger name (logged path)
            if event.get("logger") == "django.security.DisallowedHost":
                return None
            return event

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[
                DjangoIntegration(
                    transaction_style="url",
                    middleware_spans=True,
                ),
                LoggingIntegration(
                    level=logging.WARNING,
                    event_level=logging.ERROR,
                ),
            ],
            traces_sample_rate=0.3,
            send_default_pii=False,
            environment="production",
            before_send=_before_send,
        )
        logger.info("Sentry initialized.")
    except ImportError:
        logger.warning("sentry-sdk not installed — skipping Sentry init.")

# ─────────────────────────────────────────────────────────────────────────────
# Database — Supabase PostgreSQL (Mumbai region, same as Oracle backend)
# conn_max_age=60: persistent connections — safe with gthread + same-region DB
# ─────────────────────────────────────────────────────────────────────────────

_raw_db_url = os.environ.get("DATABASE_URL", "")
_db_url = _strip_quotes(_raw_db_url)

DATABASES = {
    "default": dj_database_url.config(
        default=_db_url,
        conn_max_age=60,
        conn_health_checks=True,
    )
}
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True

# ─────────────────────────────────────────────────────────────────────────────
# Upstash Redis — session store + cache backend
# ─────────────────────────────────────────────────────────────────────────────

_raw_redis_url = os.environ.get("UPSTASH_REDIS_KV_URL", "")
UPSTASH_REDIS_URL = _strip_quotes(_raw_redis_url)

if UPSTASH_REDIS_URL:
    try:
        import redis  # noqa: F401
        CACHES = {
            "default": {
                "BACKEND": "django.core.cache.backends.redis.RedisCache",
                "LOCATION": UPSTASH_REDIS_URL,
                "OPTIONS": {
                    "ssl_cert_reqs": None,
                },
                "TIMEOUT": 300,  # default 5 min TTL
            }
        }
        SESSION_ENGINE = "django.contrib.sessions.backends.cache"
        SESSION_CACHE_ALIAS = "default"
        logger.info("Redis cache enabled (Upstash). Sessions stored in Redis.")
    except ImportError:
        logger.warning("redis package not installed — using default DB sessions.")

# ─────────────────────────────────────────────────────────────────────────────
# Static files — WhiteNoise
# ─────────────────────────────────────────────────────────────────────────────

STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "gyangrit.storage.RelaxedManifestStaticFilesStorage"

# ─────────────────────────────────────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────────────────────────────────────

CORS_ALLOWED_ORIGINS = _parse_origins(os.environ.get("CORS_ALLOWED_ORIGINS", ""))
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS[:]

# ─────────────────────────────────────────────────────────────────────────────
# Cookies — SameSite=None for cross-origin Vercel → Oracle requests
# ─────────────────────────────────────────────────────────────────────────────

SESSION_COOKIE_SECURE   = True
SESSION_COOKIE_SAMESITE = "None"
CSRF_COOKIE_SECURE      = True
CSRF_COOKIE_SAMESITE    = "None"

# ─────────────────────────────────────────────────────────────────────────────
# HTTPS / Security headers
# ─────────────────────────────────────────────────────────────────────────────

SECURE_SSL_REDIRECT            = True
SECURE_HSTS_SECONDS            = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD            = True
SECURE_BROWSER_XSS_FILTER      = True
SECURE_CONTENT_TYPE_NOSNIFF    = True
SECURE_PROXY_SSL_HEADER        = ("HTTP_X_FORWARDED_PROTO", "https")

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "oracle": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "oracle",
        },
        "null": {
            "class": "logging.NullHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
    "loggers": {
        "django":                      {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "apps":                        {"handlers": ["console"], "level": "INFO",    "propagate": False},
        "gyangrit":                    {"handlers": ["console"], "level": "INFO",    "propagate": False},
        # Suppress DisallowedHost — bot scanners hitting random hostnames, not a bug
        "django.security.DisallowedHost": {"handlers": ["null"], "level": "CRITICAL", "propagate": False},
    },
}
