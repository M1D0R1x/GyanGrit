"""
gyangrit/settings/prod.py — Production settings for Render deployment.

All sensitive values come from environment variables.
Never hardcode secrets or domain names here.

Required env vars (set these in Render dashboard → Environment):
  SECRET_KEY             → random 50-char string
  DATABASE_URL           → postgresql://user:pass@host:port/db?sslmode=require
  ALLOWED_HOSTS          → gyangrit.onrender.com
  CORS_ALLOWED_ORIGINS   → https://gyan-grit.vercel.app
  DJANGO_SETTINGS_MODULE → gyangrit.settings.prod
  DEBUG                  → False

Optional env vars:
  SENTRY_DSN             → https://xxx@xxx.ingest.sentry.io/xxx
  UPSTASH_REDIS_KV_URL   → rediss://default:xxx@xxx.upstash.io:6379
"""
import os
import logging

import dj_database_url

from .base import *

logger = logging.getLogger(__name__)


def _strip_quotes(val: str) -> str:
    """
    Strip surrounding double or single quotes from env var values.
    Render dashboard sometimes wraps values in quotes, which breaks URL parsers.
    e.g. '"postgres://..."' → 'postgres://...'
    """
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

DEBUG = True

SECRET_KEY = os.environ["SECRET_KEY"]

ALLOWED_HOSTS = _parse_hosts(os.environ.get("ALLOWED_HOSTS", ""))

# ─────────────────────────────────────────────────────────────────────────────
# Sentry — error tracking + performance monitoring
#
# Import is conditional — if sentry-sdk is not installed (first deploy before
# pip install runs with new requirements), we skip gracefully.
# ─────────────────────────────────────────────────────────────────────────────

SENTRY_DSN = os.environ.get("SENTRY_DSN", "")

if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

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
        )
        logger.info("Sentry initialized.")
    except ImportError:
        logger.warning("sentry-sdk not installed — skipping Sentry init.")

# ─────────────────────────────────────────────────────────────────────────────
# Database — Supabase PostgreSQL via dj-database-url
#
# IMPORTANT: _strip_quotes() is critical here. Render dashboard can wrap
# DATABASE_URL in double quotes, which breaks dj_database_url.
# e.g. env has: DATABASE_URL="postgres://..." (with literal quotes)
# Without stripping: dj_database_url tries to parse '"postgres://...'
# and fails silently → conn_max_age is set but engine is wrong → 500 on
# any view that hits the DB.
# ─────────────────────────────────────────────────────────────────────────────

_raw_db_url = os.environ.get("DATABASE_URL", "")
_db_url = _strip_quotes(_raw_db_url)

DATABASES = {
    "default": dj_database_url.config(
        default=_db_url,
        conn_max_age=0,     # MUST be 0 with gevent workers
        conn_health_checks=True,
    )
}
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True

# ─────────────────────────────────────────────────────────────────────────────
# Upstash Redis — session store + cache backend
#
# Conditional import: if redis package isn't installed yet, fall back to
# default DB sessions. This makes the first deploy resilient.
# ─────────────────────────────────────────────────────────────────────────────

_raw_redis_url = os.environ.get("UPSTASH_REDIS_KV_URL", "")
UPSTASH_REDIS_URL = _strip_quotes(_raw_redis_url)

if UPSTASH_REDIS_URL:
    try:
        import redis  # noqa: F401 — just check it's importable
        CACHES = {
            "default": {
                "BACKEND": "django.core.cache.backends.redis.RedisCache",
                "LOCATION": UPSTASH_REDIS_URL,
                "OPTIONS": {
                    "ssl_cert_reqs": None,
                },
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
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# ─────────────────────────────────────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────────────────────────────────────

CORS_ALLOWED_ORIGINS = _parse_origins(os.environ.get("CORS_ALLOWED_ORIGINS", ""))
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS[:]

# ─────────────────────────────────────────────────────────────────────────────
# Cookies — SameSite=None required for cross-origin Vercel → Render sessions
# ─────────────────────────────────────────────────────────────────────────────

SESSION_COOKIE_SECURE   = True
SESSION_COOKIE_SAMESITE = "None"

CSRF_COOKIE_SECURE   = True
CSRF_COOKIE_SAMESITE = "None"

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
# Logging — streams to Render log viewer
# ─────────────────────────────────────────────────────────────────────────────

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "render": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "render",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
    "loggers": {
        "django":  {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "apps":    {"handlers": ["console"], "level": "INFO",    "propagate": False},
        "gyangrit": {"handlers": ["console"], "level": "INFO",   "propagate": False},
    },
}
