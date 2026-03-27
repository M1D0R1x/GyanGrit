# GyanGrit — Deployment Guide

> **Updated: 2026-03-26** — Production live at Render + Vercel

---

## Production URLs

| Service | URL |
|---|---|
| Frontend | https://gyan-grit.vercel.app |
| Backend | https://gyangrit.onrender.com |
| Database | Supabase Mumbai (see Render env vars) |
| Admin panel | https://gyangrit.onrender.com/admin/ |

---

## Render (Backend) — Quick Reference

**Start Command:** `gunicorn gyangrit.wsgi:application -c gunicorn.conf.py`

**Build Command:** `./build.sh`

**After every deploy, run in Render Shell:**
```bash
python manage.py migrate
python manage.py bootstrap_chatrooms
python manage.py collectstatic --no-input
```

### Required Environment Variables

```env
SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_urlsafe(50))">
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
ALLOWED_HOSTS=gyangrit.onrender.com
CORS_ALLOWED_ORIGINS=https://gyan-grit.vercel.app
DEBUG=False
DJANGO_SETTINGS_MODULE=gyangrit.settings.prod

# OTP & Email
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
EMAIL_HOST_USER=noreply@gyangrit.site
EMAIL_HOST_PASSWORD=<zoho app password>

# Real-time
ABLY_API_KEY=

# Live video
LIVEKIT_URL=wss://gyangrit-ld2s7sp2.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# AI
GEMINI_API_KEY=

# Cloudflare R2
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_ENDPOINT_URL=
```

---

## Vercel (Frontend) — Quick Reference

**Build Command:** `npm run build` (auto-detected)
**Output directory:** `dist`

**Environment Variables:**
```env
VITE_API_URL=https://gyangrit.onrender.com/api/v1
```

**`vercel.json`** handles SPA routing — already configured.

---

## gunicorn.conf.py — Critical Notes

```python
worker_class       = "gevent"
workers            = 1
worker_connections = 100    # 50 concurrent users comfortable on Render free
conn_max_age       = 0      # CRITICAL: must be 0 with gevent (set in prod.py)

def post_fork(server, worker):
    from django.db import connections
    for conn in connections.all():
        conn.close()        # CRITICAL: prevents thread-sharing DB errors with gevent
```

**Why this matters:** `CONN_MAX_AGE > 0` with gevent causes `DatabaseWrapper objects created in a thread can only be used in that same thread` — the production 500 error we fixed on 2026-03-24.

---

## Local Development

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

Create `backend/.env`:
```env
SECRET_KEY=dev-secret-key-not-for-production
DATABASE_URL=postgresql://user:pass@localhost:5432/gyangrit
LIVEKIT_URL=wss://gyangrit-ld2s7sp2.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
GEMINI_API_KEY=
ABLY_API_KEY=
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local`:
```env
VITE_API_URL=http://127.0.0.1:8000/api/v1
```

---

## First-Time Seeding

```bash
# 1. Run migrations
python manage.py migrate

# 2. Seed Punjab districts + institutions + classrooms + sections
python manage.py seed_punjab

# 3. Seed sample courses + lessons + assessments
python manage.py seed_content

# 4. Create admin superuser
python manage.py createsuperuser

# 5. Bootstrap chat rooms (after teachers are assigned)
python manage.py bootstrap_chatrooms
```

**`bootstrap_chatrooms`** is idempotent — safe to run multiple times. Creates rooms only where `TeachingAssignment` records exist. Enrolls all matching users.

---

## Database Backup

```bash
pg_dump -h <host> -U <user> -d <dbname> -Fc > gyangrit_backup_$(date +%Y%m%d).dump
```

Restore:
```bash
pg_restore -h <host> -U <user> -d <dbname> gyangrit_backup_20260326.dump
```

---

## Capacity

| Scenario | Concurrent users | Notes |
|---|---|---|
| Render free + gevent | ~50 | Current production setup |
| Render Starter ($7/mo) | ~100 | Upgrade for daily school use |
| LiveKit Cloud free | 100 concurrent, 5k min/mo | Enough for capstone demos |
| LiveKit Cloud Ship ($50/mo) | 1,000 concurrent | For daily school live classes |
| Ably free | 100 simultaneous connections | Enough for capstone |

---

## Common Issues

**`DatabaseWrapper objects created in a thread can only be used in that same thread`**
gevent + `CONN_MAX_AGE > 0` incompatibility. Fix: ensure `conn_max_age=0` in `prod.py` and `post_fork` connection reset in `gunicorn.conf.py`.

**Health endpoint returning 301**
`/api/v1/health` (without trailing slash) redirects to `/api/v1/health/`. Update keep-alive ping URL to include trailing slash, or set `APPEND_SLASH=False`.

**`python-dotenv could not parse statement`**
`.env` file has inline comments. Each line must be `KEY=value` only — no `# comments`, no `export` prefix.

**CSRF token mismatch on POST**
Frontend reads `gyangrit_csrftoken` cookie. Ensure `CSRF_COOKIE_NAME = "gyangrit_csrftoken"` is set and `initCsrf()` is called before any POST.

**LiveKit `canPublish` denied**
Student token has `canPublish=False` by design. Only TEACHER, PRINCIPAL, ADMIN get `canPublish=True`.

**Gemini returning off-topic responses**
System prompt in `ai_assistant/views.py` constrains responses to education. If the prompt is being bypassed, increase the system prompt's specificity.

**Chat rooms not created for new school**
Run `python manage.py bootstrap_chatrooms` after adding teaching assignments. Or: create a `TeachingAssignment` via admin and the signal will auto-create the room.
