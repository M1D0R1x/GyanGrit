# GyanGrit — System Architecture & Design Documentation

> **Last updated:** April 2026  
> **Backend:** Oracle Cloud Mumbai (A1 ARM64) · **Frontend:** Vercel  
> **Production:** https://www.gyangrit.site · https://api.gyangrit.site

---

## 1. Introduction

GyanGrit is a role-based digital learning platform for rural government schools in Punjab, India. It delivers structured educational content, tracks learner progress, provides analytics for teachers and administrators, and motivates students through a gamification layer.

**Core stack:**
- **Backend:** Django 4.2 + Python 3.12 on Oracle Cloud Mumbai (ARM64)
- **Frontend:** React 19 + Vite + TypeScript, deployed on Vercel
- **Database:** PostgreSQL via Supabase (shared across all environments)
- **Cache/Sessions:** Upstash Redis (serverless, Mumbai region)
- **Auth:** Django session-based with single-device enforcement

---

## 2. High-Level Architecture

```
Browser (React SPA + PWA)
        │
        │ HTTPS + Session Cookie + CSRF Token
        ▼
  Cloudflare (DNS + Proxy)
        │
        ▼
  Nginx (Oracle VM, port 443) ← Let's Encrypt SSL
        │
        ▼
  Gunicorn (5 gthread workers, port 8000)
        │
        ▼
  Django Backend (18 apps, /api/v1/)
        │
        ├── PostgreSQL (Supabase — Mumbai region)
        ├── Redis (Upstash — sessions, rate limiting, caching)
        ├── Cloudflare R2 (media, recordings)
        └── External APIs (LiveKit, Ably, Groq, Fast2SMS, Zoho)
```

The frontend is a SPA that communicates exclusively through the versioned REST API. Django templates are used only for the admin panel (`/admin/`).

---

## 3. Backend Architecture

### 3.1 App Structure

The backend is divided into 18 independent Django apps under `backend/apps/`:

| App | Responsibility |
|---|---|
| `accounts` | Users, authentication, OTP, join codes, device sessions, audit log |
| `academics` | Districts, institutions, classrooms, sections, subjects, teaching assignments |
| `accesscontrol` | Role-based permission decorators and queryset scoping |
| `content` | Courses, lessons, section lessons, lesson progress, batch progress, teacher analytics |
| `learning` | Enrollments, learning paths |
| `assessments` | Assessments, questions, options, attempts, scoring, AI generator |
| `roster` | Bulk student pre-registration via Excel upload |
| `gamification` | Points, badges, streaks, leaderboard |
| `notifications` | In-app + browser push notification delivery (VAPID/pywebpush) |
| `media` | Cloudflare R2 presigned upload/delete URL management |
| `ai_assistant` | Multi-provider AI tutor (BOA Claude Haiku → Groq → Together → Gemini) |
| `chatrooms` | Real-time messaging via Ably (subject, staff, officials rooms) |
| `competitions` | Live quiz competition rooms with real-time scoring |
| `flashcards` | Spaced-repetition flashcard decks (SM-2 algorithm), AI generator |
| `gradebook` | Term-based marks, categories (oral/practical/test), class-level reporting |
| `livesessions` | LiveKit WebRTC live class sessions, attendance, Egress recording |
| `analytics` | Student risk scores, engagement events, nightly recompute, teacher alerts |

Each app owns its domain completely. Cross-app access goes through model relationships and signals — never through direct view imports.

---

### 3.2 Authentication & Session Management

**Login flows:**
- `STUDENT` / `ADMIN`: direct session login, no OTP
- `TEACHER` / `PRINCIPAL` / `OFFICIAL`: password → OTP (email or SMS via Fast2SMS)

**Single-device enforcement:**
`SingleActiveSessionMiddleware` compares the current session key against the stored `DeviceSession` on every authenticated request. A new login from another device terminates the previous session immediately.

**Session storage:** Redis (Upstash) via `django-redis`. All sessions are stored server-side and can be revoked instantly.

**CSRF:** Every frontend POST/PATCH/DELETE sends an `X-CSRFToken` header read from the `gyangrit_csrftoken` cookie. The `GET /api/v1/accounts/csrf/` endpoint seeds the cookie on app mount.

---

### 3.3 Permission System

`apps/accesscontrol/permissions.py` provides decorator-based guards:

```python
@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
def create_lesson(request, course_id):
    ...
```

`scope_queryset(request.user, queryset)` applies ORM-level filters based on role:
- `STUDENT` → only their section's content
- `TEACHER` → only their assigned classrooms/subjects
- `PRINCIPAL` → only their institution
- `OFFICIAL` → only their district
- `ADMIN` → no filter (full access)

---

### 3.4 Settings Architecture

```
backend/gyangrit/settings/
├── base.py    # Shared — DB, cache, installed apps, Sentry, email, LiveKit
├── dev.py     # Local — DEBUG=True, no SSL, SQLite fallback disabled
└── prod.py    # Oracle — HTTPS redirect, HSTS, RelaxedManifest, ALLOWED_HOSTS
```

**`gyangrit/storage.py`** — Custom storage class:
```python
class RelaxedManifestStaticFilesStorage(CompressedManifestStaticFilesStorage):
    manifest_strict = False  # Prevents 500 on missing unfold statics between deploys
```

---

### 3.5 Gunicorn Configuration

`backend/gunicorn.conf.py`:
- **Workers:** 5 (`gthread` worker class)
- **Threads:** 2 per worker
- **`max_requests=500` + `max_requests_jitter=50`** — Workers recycle after 500 requests to prevent memory leaks
- **`timeout=60`** — Prevents zombie workers on slow DB queries
- **`bind=127.0.0.1:8000`** — Only accessible through Nginx

---

### 3.6 AI Provider Chain

`apps/ai_assistant/views.py` uses a cascading fallback:

```
Request → Groq (llama-3.3-70b, 30 req/min free)
            ↓ 429 / timeout
        → Together AI (Llama-4-Maverick-17B, $25 free credit)
            ↓ 429 / timeout
        → Gemini 2.0 Flash (15 req/min free, last resort)
            ↓ exhausted
        → Error response (user informed)
```

Redis rate limiting (10 req/min per user) prevents one student from exhausting the shared Groq quota.

---

### 3.7 Analytics App

`apps/analytics/` provides:

**Models:**
- `EngagementEvent` — records user actions (login, lesson completion, assessment pass/fail, etc.)
- `StudentRiskScore` — risk score (0–100) per student with tier: `LOW` (0-29) / `MEDIUM` (30-59) / `HIGH` (60-100). Calculated from 7 weighted signals: login recency (0-25), engagement trend (0-20), assessment failures (0-15), lesson completion rate (0-15), assessment avoidance (0-10), live session absence (0-10), streak broken (0-5). Recalculated on every assessment submission + nightly via QStash cron.

**Nightly recompute:** QStash calls `POST /api/v1/analytics/nightly-recompute/` at 2:00 AM UTC. This recalculates risk scores for all students and sends in-app alerts to teachers when a student transitions into `at_risk` or `critical`.

**Risk formula (weighted signals):**
- Login recency (weight: 0.3)
- Assessment score trend (weight: 0.3)
- Lesson completion rate (weight: 0.2)
- Live session attendance (weight: 0.2)

---

## 4. Database

### 4.1 Provider

PostgreSQL on Supabase (shared across dev and prod). No SQLite fallback in any environment.

**Connection:** `DATABASE_URL` env var, parsed by `dj-database-url`.  
**Pooling:** `CONN_MAX_AGE=60` — safe with gthread workers and same-region DB.

### 4.2 Key Design Decisions

**Derived progress** — Course completion % is computed at request time from `LessonProgress` counts. Never stored as a separate field — eliminates staleness bugs.

**Batch course progress** — `/api/v1/courses/progress/batch/?ids=1,2,3` resolves N courses in 2 DB queries (lessons fetch + progress fetch). Dashboard uses this instead of N individual calls.

**Ledger-based gamification** — Points stored as immutable `PointEvent` records, aggregated into `StudentPoints`. Double-awarding is architecturally impossible.

**Denormalised `district` on User** — Avoids a join on every analytics query. Always synced by `User.save()`.

---

## 5. Caching (Redis / Upstash)

| Use | TTL | Key pattern |
|---|---|---|
| Django sessions | `SESSION_COOKIE_AGE` | Django default |
| System stats | 60s | `system_stats` |
| Leaderboard (future) | 5 min | `leaderboard:{section_id}` |

**Provider:** Upstash Redis (serverless, pay-per-command, Mumbai region).  
**Django integration:** `django-redis` backend configured in `prod.py`.

---

## 6. Frontend Architecture

### 6.1 Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **React Router v6** — client-side routing with lazy-loaded pages
- **Custom CSS** — Obsidian glassmorphism design system v3 (no Tailwind, no UI library)
- **PWA** — Service worker caching, IndexedDB offline storage

### 6.2 Directory Structure

```
frontend/src/
├── auth/          AuthContext, role guards, Protected wrapper
├── components/    TopBar, BottomNav, Sidebar, NotificationPanel, etc.
├── pages/         50 route pages (lazy-loaded)
├── services/      api.ts + 23 domain service files
├── utils/         slugs, date helpers, offline utilities
└── app/           router.tsx (95+ routes)
```

### 6.3 API Service Layer

All API calls go through `src/services/api.ts`:
- Session cookies: `credentials: "include"` on every request
- CSRF: `X-CSRFToken` header from `gyangrit_csrftoken` cookie
- Relative paths only — base URL from `VITE_API_URL` env var

Service files per domain:
`content.ts`, `assessments.ts`, `analytics.ts`, `livesessions.ts`, `notifications.ts`, `gamification.ts`, `flashcards.ts`, `gradebook.ts`, `chatrooms.ts`, `competitions.ts`, `courseProgress.ts`, etc.

### 6.4 Key Frontend Pages

| Route | Component | Role |
|---|---|---|
| `/dashboard` | `DashboardPage` | STUDENT |
| `/courses/:grade/:subject` | `LessonsPage` | STUDENT |
| `/live/:sessionId` | `LivePage` | STUDENT |
| `/teacher/dashboard` | `TeacherDashboardPage` | TEACHER |
| `/teacher/ai-tools` | `AIToolsPage` | TEACHER |
| `/principal/dashboard` | `PrincipalDashboardPage` | PRINCIPAL |
| `/official/dashboard` | `OfficialDashboardPage` | OFFICIAL |
| `/admin/live` | `AdminLiveSessionsPage` | ADMIN/TEACHER/PRINCIPAL |
| `/admin-panel` | `AdminContentPage` | ADMIN |
| `/notifications` | `NotificationsPage` | ALL |
| `/chat` | `ChatPage` | ALL |
| `/competitions` | `CompetitionsPage` | ALL |
| `/downloads` | `OfflineDownloadsPage` | STUDENT |

---

## 7. Infrastructure

### 7.1 Oracle Cloud VM

- **Shape:** A1.Flex (ARM64 / aarch64)
- **OS:** Ubuntu 24.04 LTS
- **IP:** 161.118.168.247
- **Domain:** `api.gyangrit.site` (A record → 161.118.168.247)
- **SSL:** Let's Encrypt via Certbot (auto-renew)
- **Path:** `/opt/gyangrit/`

### 7.2 Systemd Service

```ini
[Service]
User=ubuntu
WorkingDirectory=/opt/gyangrit/backend
ExecStart=/opt/gyangrit/backend/venv/bin/gunicorn gyangrit.wsgi:application -c gunicorn.conf.py
Restart=always
RestartSec=3
```

### 7.3 Nginx Configuration

Nginx listens on 443 (SSL termination) and proxies to Gunicorn on `127.0.0.1:8000`. Passes `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` headers.

Static files served by WhiteNoise (Nginx bypass).

### 7.4 CI/CD (GitHub Actions)

`.github/workflows/deploy.yml`:
1. Lint job — `python manage.py check --fail-level WARNING`
2. SSH deploy — git pull → pip install → migrate → collectstatic → systemctl reload
3. 3-attempt health check against `http://127.0.0.1:8000/api/v1/health/`
4. Auto-rollback with `trap ERR` if any step fails
5. `concurrency: production-deploy` prevents parallel deploys

---

## 8. External Services

| Service | Purpose | Free Tier |
|---|---|---|
| Supabase | PostgreSQL | Free (500MB) |
| Upstash Redis | Sessions, rate limiting, cache | Free (10K cmds/day) |
| Upstash QStash | Cron jobs (health + nightly analytics) | Free (500 msg/day) |
| Vercel | Frontend hosting | Free (Hobby) |
| Oracle Cloud | Backend VM (A1.Flex) | Always Free |
| Cloudflare R2 | Media + recordings storage | Free (10GB) |
| LiveKit Cloud | WebRTC live classes + recording | Free tier |
| Ably | Real-time chat WebSocket | Free (6M msgs/month) |
| Sentry | Error tracking | Free (5K events/month) |
| Groq | AI primary (llama-3.3-70b) | Free (30 req/min) |
| Together AI | AI fallback | $25 free credit |
| Google Gemini | AI last resort | Free (15 req/min) |
| Fast2SMS | SMS OTP (India) | Pay-per-SMS |
| Zoho Mail | Transactional email | Free (5 users) |

---

## 9. Security

- **HTTPS-only** — `SECURE_SSL_REDIRECT=True`, `HSTS` enabled with `includeSubdomains`
- **Session-based auth** — revocable server-side, no JWT
- **Single-device enforcement** — middleware-level, not just application-level
- **CSRF** — token required on all state-changing requests
- **ALLOWED_HOSTS** — strict list; `127.0.0.1`/`localhost` included for health checks
- **CORS** — restricted to `https://gyangrit.site` and `https://www.gyangrit.site`
- **Role queryset scoping** — ORM-level filters, data can never leak between roles
- **OTP verification** — required for all staff logins; 6-digit codes, single-use

---

## 10. Architecture Decision Records

| ADR | Decision | Rationale | Date |
|---|---|---|---|
| ADR-001 | Groq primary AI, Gemini last resort | Groq: 30 req/min vs Gemini: 15 req/min shared quota | 2026-04-03 |
| ADR-002 | LiveKit Egress for recording | No extra VM load; LiveKit Cloud handles encoding | 2026-04-03 |
| ADR-003 | Redis rate limiting not `sleep()` | `sleep()` blocks gthread workers; Redis is non-blocking | 2026-04-03 |
| ADR-004 | `conn_max_age=60` | Safe with gthread + same-region DB (Mumbai–Mumbai) | 2026-04-03 |
| ADR-005 | Session-based auth over JWT | Server-side revocation needed for single-device enforcement | 2026-03-01 |
| ADR-006 | ARM64 wheels on Oracle A1 | A1.Flex is aarch64; x86 wheels fail silently with SIGILL | 2026-04-03 |
| ADR-007 | `RelaxedManifestStaticFilesStorage` | `CompressedManifestStaticFilesStorage` strict mode causes admin 500 on unfold updates | 2026-04-05 |
| ADR-008 | R2 public bucket for recordings | Presigned URLs add 50ms per list request; public bucket is zero-latency | 2026-04-04 |
| ADR-009 | Batch course progress endpoint | Dashboard made N individual progress calls; batch does it in 2 DB queries | 2026-04-05 |
| ADR-010 | QStash for cron (not Celery Beat) | No additional Celery worker process needed; Oracle VM is memory-constrained | 2026-04-04 |
| ADR-011 | `max_requests=500` on gunicorn | Recycles workers to prevent memory leaks from boto3 / large analytics operations | 2026-04-04 |
