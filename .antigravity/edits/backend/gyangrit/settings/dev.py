from .base import *

DEBUG = True

ALLOWED_HOSTS = ["*", "localhost", "127.0.0.1", "10.0.2.2"]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:8000",
    "http://10.0.2.2:8000",
]

CORS_ALLOW_ALL_ORIGINS = True  # allows Android emulator + any dev client

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:8000",
    "http://10.0.2.2:8000",
    "http://10.90.215.152:8000",
]

# Cookie domains — must be "localhost" so both the frontend (localhost:5173)
# and backend (localhost:8000) share the same cookie jar.
SESSION_COOKIE_DOMAIN = "localhost"
CSRF_COOKIE_DOMAIN = "localhost"

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
# Production uses Zoho SMTP configured in base.py.
# ─────────────────────────────────────────────────────────────────────────────

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
