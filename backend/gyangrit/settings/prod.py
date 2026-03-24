"""
gyangrit/settings/prod.py — Production settings for Render deployment.

All sensitive values come from environment variables.
Never hardcode secrets or domain names here.

Required env vars (set these in Render dashboard → Environment):
  SECRET_KEY            → random 50-char string
  DATABASE_URL          → postgresql://user:pass@host:port/db?sslmode=require
  ALLOWED_HOSTS         → gyangrit-backend.onrender.com          ← hostname only, no https://, no slash
  CORS_ALLOWED_ORIGINS  → https://gyan-grit.vercel.app           ← full https URL, NO trailing slash
  DJANGO_SETTINGS_MODULE → gyangrit.settings.prod
  DEBUG                 → False
"""
import os
import dj_database_url
from .base import *


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
        # Strip scheme if someone accidentally typed https://
        if "://" in h:
            h = h.split("://", 1)[1]
        # Strip any path
        h = h.split("/")[0]
        if h:
            hosts.append(h)
    return hosts


def _parse_origins(raw: str) -> list[str]:
    """
    Parse CORS_ALLOWED_ORIGINS env var.
    Must be full https:// URL with NO trailing slash.
    Strips trailing slashes defensively.
    e.g. "https://gyan-grit.vercel.app/"  → "https://gyan-grit.vercel.app"
    e.g. "https://gyan-grit.vercel.app"   → "https://gyan-grit.vercel.app"
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
# Database — Supabase PostgreSQL via dj-database-url
# ─────────────────────────────────────────────────────────────────────────────

DATABASES = {
    "default": dj_database_url.config(
        default=os.environ["DATABASE_URL"],
        conn_max_age=0,     # MUST be 0 with gevent workers — persistent connections cause thread-sharing errors
        conn_health_checks=True,
    )
}
# Required for Supabase pgBouncer transaction-mode pooling
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True

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
