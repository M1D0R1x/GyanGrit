"""
gyangrit/settings/base.py

Shared settings loaded by both dev.py and prod.py.
Do NOT put environment-specific values here — those go in dev.py / prod.py.
"""
from pathlib import Path
import os
from urllib.parse import urlparse
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-change-this")

DEBUG = False
ALLOWED_HOSTS = ["*", "0.0.0.0", "10.0.2.2", "localhost", "127.0.0.1"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "apps.accounts.apps.AccountsConfig",
    "apps.content.apps.ContentConfig",
    "apps.learning.apps.LearningConfig",
    "apps.assessments.apps.AssessmentsConfig",
    "apps.accesscontrol.apps.AccesscontrolConfig",
    "apps.roster.apps.RosterConfig",
    "apps.academics.apps.AcademicsConfig",
    "apps.media.apps.MediaConfig",
    "apps.notifications",
    "apps.gamification",
    "apps.gradebook.apps.GradebookConfig",
]

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    # CorsMiddleware MUST be first so CORS headers are added before any response
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # WhiteNoise: serves static files in production without a separate web server.
    # Must be right after SecurityMiddleware and before all others.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.accounts.middleware.SingleActiveSessionMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "gyangrit.urls"
WSGI_APPLICATION = "gyangrit.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# Database
# Parsed from DATABASE_URL env var. Both dev and prod use PostgreSQL (Supabase).
# Falls back to SQLite only if DATABASE_URL is completely absent (should never
# happen in practice — Supabase is always set in .env).
# ─────────────────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    url = urlparse(DATABASE_URL)
    DATABASES = {
        "default": {
            "ENGINE":   "django.db.backends.postgresql",
            "NAME":     url.path[1:],
            "USER":     url.username,
            "PASSWORD": url.password,
            "HOST":     url.hostname,
            "PORT":     url.port,
            "OPTIONS":  {"sslmode": "require"},
            # Required for Supabase pgBouncer transaction-mode pooling
            "DISABLE_SERVER_SIDE_CURSORS": True,
        }
    }
else:
    # Emergency fallback — should never be used in this project
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME":   BASE_DIR / "db.sqlite3",
        }
    }

# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ─────────────────────────────────────────────────────────────────────────────
# Internationalisation
# ─────────────────────────────────────────────────────────────────────────────

LANGUAGE_CODE = "en-us"
TIME_ZONE     = "Asia/Kolkata"
USE_I18N      = True
USE_TZ        = True

# ─────────────────────────────────────────────────────────────────────────────
# Static files
# WhiteNoise serves these in production. build.sh runs collectstatic.
# ─────────────────────────────────────────────────────────────────────────────

STATIC_URL   = "/static/"
STATIC_ROOT  = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─────────────────────────────────────────────────────────────────────────────
# Django REST Framework
# ─────────────────────────────────────────────────────────────────────────────

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# Sessions & CSRF
# Base (dev) defaults. prod.py overrides these with Secure + SameSite=None
# for cross-origin Vercel → Render cookies.
# ─────────────────────────────────────────────────────────────────────────────

CORS_ALLOW_CREDENTIALS   = True
SESSION_COOKIE_SAMESITE  = "Lax"
CSRF_COOKIE_SAMESITE     = "Lax"
SESSION_COOKIE_SECURE    = False   # overridden to True in prod.py
CSRF_COOKIE_SECURE       = False   # overridden to True in prod.py
SESSION_COOKIE_AGE       = 3600    # 1 hour
SESSION_SAVE_EVERY_REQUEST = True

# Custom cookie names — prevent collision with Django admin session
SESSION_COOKIE_NAME = "gyangrit_sessionid"
CSRF_COOKIE_NAME    = "gyangrit_csrftoken"

# ─────────────────────────────────────────────────────────────────────────────
# Cloudflare R2 media storage
# ─────────────────────────────────────────────────────────────────────────────

CLOUDFLARE_R2_ACCOUNT_ID        = os.getenv("CLOUDFLARE_R2_ACCOUNT_ID",        "")
CLOUDFLARE_R2_ACCESS_KEY_ID     = os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID",     "")
CLOUDFLARE_R2_SECRET_ACCESS_KEY = os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "")
CLOUDFLARE_R2_BUCKET_NAME       = os.getenv("CLOUDFLARE_R2_BUCKET_NAME",       "gyangrit-media")
CLOUDFLARE_R2_PUBLIC_URL        = os.getenv("CLOUDFLARE_R2_PUBLIC_URL",        "")

# ─────────────────────────────────────────────────────────────────────────────
# Ably (real-time channels — post-capstone: competition rooms, chat rooms)
# ─────────────────────────────────────────────────────────────────────────────

ABLY_API_KEY = os.getenv("ABLY_API_KEY", "")
