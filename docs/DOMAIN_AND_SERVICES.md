# GyanGrit — Domain, Services & External APIs

> **Last updated:** April 2026

---

## Production URLs

| Endpoint | URL |
|---|---|
| Frontend | https://www.gyangrit.site |
| Backend API | https://api.gyangrit.site/api/v1/ |
| Admin Panel | https://api.gyangrit.site/admin/ |
| Health Check | https://api.gyangrit.site/api/v1/health/ |

---

## Domain Setup

**Registrar:** Namecheap  
**Domain:** `gyangrit.site`

### DNS Records (managed in Vercel)

```
Type    Host    Value                           Purpose
A       @       76.76.21.21                     Frontend (Vercel)
CNAME   www     cname.vercel-dns.com            Frontend www
A       api     161.118.168.247                 Backend (Oracle Cloud)
MX      @       mx.zoho.in          (pri 10)    Email
MX      @       mx2.zoho.in         (pri 20)    Email
MX      @       mx3.zoho.in         (pri 50)    Email
TXT     @       v=spf1 include:zoho.in ~all     SPF (email auth)
TXT     @       zoho-verification=...           Zoho domain verify
```

---

## Email (Zoho Mail)

**Provider:** Zoho Mail Forever Free (5 mailboxes)  
**SMTP host:** `smtp.zoho.in:587` (TLS)  
**From address:** `noreply@gyangrit.site`

**Purpose:** Password reset, OTP delivery fallback, teacher notifications

**Django config:**
```env
EMAIL_HOST=smtp.zoho.in
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@gyangrit.site
EMAIL_HOST_PASSWORD=<16-char app password from Zoho>
DEFAULT_FROM_EMAIL=GyanGrit <noreply@gyangrit.site>
```

---

## SMS OTP — Fast2SMS

**Provider:** Fast2SMS (India)  
**Purpose:** SMS OTP delivery for TEACHER / PRINCIPAL / OFFICIAL logins  
**Requirement:** DLT website verification must be completed for OTP API (status_code 996 = not verified)  
**Fallback:** Email OTP if Fast2SMS fails

```env
FAST2SMS_API_KEY=<key>
```

---

## Database — Supabase PostgreSQL

**Provider:** Supabase (AWS ap-south-1)  
**Plan:** Free (500MB, pauses after 1 week inactive — upgrade if needed)  
**Shared:** Same database used in dev and prod

```env
DATABASE_URL=postgres://postgres.<project>:<password>@<host>.supabase.com:5432/postgres?sslmode=require
```

**Backup:**
```bash
pg_dump -h aws-0-ap-south-1.pooler.supabase.com -U postgres.<project> -d postgres -Fc > backup.dump
```

---

## Cache & Sessions — Upstash Redis

**Provider:** Upstash (serverless Redis, Mumbai region)  
**Plan:** Free (10K commands/day)  
**Uses:**
- Django session storage (`SESSION_ENGINE=redis`)
- AI rate limiting (10 req/min per user)
- System stats cache (60s TTL)

```env
UPSTASH_REDIS_KV_URL=rediss://default:<password>@<host>.upstash.io:6379
```

---

## Cron Jobs — Upstash QStash

**Provider:** Upstash QStash  
**Plan:** Free (500 messages/day)  
**Auth:** QStash sends `Authorization: Bearer <QSTASH_TOKEN>` on every request

| Schedule | Endpoint | Purpose |
|---|---|---|
| Every 5 min | `/api/v1/health/` | Keep-alive (prevents cold start) |
| Daily 2 AM UTC | `/api/v1/analytics/nightly-recompute/` | Student risk recompute + teacher alerts |

```env
QSTASH_TOKEN=<token>
```

---

## Live Classes — LiveKit Cloud

**Provider:** LiveKit Cloud (Mumbai region)  
**Plan:** Free tier  
**Features used:** WebRTC rooms, Egress → Cloudflare R2 recording

```env
LIVEKIT_URL=wss://gyangrit-ld2s7sp2.livekit.cloud
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<secret>
LIVEKIT_RECORDING_WEBHOOK_SECRET=<secret>  # for webhook auth (openssl rand -hex 32)
```

---

## Media Storage — Cloudflare R2

**Provider:** Cloudflare R2  
**Plan:** Free (10GB storage, 1M Class A ops/month)  
**Bucket:** `gyangrit-media`  
**Uses:** Lesson videos, PDFs, thumbnails, live session recordings

```env
CLOUDFLARE_R2_ACCESS_KEY_ID=<key>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<secret>
CLOUDFLARE_R2_ACCOUNT_ID=<id>
CLOUDFLARE_R2_BUCKET_NAME=gyangrit-media
CLOUDFLARE_R2_PUBLIC_URL=https://pub-<hash>.r2.dev   # public CDN URL
CLOUDFLARE_R2_RECORDINGS_PREFIX=recordings/
```

---

## Real-time Chat — Ably

**Provider:** Ably  
**Plan:** Free (6M messages/month)  
**Uses:** Subject chat rooms, staff channels, official channels  
**Frontend SDK:** `@ably/react`

```env
ABLY_API_KEY=<key>
```

---

## AI — Multi-Provider Fallback Chain

| Priority | Provider | Model | Limit | Cost |
|---|---|---|---|---|
| 1 (primary) | Groq | `llama-3.3-70b-versatile` | 30 req/min free | Free |
| 2 (fallback) | Together AI | `Llama-4-Maverick-17B` | Rate-limited | $25 free credit |
| 3 (last resort) | Google Gemini | `gemini-2.0-flash` | 15 req/min | Free |

Redis rate limiting: 10 req/min per user (prevents shared quota exhaustion)

```env
GROQ_API_KEY=gsk_<key>
TOGETHER_API_KEY=<key>
GEMINI_API_KEY=AIza<key>
```

---

## Push Notifications — pywebpush + VAPID

**Library:** `pywebpush`  
**Implementation:** VAPID key pair stored in env vars  

```bash
# Generate VAPID keys (one-time setup)
python manage.py generate_vapid_keys
```

```env
VAPID_PUBLIC_KEY=<base64url-key>
VAPID_PRIVATE_KEY=<base64url-key>
VAPID_CLAIMS_EMAIL=mailto:admin@gyangrit.site
```

---

## Error Tracking — Sentry

**Provider:** Sentry  
**Plan:** Free (5K events/month)  
**Integration:** Python SDK (backend) + JavaScript SDK (frontend)  
**Release tracking:** Git SHA injected at deploy time

```env
SENTRY_DSN=https://<key>@sentry.io/<project-id>
```

**Sentry project:** `bronze-garden`  
**42 errors resolved** (all logged in `SENTRY_ERRORS.md`)

---

## Frontend Hosting — Vercel

**Provider:** Vercel  
**Plan:** Hobby (free)  
**Build:** `npm run build` (Vite)  
**Environment variable:** `VITE_API_URL=https://api.gyangrit.site/api/v1`

Deployments triggered on every push to `master` (frontend changes).

---

## Total Cost Summary

| Service | Monthly Cost |
|---|---|
| Oracle Cloud VM (A1.Flex ARM64) | $0 (Always Free) |
| Vercel (frontend) | $0 |
| Supabase (PostgreSQL) | $0 |
| Upstash Redis | $0 |
| Upstash QStash | $0 |
| Cloudflare R2 (media) | $0 |
| LiveKit Cloud | $0 |
| Ably (chat) | $0 |
| Groq AI | $0 |
| Gemini AI | $0 |
| Together AI | $0 (credit) |
| Zoho Mail | $0 |
| Sentry | $0 |
| Domain `gyangrit.site` | ~$2.67/mo (year 2: $32/yr) |
| **Total** | **~$2.67/mo** |
