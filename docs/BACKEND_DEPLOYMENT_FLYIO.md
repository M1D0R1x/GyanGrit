# GyanGrit — Backend Deployment on Fly.io (Mumbai)

> **Why Fly.io instead of Render:**
> Render has no Mumbai region (only Singapore for APAC) with no ETA.
> Fly.io has Mumbai (`bom`) available as a production gateway region.
> Moving backend from Singapore → Mumbai (co-located with Supabase DB)
> eliminates the Singapore→Mumbai DB roundtrip, dropping login latency
> from ~3s to well under 1s.
>
> Platform: [fly.io](https://fly.io)
> Region: `bom` (Mumbai, India)
> Runtime: Docker container (Fly builds from your repo automatically)

---

## Pricing

| Plan | Cost | Notes |
|---|---|---|
| Free allowance | $0 | 3 shared-cpu-1x 256MB VMs free per org. App will sleep after inactivity. |
| Always-on (recommended) | ~$1.94/mo | 1 shared-cpu-1x 256MB RAM, always running |

For capstone demo: free tier is fine. For production: $1.94/mo keeps it always-on.

---

## Step 1 — Install Fly CLI

```bash
# macOS
brew install flyctl

# Verify
fly version
```

---

## Step 2 — Login and create the app

```bash
fly auth login

# From the backend/ directory
cd backend
fly launch --no-deploy
```

When prompted:
- **App name:** `gyangrit-backend` (or whatever you want)
- **Region:** select `bom` (Mumbai, India)
- **Postgres:** No (you're using Supabase)
- **Redis:** No

This creates a `fly.toml` in `backend/`.

---

## Step 3 — fly.toml configuration

Replace the generated `fly.toml` with this:

```toml
app = "gyangrit-backend"
primary_region = "bom"

[build]
  # Fly auto-detects Django and uses the Dockerfile if present,
  # or Nixpacks otherwise. No Dockerfile needed.

[env]
  PORT = "8000"
  DJANGO_SETTINGS_MODULE = "gyangrit.settings.prod"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = false   # keep always-on
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"
```

---

## Step 4 — Create a Dockerfile

Fly works best with a Dockerfile. Create `backend/Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements/prod.txt requirements/prod.txt
COPY requirements/base.txt requirements/base.txt
RUN pip install --no-cache-dir -r requirements/prod.txt

# Copy source
COPY . .

# Collect static files (WhiteNoise serves them)
RUN python manage.py collectstatic --no-input

# Expose port
EXPOSE 8000

# Run migrations then start Gunicorn
CMD ["sh", "-c", "python manage.py migrate --no-input && gunicorn gyangrit.wsgi:application --bind 0.0.0.0:8000 --workers 2 --threads 2 --timeout 120"]
```

---

## Step 5 — Set environment variables

```bash
# Set each secret individually
fly secrets set SECRET_KEY="your-50-char-secret-key" \
  DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require" \
  ALLOWED_HOSTS="gyangrit-backend.fly.dev" \
  CORS_ALLOWED_ORIGINS="https://gyan-grit.vercel.app" \
  DEBUG="False" \
  DJANGO_SETTINGS_MODULE="gyangrit.settings.prod" \
  CLOUDFLARE_R2_ACCOUNT_ID="..." \
  CLOUDFLARE_R2_ACCESS_KEY_ID="..." \
  CLOUDFLARE_R2_SECRET_ACCESS_KEY="..." \
  CLOUDFLARE_R2_BUCKET_NAME="gyangrit-media" \
  CLOUDFLARE_R2_PUBLIC_URL="https://pub-xxxx.r2.dev" \
  FAST2SMS_API_KEY="your-fast2sms-key"
```

Verify they were set:
```bash
fly secrets list
```

---

## Step 6 — Deploy

```bash
fly deploy
```

First deploy takes ~3-5 minutes (builds Docker image, pushes to Mumbai).
Subsequent deploys are faster.

Watch the logs:
```bash
fly logs
```

---

## Step 7 — Test

```bash
# Health check
curl https://gyangrit-backend.fly.dev/api/v1/health/
# Expected: {"status": "ok", "service": "gyangrit-backend", ...}

# CSRF
curl https://gyangrit-backend.fly.dev/api/v1/accounts/csrf/
# Expected: {"csrfToken": "..."}
```

---

## Step 8 — Update Vercel env var

In Vercel → Project → Settings → Environment Variables, update:

```
VITE_API_URL = https://gyangrit-backend.fly.dev/api/v1
```

And update your Fly.io secrets to add the Vercel URL to CORS:
```bash
fly secrets set CORS_ALLOWED_ORIGINS="https://gyan-grit.vercel.app"
```

---

## Migrating from Render → Fly.io

1. Deploy to Fly.io following steps above
2. Confirm health check returns 200
3. Update `VITE_API_URL` in Vercel to point to `fly.dev` URL
4. Delete the Render web service (to avoid paying for both)
5. Keep Render until Fly.io is confirmed working

---

## Useful Fly.io commands

```bash
fly status                    # show app status and running machines
fly logs                      # tail live logs
fly ssh console               # SSH into the running container
fly secrets list              # list all env vars (values hidden)
fly secrets set KEY=value     # add/update a secret
fly deploy                    # deploy latest code
fly scale count 1             # ensure 1 machine is running
fly regions list              # show available regions
fly platform regions          # show capacity per region
```

---

## Why Mumbai specifically

| Location | Role | Distance |
|---|---|---|
| Mumbai (bom) | Fly.io backend | 0 km |
| Mumbai | Supabase DB | ~0 km (same city) |
| Mumbai | Vercel edge node | ~0 km (Vercel Mumbai POP) |

DB query latency: <5ms (same city vs 30-40ms Singapore→Mumbai)
Login round-trip: <500ms total expected (vs ~3s with Singapore backend)
