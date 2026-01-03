from .base import *

DEBUG = True

from corsheaders.defaults import default_headers

CORS_ALLOW_HEADERS = list(default_headers)

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5174",
    "http://localhost:5173",
]

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
]


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
