# GyanGrit — Backend Deployment on Render

> Platform: [render.com](https://render.com)
> Service type: **Web Service** (not Worker, not Cron)
> Runtime: Python 3.11+
> WSGI server: Gunicorn
> Database: Supabase PostgreSQL (external — Render does NOT host the DB)

---

## Prerequisites

1. GitHub repo pushed and accessible by Render
2. Supabase project with PostgreSQL — note the connection string
3. Cloudflare R2 bucket with API credentials
4. All env vars listed below ready to fill in

---

## Step 1 — Add Render-specific files to the repo

### `backend/build.sh`
This script runs once on each deploy. Render calls it as the **Build Command**.

```bash
#!/usr/bin/env bash
set -e

pip install -r requirements/prod.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input
```

Make it executable before committing:
```bash
chmod +x backend/build.sh
```

### `backend/Procfile` (optional — Render uses Start Command field instead)
If you want Heroku-style config:
```
web: gunicorn gyangrit.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 2 --timeout 120
```

---

## Step 2 — Create the Web Service on Render

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Fill in the service settings:

| Field | Value |
|---|---|
| **Name** | `gyangrit-backend` |
| **Region** | Singapore (closest to Punjab) or Frankfurt |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `./build.sh` |
| **Start Command** | `gunicorn gyangrit.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 2 --timeout 120` |
| **Instance Type** | Free (for capstone) / Starter ($7/mo) for production |

---

## Step 3 — Set Environment Variables

In Render → Your Service → **Environment**, add all of these:

### Required

| Key | Value | Notes |
|---|---|---|
| `DJANGO_SETTINGS_MODULE` | `gyangrit.settings.prod` | Switches to production settings |
| `SECRET_KEY` | `<generate a 50-char random string>` | Run: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DATABASE_URL` | `postgresql://user:password@host:port/dbname?sslmode=require` | From Supabase → Project Settings → Database → Connection String |
| `ALLOWED_HOSTS` | `gyangrit-backend.onrender.com,yourdomain.com` | Add your Render URL + custom domain |
| `CORS_ALLOWED_ORIGINS` | `https://gyangrit.vercel.app,https://yourdomain.com` | Add your Vercel frontend URL |
| `DEBUG` | `False` | Never True in production |

### Cloudflare R2

| Key | Value |
|---|---|
| `R2_ACCOUNT_ID` | Your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET_NAME` | Your bucket name (e.g. `gyangrit-media`) |
| `R2_PUBLIC_URL` | Your R2 public URL (e.g. `https://pub-xxxx.r2.dev`) |

### Email (optional — for join code email feature)

| Key | Value |
|---|---|
| `EMAIL_HOST` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_HOST_USER` | your Gmail address |
| `EMAIL_HOST_PASSWORD` | Gmail app password |
| `DEFAULT_FROM_EMAIL` | `noreply@gyangrit.com` |

---

## Step 4 — Production Settings Check

Verify `backend/gyangrit/settings/prod.py` has these:

```python
DEBUG = False

ALLOWED_HOSTS = os.environ["ALLOWED_HOSTS"].split(",")

DATABASES = {
    "default": dj_database_url.config(
        default=os.environ["DATABASE_URL"],
        conn_max_age=600,
        conn_health_checks=True,
    )
}
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True  # pgBouncer required

# Static files — WhiteNoise serves them
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
STATIC_ROOT = BASE_DIR / "staticfiles"

# HTTPS
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

---

## Step 5 — `requirements/prod.txt`

Make sure these are present:

```
django>=4.2,<7.0
gunicorn>=21.2
whitenoise[brotli]>=6.6
dj-database-url>=2.1
psycopg2-binary>=2.9
python-decouple>=3.8
# ...rest of your deps
```

---

## Step 6 — CORS configuration

In `prod.py`:

```python
CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
CORS_ALLOW_CREDENTIALS = True
```

Render auto-sets `PORT` — your Start Command uses `$PORT`.

---

## Step 7 — Deploy

1. Push to `main` branch
2. Render auto-detects the push and triggers a new deploy
3. Watch the deploy logs in Render dashboard
4. Check:
   - Build logs — `collectstatic` and `migrate` should run clean
   - Deploy logs — Gunicorn should start on port from `$PORT`
   - Health check: `GET https://gyangrit-backend.onrender.com/api/v1/health/` → `{"status":"ok"}`

---

## Step 8 — Connect Frontend

In your Vercel frontend deployment, set:

```
VITE_API_URL=https://gyangrit-backend.onrender.com/api/v1
```

In `frontend/src/services/api.ts`, the base URL reads from:
```ts
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";
```

---

## Render Free Tier Limits

| Limit | Free | Starter ($7/mo) |
|---|---|---|
| RAM | 512 MB | 512 MB |
| CPU | 0.1 vCPU | 0.5 vCPU |
| Sleep after inactivity | Yes (15 min) | No |
| Custom domain | No | Yes |
| Bandwidth | 100 GB/mo | 100 GB/mo |

**For capstone demo:** Free tier is fine. First request after sleep takes ~30s.
**For production:** Upgrade to Starter to remove the sleep behaviour.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `500` on all endpoints | `SECRET_KEY` missing or wrong `ALLOWED_HOSTS` | Check env vars |
| `OperationalError: SSL required` | `DATABASE_URL` missing `?sslmode=require` | Append it |
| `DisallowedHost` | Render URL not in `ALLOWED_HOSTS` | Add `gyangrit-backend.onrender.com` |
| `CORS error` in browser | Vercel URL not in `CORS_ALLOWED_ORIGINS` | Add it |
| Static files 404 | `collectstatic` didn't run or `STATIC_ROOT` wrong | Check build.sh logs |
| Migrations not applied | `migrate` step failed | Check build.sh logs, look for DB connection errors |

---

## Re-deploy after code changes

```bash
git push origin main
```

Render picks up the push automatically. No manual restart needed.

---

## Useful Render CLI Commands

```bash
# Install Render CLI
npm install -g @render-ctl/cli

# Tail live logs
render logs --service gyangrit-backend --tail

# Trigger manual deploy
render deploy --service gyangrit-backend
```
