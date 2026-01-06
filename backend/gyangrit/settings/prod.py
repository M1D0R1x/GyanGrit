from .base import *

# -------------------------------------------------
# Production flags
# -------------------------------------------------
DEBUG = False

# -------------------------------------------------
# Hosts (REQUIRED)
# Replace with actual domain / IP when deployed
# -------------------------------------------------
ALLOWED_HOSTS = [
    "gyangrit.com",          # example domain
    "www.gyangrit.com",
    "127.0.0.1",             # optional (remove later)
]

# -------------------------------------------------
# Security hardening
# -------------------------------------------------
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True

CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SAMESITE = "Lax"

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# -------------------------------------------------
# CORS (LOCKED DOWN)
# -------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    "https://gyangrit.com",
    "https://www.gyangrit.com",
]

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    "https://gyangrit.com",
    "https://www.gyangrit.com",
]

# -------------------------------------------------
# Database
# (SQLite ok for capstone; swap later if needed)
# -------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
