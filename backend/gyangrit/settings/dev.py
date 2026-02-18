from .base import *

# -------------------------------------------------
# Development flags
# -------------------------------------------------
DEBUG = True

ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# -------------------------------------------------
# CORS (Frontend → Backend)
# -------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",   # fixed typo
    "http://127.0.0.1:5174",
]

# ---- CSRF / Session (DEV) ----
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
