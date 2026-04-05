"""
gyangrit/settings/test.py

Test-only settings: uses SQLite in-memory for fast, isolated tests.
No external dependencies (no Supabase, no Redis).
"""
from .base import *  # noqa: F401, F403
from pathlib import Path

DEBUG = True

# ── SQLite in-memory for speed ────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# ── Disable Redis cache in tests ──────────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "gyangrit-test",
    }
}

# ── Console email ─────────────────────────────────────────────────────────────
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# ── Disable CSRF enforcement in tests ─────────────────────────────────────────
MIDDLEWARE = [m for m in MIDDLEWARE if "CsrfViewMiddleware" not in m]  # noqa: F405

# ── Faster password hashing ───────────────────────────────────────────────────
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# ── Session ───────────────────────────────────────────────────────────────────
SESSION_ENGINE = "django.contrib.sessions.backends.db"

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {}
