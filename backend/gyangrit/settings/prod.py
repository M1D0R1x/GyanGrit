from .base import *

# -------------------------------------------------
# Production flags
# -------------------------------------------------
DEBUG = False

# -------------------------------------------------
# Hosts (update with your actual domain)
# -------------------------------------------------
ALLOWED_HOSTS = [
    "gyangrit.com",
    "www.gyangrit.com",
    # Add your Supabase / Vercel / Railway domain here when deployed
]

# -------------------------------------------------
# Security hardening
# -------------------------------------------------
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# -------------------------------------------------
# CORS (LOCKED DOWN)
# -------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    "https://gyangrit.com",
    "https://www.gyangrit.com",
    # Add your frontend domain (Vercel/Netlify) here
]

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    "https://gyangrit.com",
    "https://www.gyangrit.com",
]
