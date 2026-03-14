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

### 3. Run Migrations

```bash
DJANGO_SETTINGS_MODULE=gyangrit.settings.prod python manage.py migrate
```

This will also trigger the `post_migrate` signal that seeds Punjab districts, schools, and subjects automatically.

### 4. Seed Classrooms and Sections

After migrations, run the management command to create classrooms (grades 6–10) and sections for each school:

```bash
python manage.py seed_punjab
```

This command is idempotent — safe to run multiple times.

### 5. Create Admin User

```bash
python manage.py createsuperuser
```

Then log into `/admin/` and create `JoinCode` records for your initial users.

### 6. Collect Static Files

```bash
python manage.py collectstatic --noinput
```

### 7. Run Production Server

Using gunicorn:

```bash
gunicorn gyangrit.wsgi:application \
  --workers 4 \
  --bind 0.0.0.0:8000 \
  --env DJANGO_SETTINGS_MODULE=gyangrit.settings.prod
```

---

## Frontend Setup

### 1. Install and Build

```bash
cd frontend
npm install
npm run build
```

Output is in `frontend/dist/`.

### 2. Update API Base URL

Before building for production, update `src/services/api.ts`:

```ts
const API_BASE_URL = "https://your-backend-domain.com/api/v1";
```

Or use an environment variable:

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
```

And set `VITE_API_BASE_URL=https://your-backend-domain.com/api/v1` in `frontend/.env.production`.

### 3. Serve the Build

Serve `frontend/dist/` via a static host (Vercel, Netlify, Cloudflare Pages) or via nginx.

Nginx config for SPA routing:

```nginx
location / {
    root /var/www/gyangrit/dist;
    try_files $uri $uri/ /index.html;
}
```

---

## Production Settings Checklist

Before going live, verify `backend/gyangrit/settings/prod.py`:

```python
DEBUG = False
ALLOWED_HOSTS = ["your-domain.com", "www.your-domain.com"]
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

The current `login_view` returns `otp_code` in the response body when `DEBUG=True`. This is intentional for development.

Before production:
1. Remove the OTP from the response body (the `if settings.DEBUG` block handles this automatically)
2. Integrate an SMS provider (e.g., Twilio, MSG91) to send OTPs to the user's registered mobile number
3. Store the mobile number on the `User` model

The OTP generation and verification logic in `accounts/views.py` does not need to change — only the delivery mechanism.

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
python manage.py seed_punjab    # populate schools/classes
python manage.py runserver
```

Backend runs at `http://127.0.0.1:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## Common Issues

**`python-dotenv could not parse statement`**
Your `.env` file has inline comments or unsupported syntax. Each line must be exactly `KEY=value` with no comments, no `export` prefix, no trailing spaces.

**`ImportError: cannot import name X from scoped_service`**
The function was renamed. Check `accesscontrol/scoped_service.py` for the current name. The backward-compatible alias `get_scoped_object_or_403` is kept until all imports are updated.

**CSRF token mismatch on POST**
The frontend reads `gyangrit_csrftoken` cookie. Confirm `CSRF_COOKIE_NAME = "gyangrit_csrftoken"` is set in your settings file and that `initCsrf()` is called on app mount.

**Session expires mid-lesson**
`SESSION_COOKIE_AGE = 600` (10 minutes) with `SESSION_SAVE_EVERY_REQUEST = True`. Any API call resets the timer. If students are idle for 10+ minutes without any API call, they will be logged out. Increase `SESSION_COOKIE_AGE` in `dev.py` for testing, or add a keepalive ping in the frontend for long lessons.
