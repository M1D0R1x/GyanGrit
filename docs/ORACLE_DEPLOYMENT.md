# GyanGrit — Oracle Cloud Production Deployment

> **Server:** Oracle Cloud Mumbai · A1.Flex (ARM64) · Ubuntu 24.04 LTS  
> **IP:** 161.118.168.247  
> **API URL:** https://api.gyangrit.site  
> **App path:** `/opt/gyangrit/`

---

## Quick Reference — Everyday Commands

```bash
# SSH into server
ssh -i ~/Downloads/ssh-key-2026-03-26.key ubuntu@161.118.168.247

# View live Django logs
sudo journalctl -u gyangrit -f

# Last 100 log lines
sudo journalctl -u gyangrit -n 100 --no-pager

# Restart app
sudo systemctl restart gyangrit

# Reload (zero-downtime, keeps existing workers alive)
sudo systemctl reload gyangrit

# Check app status
sudo systemctl status gyangrit

# Check nginx
sudo systemctl status nginx
sudo tail -20 /var/log/nginx/error.log

# Manual deploy (if CI/CD fails)
cd /opt/gyangrit
git pull origin master
source backend/venv/bin/activate
pip install -r backend/requirements/prod.txt
cd backend
python manage.py migrate --no-input
python manage.py collectstatic --no-input --clear
cd /opt/gyangrit
sudo systemctl reload gyangrit
```

---

## Automated Deployment (Normal Flow)

Every `git push origin master` (touching `backend/`) triggers GitHub Actions:

1. **Lint** — `python manage.py check --fail-level WARNING` on Ubuntu CI runner
2. **SSH deploy** — pulls code, installs deps, runs migrations, collectstatic
3. **Graceful reload** — `systemctl reload gyangrit` (zero-downtime)
4. **Health check** — 3 attempts × 5s against `http://127.0.0.1:8000/api/v1/health/`
5. **Auto-rollback** — `git reset --hard $PREV_SHA` + restart if any step fails

GitHub Secrets required: `ORACLE_HOST`, `ORACLE_USERNAME`, `ORACLE_KEY`

---

## Environment Variables

File: `/opt/gyangrit/backend/.env`

```bash
# Verify current env
cat /opt/gyangrit/backend/.env
```

### Full `.env` Template

```env
# Django
DJANGO_SETTINGS_MODULE=gyangrit.settings.prod
SECRET_KEY=<long-random-string>
DEBUG=False

# Database
DATABASE_URL=postgres://postgres.<project>:<password>@<host>.supabase.com:5432/postgres?sslmode=require

# Hosts & CORS
ALLOWED_HOSTS=161.118.168.247,api.gyangrit.site
CORS_ALLOWED_ORIGINS=https://gyangrit.site,https://www.gyangrit.site

# Redis (Upstash)
UPSTASH_REDIS_KV_URL=rediss://default:<password>@<host>.upstash.io:6379

# QStash (cron auth)
QSTASH_TOKEN=<token>

# Email (Zoho SMTP)
EMAIL_HOST=smtp.zoho.in
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@gyangrit.site
EMAIL_HOST_PASSWORD=<app-password>
DEFAULT_FROM_EMAIL=GyanGrit <noreply@gyangrit.site>

# AI providers (fallback chain: BOA → Groq → Together → Gemini)
# BOA_API_KEY_1 through BOA_API_KEY_N — round-robin rotation (Bay of Assets, Claude Haiku 4.5)
GROQ_API_KEY=gsk_<key>
TOGETHER_API_KEY=<key>
GEMINI_API_KEY=AIza<key>

# LiveKit
LIVEKIT_URL=wss://gyangrit-ld2s7sp2.livekit.cloud
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<secret>
LIVEKIT_RECORDING_WEBHOOK_SECRET=<secret>

# Cloudflare R2
CLOUDFLARE_R2_ACCESS_KEY_ID=<key>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<secret>
CLOUDFLARE_R2_ACCOUNT_ID=<account-id>
CLOUDFLARE_R2_BUCKET_NAME=gyangrit-media
CLOUDFLARE_R2_PUBLIC_URL=https://pub-<hash>.r2.dev
CLOUDFLARE_R2_RECORDINGS_PREFIX=recordings/

# Ably (real-time chat)
ABLY_API_KEY=<key>

# SMS OTP
FAST2SMS_API_KEY=<key>

# VAPID (push notifications)
VAPID_PUBLIC_KEY=<base64url-key>
VAPID_PRIVATE_KEY=<base64url-key>
VAPID_CLAIMS_EMAIL=mailto:admin@gyangrit.site

# Sentry
SENTRY_DSN=https://<key>@sentry.io/<project-id>

# Backend URL (used internally for webhook verification)
BACKEND_BASE_URL=https://api.gyangrit.site
```

---

## Service Architecture

```
Internet (HTTPS :443)
        ↓
Cloudflare CDN + DNS
        ↓
Nginx (Ubuntu, :443 SSL)
        │  reverse proxy
        ↓
Gunicorn (:8000, 5 gthread workers)
        │
        ↓
Django (gyangrit.settings.prod)
```

---

## Systemd Service

File: `/etc/systemd/system/gyangrit.service`

```ini
[Unit]
Description=GyanGrit Django Backend
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/gyangrit/backend
Environment=DJANGO_SETTINGS_MODULE=gyangrit.settings.prod
EnvironmentFile=/opt/gyangrit/backend/.env
ExecStart=/opt/gyangrit/backend/venv/bin/gunicorn gyangrit.wsgi:application -c gunicorn.conf.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**Gunicorn config** (`backend/gunicorn.conf.py`):
- Workers: 5 (gthread)
- Threads: 2 per worker  
- `max_requests=500`, `max_requests_jitter=50` (prevents memory leaks)
- `timeout=60`

---

## Nginx Configuration

File: `/etc/nginx/sites-available/gyangrit`

```nginx
server {
    listen 443 ssl;
    server_name api.gyangrit.site;

    ssl_certificate /etc/letsencrypt/live/api.gyangrit.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.gyangrit.site/privkey.pem;

    location /static/ {
        alias /opt/gyangrit/backend/staticfiles/;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.gyangrit.site;
    return 301 https://$host$request_uri;
}
```

SSL is managed by Let's Encrypt Certbot (auto-renew).

---

## Oracle Internal Firewall (iptables)

Oracle Ubuntu ships with hardened iptables that block Nginx even after opening ports in the Cloud Console:

```bash
# One-time setup — insert rules ABOVE the REJECT wildcard at line 5
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## Cron Jobs (Upstash QStash)

| Schedule | Endpoint | Purpose |
|---|---|---|
| Every 5 min | `https://api.gyangrit.site/api/v1/health/` | Keep-alive ping |
| Daily 2:00 AM UTC | `https://api.gyangrit.site/api/v1/analytics/nightly-recompute/` | Recompute student risk scores + teacher alerts |

QStash sends the `Authorization: Bearer <QSTASH_TOKEN>` header. The backend verifies this before processing nightly-recompute.

---

## Database Backup

```bash
pg_dump \
  -h aws-0-ap-south-1.pooler.supabase.com \
  -U postgres.<project> \
  -d postgres \
  -Fc > gyangrit_backup_$(date +%Y%m%d).dump
```

---

## Static Files

Static files are collected on every deploy by `python manage.py collectstatic --no-input --clear`.

Served by WhiteNoise (`RelaxedManifestStaticFilesStorage` with `manifest_strict=False`) to prevent admin 500s when `django-unfold` updates between deploys.

---

## SSL Certificate

```bash
# Initial setup
sudo certbot --nginx -d api.gyangrit.site

# Check renewal
sudo certbot renew --dry-run

# Auto-renew via systemd timer (pre-configured by certbot)
sudo systemctl status certbot.timer
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| 502 Bad Gateway | Gunicorn not running | `sudo systemctl restart gyangrit` |
| 500 on `/admin/` | Static files not collected | `python manage.py collectstatic --no-input` |
| OOM SIGKILL in logs | Worker memory leak | `max_requests=500` is set — check for runaway analytics |
| Health check fails | Wrong Host header | Nginx must pass `Host: api.gyangrit.site` header |
| Deploy rollback triggered | Any deploy step failed | Check CI logs — `git log --oneline -5` to confirm SHA |
