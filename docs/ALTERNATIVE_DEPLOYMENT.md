# GyanGrit — Alternative Deployment Guide

This document covers deploying GyanGrit's Django backend to platforms
**other than Render**, with a focus on free/cheap options with Indian
or nearby servers. Also covers keeping Render warm if you stay on it.

---

## Table of Contents

1. [Keeping Render Warm (No Cold Starts)](#keeping-render-warm)
2. [Deploy to Koyeb (Recommended Alternative)](#deploy-to-koyeb)
3. [Deploy to Railway](#deploy-to-railway)
4. [Platform Comparison](#platform-comparison)

---

## Keeping Render Warm

Render's free tier sleeps after 15 minutes of inactivity. When it sleeps,
the first request takes 30-60 seconds (502 Bad Gateway during boot).

### Option A: Upstash QStash Cron (Recommended — Free)

You already have QStash configured. Use it to ping the health endpoint
every 5 minutes. QStash free tier allows 500 messages/day — a ping every
5 min uses 288/day.

**Setup in QStash dashboard (https://console.upstash.com/qstash):**

1. Go to **Schedules** → **Create Schedule**
2. URL: `https://gyangrit.onrender.com/api/v1/health/`
3. Method: `GET`
4. Cron: `*/5 * * * *` (every 5 minutes)
5. Save

That's it. No code changes needed. The health endpoint is public and
lightweight (no DB hit).

### Option B: UptimeRobot (Free, Alternative)

1. Sign up at https://uptimerobot.com (free plan: 50 monitors)
2. Add HTTP(S) monitor: `https://gyangrit.onrender.com/api/v1/health/`
3. Interval: 5 minutes
4. This also gives you uptime monitoring + email alerts for free

### Option C: Cron-job.org (Free)

1. Sign up at https://cron-job.org
2. Create job: GET `https://gyangrit.onrender.com/api/v1/health/`
3. Schedule: every 5 minutes
4. Free tier: unlimited jobs

---

## Deploy to Koyeb

**Koyeb** is the recommended alternative to Render for GyanGrit because:

- Free tier: 1 web service (0.1 vCPU, 512MB RAM) — no credit card required
- Free PostgreSQL database included (but we use Supabase, so irrelevant)
- No cold starts — free services don't sleep
- Git-push deployment (same as Render)
- Eco instances at $1.61/month for Singapore (closest to India)

### Step 1: Create a Koyeb Account

1. Go to https://app.koyeb.com/auth/signup
2. Sign up with GitHub (recommended for auto-connect)

### Step 2: Prepare the Repository

The backend directory needs a `Procfile` or Koyeb build/run commands.
Koyeb auto-detects Python projects via `requirements.txt`.

**Create `backend/Procfile`** (Koyeb reads this):

```
web: cd /app && gunicorn gyangrit.wsgi:application -c gunicorn.conf.py
```

Or specify the commands in Koyeb's UI (Step 4 below).

### Step 3: Create a New Koyeb Service

1. Go to Koyeb Dashboard → **Create Service** → **Web Service**
2. Source: **GitHub** → Select your `GyanGrit` repo
3. Branch: `main` (or your deploy branch)
4. **Builder**: Buildpack
5. **Build and run commands**:
   - Root directory: `backend`
   - Build command: `pip install -r requirements/prod.txt && python manage.py collectstatic --no-input && python manage.py migrate --no-input`
   - Run command: `gunicorn gyangrit.wsgi:application -c gunicorn.conf.py`
   - Port: `8000`

### Step 4: Set Environment Variables

In Koyeb's "Environment variables" section, add ALL of these:

```
DJANGO_SETTINGS_MODULE=gyangrit.settings.prod
SECRET_KEY=<generate-a-real-one>
DATABASE_URL=postgres://postgres.rvyuccwggicloiyoixjb:<password>@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
ALLOWED_HOSTS={{KOYEB_PUBLIC_DOMAIN}}
CORS_ALLOWED_ORIGINS=https://gyan-grit.vercel.app
DEBUG=False

# Email
EMAIL_HOST_USER=veerababusaviti2103@gmail.com
EMAIL_HOST_PASSWORD=<gmail-app-password>

# Cloudflare R2
CLOUDFLARE_R2_ACCOUNT_ID=<your-id>
CLOUDFLARE_R2_ACCESS_KEY_ID=<your-key>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<your-secret>
CLOUDFLARE_R2_BUCKET_NAME=gyangrit-media
CLOUDFLARE_R2_PUBLIC_URL=https://pub-e9d4409f2ff64c3da255818e71428b31.r2.dev

# Ably
ABLY_API_KEY=<your-key>

# Fast2SMS
FAST2SMS_API_KEY=<your-key>

# Gemini
GEMINI_API_KEY=<your-key>

# LiveKit
LIVEKIT_URL=wss://gyangrit-ld2s7sp2.livekit.cloud
LIVEKIT_API_KEY=<your-key>
LIVEKIT_API_SECRET=<your-secret>

# Sentry
SENTRY_DSN=https://30eb244c85f8cf83d6cf909e1d049b46@o4511100995043328.ingest.de.sentry.io/4511101006970960

# Upstash Redis
UPSTASH_REDIS_KV_URL=rediss://default:<token>@golden-sheep-83421.upstash.io:6379
```

**IMPORTANT:** In Koyeb's UI, enter values WITHOUT quotes. The UI handles
escaping. Never wrap values in `"..."`.

### Step 5: Deploy

Click "Deploy". Koyeb will build and deploy. Your service URL will be
`https://<service-name>-<org>.koyeb.app`.

### Step 6: Update Vercel Frontend

After deployment, update Vercel's environment variable:
```
VITE_API_URL=https://<your-koyeb-service>.koyeb.app/api/v1
```

Also update `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` in Koyeb's
env vars to match your Vercel frontend URL.

### Step 7: Verify

```bash
curl https://<your-koyeb-service>.koyeb.app/api/v1/health/
# Should return: {"status": "ok", ...}
```

---

## Deploy to Railway

**Railway** is another alternative:

- $5/month free credit (enough for a small Django app)
- Singapore region available
- Git-push deployment
- No cold starts on paid plans (but $5 credit burns through)

### Quick Setup

1. Go to https://railway.app → Sign in with GitHub
2. New Project → Deploy from GitHub Repo → Select GyanGrit
3. Set root directory to `backend`
4. Add environment variables (same as Koyeb list above)
5. Set start command: `gunicorn gyangrit.wsgi:application -c gunicorn.conf.py`
6. Railway auto-detects Python and installs dependencies

**Note:** Railway's free credit ($5/month) may not be enough if your
app runs 24/7. At ~$0.000231/min for 512MB RAM, that's $5/month for
continuous use — exactly the credit amount. Any DB queries or bursts
may push you over.

---

## Platform Comparison

| Feature | Render (Current) | Koyeb | Railway |
|---|---|---|---|
| **Free tier** | Yes (sleeps) | Yes (no sleep) | $5/month credit |
| **Cold starts** | 30-60s after 15min idle | None | None |
| **Nearest to India** | Singapore | Washington DC (free) / Singapore ($1.61/mo) | Singapore |
| **Git deploy** | Yes | Yes | Yes |
| **Custom domain** | Yes | Yes | Yes |
| **Docker support** | Yes | Yes | Yes |
| **Health checks** | Built-in | Built-in | Built-in |
| **Credit card required** | No | No | Yes (for $5 credit) |
| **Best for GyanGrit** | OK if kept warm | **Recommended** | Good but costs add up |

---

## Recommendation

**Short-term (this week, for capstone submission):**
Stay on Render + set up QStash or UptimeRobot to keep it warm.
This requires zero code changes and takes 2 minutes.

**Medium-term (after submission):**
Migrate to Koyeb. Free tier doesn't sleep, and the deployment
process is nearly identical to Render. Copy your env vars over
and update the Vercel `VITE_API_URL`.

---

## Docker Support (For Any Platform)

If you need Docker deployment for any platform, here's a `Dockerfile`
for the GyanGrit backend:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System deps for psycopg (PostgreSQL driver)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements/base.txt requirements/base.txt
COPY requirements/prod.txt requirements/prod.txt
RUN pip install --no-cache-dir -r requirements/prod.txt

# Copy app
COPY . .

# Collect static files
RUN python manage.py collectstatic --no-input

# Non-root user for security
RUN useradd -m gyangrit
USER gyangrit

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health/')" || exit 1

EXPOSE 8000

CMD ["gunicorn", "gyangrit.wsgi:application", "-c", "gunicorn.conf.py"]
```

Place this `Dockerfile` in the `backend/` directory. Works with Koyeb,
Railway, Fly.io, DigitalOcean App Platform, or any Docker-compatible host.
