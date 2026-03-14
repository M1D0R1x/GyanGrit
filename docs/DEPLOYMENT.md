# GyanGrit — Deployment Guide

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (via Supabase or self-hosted)
- A domain with HTTPS

---

## Backend Setup

### 1. Clone and Install

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements/prod.txt
```

### 2. Environment Variables

Create `backend/.env`:

```env
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_urlsafe(50))">
DATABASE_URL=postgres://user:password@host:port/dbname?sslmode=require
```

Never commit `.env` to version control. Confirm it is in `.gitignore`.

`python-dotenv` is loaded in `base.py` via `load_dotenv()`. If `.env` is missing,
Django will still start — environment variables can also be set directly on the host.

### 3. Run Migrations

```bash
DJANGO_SETTINGS_MODULE=gyangrit.settings.prod python manage.py migrate
```

This also triggers the `post_migrate` signal that seeds Punjab districts, schools, and subjects automatically.

### 4. Seed Classrooms and Sections

```bash
python manage.py seed_punjab
```

Creates classrooms (grades 6–10) and sections for each seeded school. Idempotent — safe to run multiple times.

### 5. Create Admin User

```bash
python manage.py createsuperuser
```

Log into `/admin/` and create `JoinCode` records for your initial users.

### 6. Collect Static Files

```bash
python manage.py collectstatic --noinput
```

Static files are served by `whitenoise` in production (included in `requirements/prod.txt`).

Add to `prod.py` settings after `SecurityMiddleware`:
```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",   # ← add here
    ...
]
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
```

### 7. Run Production Server

```bash
gunicorn gyangrit.wsgi:application \
  --workers 4 \
  --bind 0.0.0.0:8000 \
  --env DJANGO_SETTINGS_MODULE=gyangrit.settings.prod
```

---

## Frontend Setup

### 1. Set API Base URL

Before building, set the production API URL. Either update `src/services/api.ts` directly:

```ts
const API_BASE_URL = "https://your-backend-domain.com/api/v1";
```

Or use a Vite environment variable. Create `frontend/.env.production`:

```env
VITE_API_BASE_URL=https://your-backend-domain.com/api/v1
```

And update `api.ts`:
```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
```

### 2. Build

```bash
cd frontend
npm install
npm run build
```

Output in `frontend/dist/`.

### 3. Serve

Deploy `frontend/dist/` to Vercel, Netlify, Cloudflare Pages, or serve via nginx.

nginx config for SPA routing:

```nginx
location / {
    root /var/www/gyangrit/dist;
    try_files $uri $uri/ /index.html;
}
```

---

## Production Settings Checklist

Verify `backend/gyangrit/settings/prod.py` before going live:

```python
DEBUG = False
ALLOWED_HOSTS = ["your-backend-domain.com"]
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
CORS_ALLOWED_ORIGINS = ["https://your-frontend-domain.com"]
CSRF_TRUSTED_ORIGINS = ["https://your-frontend-domain.com"]
SESSION_COOKIE_NAME = "gyangrit_sessionid"
CSRF_COOKIE_NAME = "gyangrit_csrftoken"
```

---

## OTP in Production

The login endpoint returns `otp_code` in the response body only when `DEBUG=True`.
This is handled automatically by the `if settings.DEBUG` guard in `accounts/views.py`.

Before production:
1. Integrate an SMS provider (Twilio, MSG91, or equivalent)
2. Replace the OTP creation block in `login_view` with an SMS dispatch call
3. Store the user's mobile number on the `User` model

The OTP generation, attempt limiting, and expiry logic does not need to change — only the delivery mechanism.

---

## Database Backup

```bash
pg_dump \
  -h <host> \
  -U <user> \
  -d <dbname> \
  -Fc > gyangrit_backup_$(date +%Y%m%d).dump
```

Restore:

```bash
pg_restore \
  -h <host> \
  -U <user> \
  -d <dbname> \
  gyangrit_backup_20260315.dump
```

---

## Development Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements/dev.txt
python manage.py migrate
python manage.py seed_punjab
python manage.py runserver
```

Backend: `http://127.0.0.1:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

---

## Common Issues

**`python-dotenv could not parse statement`**
Your `.env` file has inline comments or unsupported syntax. Each line must be exactly
`KEY=value` — no comments, no `export` prefix, no trailing spaces.

**CSRF token mismatch on POST**
The frontend reads `gyangrit_csrftoken` cookie. Confirm `CSRF_COOKIE_NAME = "gyangrit_csrftoken"`
is set in your settings file and that `initCsrf()` is called on app mount before any POST.

**Session expires mid-lesson**
`SESSION_COOKIE_AGE = 600` (10 minutes) with `SESSION_SAVE_EVERY_REQUEST = True`.
Any API call resets the timer. If a student is idle for 10+ minutes without an API call
(e.g. watching a video), they may be logged out. Increase `SESSION_COOKIE_AGE` in `dev.py`
for testing long lessons.

**`ImportError: cannot import name 'get_scoped_object_or_403'`**
The function was renamed to `get_scoped_object_or_404`. A backward-compatible alias is kept
in `accesscontrol/scoped_service.py` until all call sites are updated.

**PostgreSQL connection errors with Supabase pooler**
Ensure `DISABLE_SERVER_SIDE_CURSORS = True` is set at the database level (not inside `OPTIONS`).
This is required for pgBouncer transaction-mode pooling used by Supabase.
