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
]

# Required for session auth + PATCH/POST
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
]

# -------------------------------------------------
# Database (explicit for clarity, same as base)
# -------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
