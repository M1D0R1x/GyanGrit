# GyanGrit — Render Configuration

## Start Command (set in Render dashboard → Web Service → Settings)

```
gunicorn gyangrit.wsgi:application -c gunicorn.conf.py
```

## Why gevent workers (added 2026-03-25)

Default Render free: 1 sync worker → 1 request at a time → breaks at 50 users.
gevent worker: 1 worker handles 100 concurrent connections via async I/O.
Result: handles 50 simultaneous users on free 512MB instance.

## Environment Variables (Render dashboard → Environment)

| Key | Value |
|---|---|
| SECRET_KEY | <your secret key> |
| DATABASE_URL | postgresql://... (from Supabase) |
| ALLOWED_HOSTS | gyangrit.onrender.com |
| CORS_ALLOWED_ORIGINS | https://gyan-grit.vercel.app |
| DEBUG | False |
| DJANGO_SETTINGS_MODULE | gyangrit.settings.prod |
| TWILIO_ACCOUNT_SID | <sid> |
| TWILIO_AUTH_TOKEN | <token> |
| TWILIO_PHONE_NUMBER | <number> |
| EMAIL_HOST_USER | noreply@gyangrit.site |
| EMAIL_HOST_PASSWORD | <zoho app password> |
| ABLY_API_KEY | <key> |
| CLOUDFLARE_R2_ACCESS_KEY_ID | <key> |
| CLOUDFLARE_R2_SECRET_ACCESS_KEY | <key> |
| CLOUDFLARE_R2_BUCKET_NAME | <bucket> |
| CLOUDFLARE_R2_ENDPOINT_URL | <endpoint> |

## After each deploy, run via Render Shell:
```bash
python manage.py bootstrap_chatrooms
python manage.py collectstatic --no-input
```

## Capacity with current setup

| Tier | Concurrent users | Notes |
|---|---|---|
| Render Free + gevent | ~50 comfortable | gevent handles I/O concurrency |
| Render Starter ($7/mo) | ~100 | 2 workers × 100 connections |
| Render Standard ($25/mo) | ~500 | 4 workers, 2GB RAM |

## LiveKit Cloud (for live video)

Free tier: 100 concurrent participants, 5,000 participant-minutes/month
→ Enough for capstone demos (50 people × 30 min = 1,500 minutes)
→ For daily school use, upgrade to Ship plan ($50/mo) when launched

gunicorn gyangrit.wsgi:application \
  --worker-class gevent \
  --workers 1 \
  --worker-connections 100 \
  --timeout 60 \
  --bind 0.0.0.0:$PORT