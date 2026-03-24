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
  SENTRY_DSN             → https://xxx@xxx.ingest.sentry.io/xxx
  UPSTASH_REDIS_KV_URL   → rediss://default:xxx@xxx.upstash.io:6379
"""
import os
import logging

import dj_database_url
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

from .base import *

logger = logging.getLogger(__name__)


def _parse_hosts(raw: str) -> list[str]:
    """
    Parse ALLOWED_HOSTS env var.
    Accepts: hostname only, or full URL (strips scheme + path).
    e.g. "https://gyangrit.onrender.com/" → "gyangrit.onrender.com"
    e.g. "gyangrit.onrender.com"          → "gyangrit.onrender.com"
    """
    hosts = []
    for h in raw.split(","):
        h = h.strip().rstrip("/")
        if "://" in h:
            h = h.split("://", 1)[1]
        h = h.split("/")[0]
        if h:
            hosts.append(h)
    return hosts


def _parse_origins(raw: str) -> list[str]:
    """
    Parse CORS_ALLOWED_ORIGINS env var.
    Must be full https:// URL with NO trailing slash.
    Strips trailing slashes defensively.
    """
    origins = []
    for o in raw.split(","):
        o = o.strip().rstrip("/")
        if o:
            origins.append(o)
    return origins


# ─────────────────────────────────────────────────────────────────────────────
# Core
# ─────────────────────────────────────────────────────────────────────────────

DEBUG = False

SECRET_KEY = os.environ["SECRET_KEY"]

ALLOWED_HOSTS = _parse_hosts(os.environ.get("ALLOWED_HOSTS", ""))

# ─────────────────────────────────────────────────────────────────────────────
# Sentry — error tracking + performance monitoring
#
# Captures: unhandled exceptions, slow DB queries, 500 responses.
# Sends to Sentry dashboard at https://gyangrit.sentry.io
#
# traces_sample_rate=0.3 → 30% of requests traced (good for a school app).
# send_default_pii=False → never send emails/usernames to Sentry.
# ─────────────────────────────────────────────────────────────────────────────

SENTRY_DSN = os.environ.get("SENTRY_DSN", "")

if SENTRY_DSN:
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
        # Don't send health check transactions to Sentry — they're noise
        traces_sampler=lambda ctx: 0 if "/health/" in (ctx.get("wsgi_environ", {}).get("PATH_INFO", "")) else 0.3,
    )
    logger.info("Sentry initialized: DSN=%s...", SENTRY_DSN[:40])

# ─────────────────────────────────────────────────────────────────────────────
# Database — Supabase PostgreSQL via dj-database-url
# ─────────────────────────────────────────────────────────────────────────────

DATABASES = {
    "default": dj_database_url.config(
        default=os.environ["DATABASE_URL"],
        conn_max_age=0,     # MUST be 0 with gevent workers
        conn_health_checks=True,
    )
}
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True

# ─────────────────────────────────────────────────────────────────────────────
# Upstash Redis — session store + cache backend
#
# Replaces Django's default DB-backed sessions. Benefits:
#   1. Sessions survive Render redeploys (DB sessions don't, since the
#      Django session table is local to the container).
#   2. Much faster reads than hitting Supabase for every request.
#   3. Upstash free tier: 10k commands/day, 256MB — plenty for a school app.
#
# Uses TLS (rediss://) to Upstash's global endpoint.
# SESSION_ENGINE switches from django.contrib.sessions.backends.db
# to django.contrib.sessions.backends.cache.
# ─────────────────────────────────────────────────────────────────────────────

UPSTASH_REDIS_URL = os.environ.get("UPSTASH_REDIS_KV_URL", "")

if UPSTASH_REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": UPSTASH_REDIS_URL,
            "OPTIONS": {
                "ssl_cert_reqs": None,  # Upstash uses self-signed TLS
            },
        }
    }
    SESSION_ENGINE = "django.contrib.sessions.backends.cache"
    SESSION_CACHE_ALIAS = "default"
    logger.info("Redis cache enabled (Upstash). Sessions stored in Redis.")

# ─────────────────────────────────────────────────────────────────────────────
# Static files — WhiteNoise serves them (no nginx / S3 needed)
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
        "django": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "apps":   {"handlers": ["console"], "level": "INFO",    "propagate": False},
    },
}
