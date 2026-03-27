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
    # django-unfold must be before django.contrib.admin
    "unfold",
    "unfold.contrib.filters",
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
    "apps.competitions.apps.CompetitionsConfig",
    "apps.chatrooms.apps.ChatroomsConfig",
    "apps.flashcards.apps.FlashcardsConfig",
    "apps.livesessions.apps.LiveSessionsConfig",
    "apps.ai_assistant.apps.AiAssistantConfig",
    "apps.analytics.apps.AnalyticsConfig",
]

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    # CorsMiddleware MUST be first so CORS headers are added before any response
    "corsheaders.middleware.CorsMiddleware",
    # GZipMiddleware compresses responses > 200 bytes. Critical for 3G/2G networks.
    "django.middleware.gzip.GZipMiddleware",
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

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Strip surrounding quotes — some .env editors or dashboards add them
if len(DATABASE_URL) >= 2 and DATABASE_URL[0] == DATABASE_URL[-1] and DATABASE_URL[0] in ('"', "'"):
    DATABASE_URL = DATABASE_URL[1:-1]

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
# Email — Gmail SMTP via App Password
#
# Priority in send_otp(): SMS (Fast2SMS) → Email → Log fallback
# Email is the fallback when a user has no mobile_primary set or SMS fails.
#
# Required env vars (set in Render dashboard + local .env):
#   EMAIL_HOST_USER     = veerababusaviti21@gmail.com
#   EMAIL_HOST_PASSWORD = <16-char Gmail App Password>
#
# Gmail App Password setup:
#   Google Account → Security → 2-Step Verification → App passwords
#   Generate password for "Mail" + "Other (GyanGrit)"
#
# dev.py overrides EMAIL_BACKEND to console so no real emails are sent locally.
# ─────────────────────────────────────────────────────────────────────────────

EMAIL_BACKEND       = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST          = "smtp.gmail.com"
EMAIL_PORT          = 587
EMAIL_USE_TLS       = True
EMAIL_USE_SSL       = False   # TLS and SSL are mutually exclusive — always use TLS on 587
EMAIL_HOST_USER     = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")   # Gmail App Password, NOT Gmail password
DEFAULT_FROM_EMAIL  = os.getenv("EMAIL_HOST_USER", "noreply@gyangrit.com")

# ─────────────────────────────────────────────────────────────────────────────
# Cloudflare R2 media storage
# ─────────────────────────────────────────────────────────────────────────────

CLOUDFLARE_R2_ACCOUNT_ID        = os.getenv("CLOUDFLARE_R2_ACCOUNT_ID",        "")
CLOUDFLARE_R2_ACCESS_KEY_ID     = os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID",     "")
CLOUDFLARE_R2_SECRET_ACCESS_KEY = os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "")
CLOUDFLARE_R2_BUCKET_NAME       = os.getenv("CLOUDFLARE_R2_BUCKET_NAME",       "gyangrit-media")
CLOUDFLARE_R2_PUBLIC_URL        = os.getenv("CLOUDFLARE_R2_PUBLIC_URL",        "")

# ─────────────────────────────────────────────────────────────────────────────
# Fast2SMS — Quick SMS route for instant OTP delivery (no DLT template needed)
# Docs: https://www.fast2sms.com/dev/bulkV2 (route=q)
FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY", "")

# ─────────────────────────────────────────────────────────────────────────────
# Ably (real-time channels — post-capstone: competition rooms, chat rooms)
# ─────────────────────────────────────────────────────────────────────────────

ABLY_API_KEY = os.getenv("ABLY_API_KEY", "")

# ─────────────────────────────────────────────────────────────────────────────
# Django Unfold — admin theme
# ─────────────────────────────────────────────────────────────────────────────

UNFOLD = {
    "SITE_TITLE":  "GyanGrit Admin",
    "SITE_HEADER": "GyanGrit",
    "SITE_SYMBOL": "school",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": True,
    "COLORS": {
        "primary": {
            "50":  "239 246 255",
            "100": "219 234 254",
            "200": "191 219 254",
            "300": "147 197 253",
            "400": "96  165 250",
            "500": "59  130 246",
            "600": "37  99  235",
            "700": "29  78  216",
            "800": "30  64  175",
            "900": "30  58  138",
            "950": "23  37  84",
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": True,
        "navigation": [
            {
                "title": "Users & Auth",
                "separator": True,
                "items": [
                    {"title": "Users",      "icon": "person",  "link": "/admin/accounts/user/"},
                    {"title": "Join Codes", "icon": "vpn_key", "link": "/admin/accounts/joincode/"},
                ],
            },
            {
                "title": "Academics",
                "separator": True,
                "items": [
                    {"title": "Districts",    "icon": "map",     "link": "/admin/academics/district/"},
                    {"title": "Institutions", "icon": "account_balance", "link": "/admin/academics/institution/"},
                    {"title": "Classrooms",   "icon": "class",   "link": "/admin/academics/classroom/"},
                    {"title": "Sections",     "icon": "groups",  "link": "/admin/academics/section/"},
                    {"title": "Subjects",     "icon": "menu_book", "link": "/admin/academics/subject/"},
                    {"title": "Assignments",  "icon": "assignment_ind", "link": "/admin/academics/teachingassignment/"},
                ],
            },
            {
                "title": "Content",
                "separator": True,
                "items": [
                    {"title": "Courses",     "icon": "library_books", "link": "/admin/content/course/"},
                    {"title": "Lessons",     "icon": "play_lesson",   "link": "/admin/content/lesson/"},
                    {"title": "Assessments", "icon": "quiz",          "link": "/admin/assessments/assessment/"},
                ],
            },
            {
                "title": "Engagement",
                "separator": True,
                "items": [
                    {"title": "Competitions", "icon": "emoji_events",  "link": "/admin/competitions/competitionroom/"},
                    {"title": "Chat Rooms",   "icon": "chat",          "link": "/admin/chatrooms/chatroom/"},
                    {"title": "Gamification", "icon": "star",          "link": "/admin/gamification/pointevent/"},
                    {"title": "Notifications","icon": "notifications", "link": "/admin/notifications/notification/"},
                ],
            },
            {
                "title": "School Records",
                "separator": True,
                "items": [
                    {"title": "Gradebook", "icon": "grade",  "link": "/admin/gradebook/gradeentry/"},
                    {"title": "Roster",    "icon": "list_alt","link": "/admin/roster/studentregistrationrecord/"},
                ],
            },
        ],
    },
}

# ── LiveKit ───────────────────────────────────────────────────────────────────
LIVEKIT_URL        = os.environ.get("LIVEKIT_URL", "")
LIVEKIT_API_KEY    = os.environ.get("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")

# ── Gemini ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# ── Web Push (VAPID) ─────────────────────────────────────────────────────────
# Generate keys once:
#   python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.private_pem().decode()); print(v.public_key)"
# Or: python manage.py generate_vapid_keys
# Then set VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY in Render env vars.
VAPID_PRIVATE_KEY    = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY     = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_CLAIMS_EMAIL   = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:admin@gyangrit.com")

# ── QStash (Upstash) — scheduled delayed tasks for session reminders ─────────
QSTASH_TOKEN     = os.environ.get("UPSTASH_QSTASH_QSTASH_TOKEN", "")
BACKEND_BASE_URL = os.environ.get("BACKEND_BASE_URL", "https://gyangrit.onrender.com")
