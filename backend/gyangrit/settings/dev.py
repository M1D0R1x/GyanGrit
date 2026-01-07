from .base import *

# -------------------------------------------------
# Development flags
# -------------------------------------------------
DEBUG = True

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
]

# -------------------------------------------------
# CORS (Frontend → Backend)
# -------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",  # Added 5174 variant for completeness
]

# Required for session auth + PATCH/POST
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://http://localhost:5174",
    "http://127.0.0.1:5174",
]

# =================================================
# CRITICAL FOR CROSS-ORIGIN SESSION AUTH (dev only)
# =================================================
# SameSite=Lax blocks cookies on cross-origin fetches
# In development (HTTP, different ports), we must use None + Secure=False
SESSION_COOKIE_SAMESITE = "None"
SESSION_COOKIE_SECURE = False  # Must be False on HTTP

CSRF_COOKIE_SAMESITE = "None"
CSRF_COOKIE_SECURE = False  # Must be False on HTTP

# -------------------------------------------------
# Database (explicit for clarity, same as base)
# -------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}