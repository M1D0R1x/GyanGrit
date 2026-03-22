"""
gyangrit/settings/prod.py — Production settings for Render deployment.

All sensitive values come from environment variables.
Never hardcode secrets or domain names here.

Required env vars (see backend/.env.example):
  SECRET_KEY, DATABASE_URL, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS
"""
import os
import dj_database_url
from .base import *

# ─────────────────────────────────────────────────────────────────────────────
# Core
# ─────────────────────────────────────────────────────────────────────────────

DEBUG = False

SECRET_KEY = os.environ["SECRET_KEY"]

# Comma-separated list of allowed host names
# e.g. "gyangrit-backend.onrender.com,api.gyangrit.in"
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "").split(",")

# ─────────────────────────────────────────────────────────────────────────────
# Database — Supabase PostgreSQL via dj-database-url
# ─────────────────────────────────────────────────────────────────────────────

DATABASES = {
    "default": dj_database_url.config(
        default=os.environ["DATABASE_URL"],
        conn_max_age=600,
        conn_health_checks=True,
    )
}
# Required for Supabase pgBouncer transaction-mode pooling
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True

# ─────────────────────────────────────────────────────────────────────────────
# Static files — WhiteNoise serves them from Render (no S3/CDN needed)
# ─────────────────────────────────────────────────────────────────────────────

STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# WhiteNoise middleware should be right after SecurityMiddleware in base.py
# Check MIDDLEWARE order: SecurityMiddleware → WhiteNoiseMiddleware → ...

# ─────────────────────────────────────────────────────────────────────────────
# CORS — locked to specific origins from env
# ─────────────────────────────────────────────────────────────────────────────

# Comma-separated list of allowed origins
# e.g. "https://gyangrit.vercel.app,https://app.gyangrit.in"
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS[:]

# ─────────────────────────────────────────────────────────────────────────────
# Cookies — SameSite=None required for cross-origin sessions
# (Vercel frontend → Render backend)
# ─────────────────────────────────────────────────────────────────────────────

SESSION_COOKIE_SECURE   = True
SESSION_COOKIE_SAMESITE = "None"   # Required for cross-origin credentials

CSRF_COOKIE_SECURE   = True
CSRF_COOKIE_SAMESITE = "None"

# ─────────────────────────────────────────────────────────────────────────────
# HTTPS / Security headers
# ─────────────────────────────────────────────────────────────────────────────

SECURE_SSL_REDIRECT             = True
SECURE_HSTS_SECONDS             = 31536000   # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS  = True
SECURE_HSTS_PRELOAD             = True
SECURE_BROWSER_XSS_FILTER       = True
SECURE_CONTENT_TYPE_NOSNIFF     = True
SECURE_PROXY_SSL_HEADER         = ("HTTP_X_FORWARDED_PROTO", "https")

# ─────────────────────────────────────────────────────────────────────────────
# Logging — structured, goes to Render's log stream
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
        "django": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
