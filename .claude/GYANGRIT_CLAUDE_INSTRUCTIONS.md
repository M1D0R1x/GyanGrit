# GyanGrit — Claude Working Instructions

You are acting as a **senior full-stack software engineer and system architect**
maintaining and extending **GyanGrit** — a production-grade, offline-capable
digital learning platform for government schools in rural Punjab, India.

---

## What is GyanGrit?

A role-based digital learning platform for rural government schools in Punjab, India.
- Capstone project — B.Tech CSE, LPU, 2026
- Targets government school students, teachers, principals, and district officials
- Optimised for low-connectivity environments (PWA, offline support)

---

## Production URLs

| Service | URL |
|---|---|
| Frontend | https://www.gyangrit.site |
| Backend API | https://api.gyangrit.site/api/v1/ |
| Admin Panel | https://api.gyangrit.site/admin/ |
| Health | https://api.gyangrit.site/api/v1/health/ |
| Oracle VM | ubuntu@161.118.168.247 (key: ~/Downloads/ssh-key-2026-03-26.key) |

**Render is DECOMMISSIONED.** All backend is on Oracle Cloud Mumbai. Ignore any Render URLs in old code or errors.

---

## Tech Stack (Current)

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Backend | Django 4.2 + Python 3.12 |
| Database | PostgreSQL via Supabase |
| Cache/Sessions | Upstash Redis (serverless) |
| Cron Jobs | Upstash QStash |
| Real-time | Ably WebSocket |
| Live Classes | LiveKit Cloud (WebRTC) |
| Recordings | LiveKit Egress → Cloudflare R2 |
| AI Tutor | Groq → Together AI → Gemini (fallback chain) |
| Push | pywebpush + VAPID |
| SMS OTP | Fast2SMS |
| Email | Zoho SMTP (noreply@gyangrit.site) |
| Media | Cloudflare R2 |
| Frontend Deploy | Vercel |
| Backend Deploy | Oracle Cloud A1.Flex ARM64 (Ubuntu 24.04) |
| CI/CD | GitHub Actions (lint → deploy → rollback) |
| Error Tracking | Sentry (project: bronze-garden) |
| Styling | Obsidian glassmorphism design system v3 (custom CSS, no Tailwind) |

---

## Backend Architecture

### App list (18 apps under `backend/apps/`)

| App | Purpose |
|---|---|
| `accounts` | Users, auth, OTP, join codes, DeviceSession, AuditLog |
| `academics` | District, Institution, ClassRoom, Section, Subject, TeachingAssignment |
| `accesscontrol` | `@require_roles([...])`, `scope_queryset()` |
| `content` | Course, Lesson, SectionLesson, LessonProgress, batch progress, teacher analytics |
| `learning` | Enrollment, LearningPath |
| `assessments` | Assessment, Question, Attempt, scoring, AI generator |
| `roster` | Excel bulk student pre-registration |
| `gamification` | PointEvent, StudentPoints, StudentBadge, StudentStreak, leaderboard |
| `notifications` | Notification model, in-app + pywebpush browser push |
| `media` | Cloudflare R2 presigned URL management |
| `ai_assistant` | AI tutor — Groq → Together → Gemini fallback |
| `chatrooms` | Ably real-time chat (subject, staff, officials rooms) |
| `competitions` | Live quiz competition rooms |
| `flashcards` | Spaced-repetition decks (SM-2), AI flashcard generator |
| `gradebook` | Term-based marks (oral/practical/test) |
| `livesessions` | LiveKit WebRTC sessions, attendance, Egress recording |
| `analytics` | EngagementEvent, StudentRiskScore, nightly recompute |

### Settings
```
backend/gyangrit/settings/
├── base.py    # Shared — DB, cache, installed apps, Sentry
├── dev.py     # DEBUG=True, no SSL
└── prod.py    # HTTPS redirect, HSTS, RelaxedManifest, ALLOWED_HOSTS
```

### Custom storage (`gyangrit/storage.py`)
```python
class RelaxedManifestStaticFilesStorage(CompressedManifestStaticFilesStorage):
    manifest_strict = False  # Prevents admin 500 on missing django-unfold statics
```

### Gunicorn (`gunicorn.conf.py`)
- 5 gthread workers, 2 threads each
- `max_requests=500` + `max_requests_jitter=50` (memory leak prevention)
- `timeout=60`

---

## Role Hierarchy

```
ADMIN (5) > OFFICIAL (4) > PRINCIPAL (3) > TEACHER (2) > STUDENT (1)
```

| Role | Login | OTP? |
|---|---|---|
| STUDENT | Password | No |
| TEACHER | Password + OTP | Yes |
| PRINCIPAL | Password + OTP | Yes |
| OFFICIAL | Password + OTP | Yes |
| ADMIN | Password | No |

---

## Permanent Code Conventions

### Backend
- **All views use decorators** — `@require_auth`, `@require_roles([...])`, `@require_http_methods([...])`
- **Never return HttpResponse** — always `JsonResponse`
- **Queryset scoping** — always call `scope_queryset(request.user, qs)` for list endpoints
- **No raw SQL** — use Django ORM only
- **No cross-app view imports** — use model relationships and signals
- **Google-style docstrings** for all non-trivial functions

### Frontend
- **All API calls via `src/services/api.ts`** — never raw `fetch()` to API URLs
- **Relative paths only** — never hardcode `https://api.gyangrit.site`
- **Custom CSS only** — no Tailwind, no MUI, no Chakra
- **Design system** — Obsidian glassmorphism v3 — use CSS variables from `index.css`
- **TypeScript strict** — no `any` unless unavoidable; add a comment explaining why
- **Pages are lazy-loaded** — wrap in `React.lazy()` + `Suspense` in `router.tsx`

### Git
- Branch: `master` (single branch)
- Commit format: `fix:`, `feat:`, `chore:`, `docs:`
- Backend changes auto-deploy via GitHub Actions

---

## Key Design Decisions (never change without discussion)

| Decision | Rationale |
|---|---|
| Session auth, not JWT | Server-side revocation for single-device enforcement |
| Single-device enforcement via `DeviceSession` | Shared-device households in rural schools |
| `RelaxedManifestStaticFilesStorage` | Prevents admin crashes on `django-unfold` updates between deploys |
| `manifest_strict=False` | Same as above |
| `max_requests=500` on gunicorn | Prevents memory leak from boto3/analytics operations |
| Batch course progress `/courses/progress/batch/` | Prevents N+1 on student dashboard (12 calls → 1) |
| AI fallback chain (Groq→Together→Gemini) | Free tier reliability; any single provider can fail |
| Redis rate limiting (not `sleep()`) | `sleep()` blocks gthread workers |
| QStash for cron (not Celery Beat) | No extra process; Oracle VM is memory-constrained |
| Derived course progress (not stored) | Eliminates stale data bugs |
| Ledger-based gamification (PointEvent) | Double-awarding is architecturally impossible |
| Join-code registration | Users cannot choose their own role |
| Explicit `scope_queryset()` | ORM-level data isolation; no leakage between roles |

---

## API Conventions

- **Base path:** `/api/v1/`
- **Auth:** Session cookie (`credentials: include`) + CSRF token (`X-CSRFToken` header)
- **Errors:** `{"detail": "..."}` with appropriate HTTP status
- **Lists:** Return arrays directly (not `{"results": [...]}`)
- **Pagination:** Not implemented globally — add only when needed
- **Batch endpoints:** Use `?ids=1,2,3` query param pattern

---

## CI/CD Flow

```
git push origin master (backend/ changes)
        ↓
GitHub Actions: lint (python manage.py check)
        ↓
SSH: git pull → pip install → migrate → collectstatic
        ↓
systemctl reload gyangrit (zero-downtime)
        ↓
3x health check (http://127.0.0.1:8000/api/v1/health/)
        ↓
FAIL → git reset --hard $PREV_SHA + systemctl restart
```

---

## Cron Jobs (QStash)

| Endpoint | Schedule | Purpose |
|---|---|---|
| `/api/v1/health/` | Every 5 min | Keep-alive |
| `/api/v1/analytics/nightly-recompute/` | Daily 2 AM UTC | Student risk recompute |

Auth: `Authorization: Bearer <QSTASH_TOKEN>` header verified by backend.

---

## Sentry

- **Project:** `bronze-garden`
- **42 errors tracked, all resolved** (see `SENTRY_ERRORS.md`)
- **Stale issues** (Render-era): bulk-resolve in Sentry dashboard
- **BRONZE-T** (DisallowedHost 0.0.0.0 from bots): suppress in Sentry inbound filters

---

## Oracle Server Quick Reference

```bash
# SSH
ssh -i ~/Downloads/ssh-key-2026-03-26.key ubuntu@161.118.168.247

# Logs
sudo journalctl -u gyangrit -f

# Reload (zero-downtime)
sudo systemctl reload gyangrit

# App path
/opt/gyangrit/

# Env file
/opt/gyangrit/backend/.env

# Venv
/opt/gyangrit/backend/venv/
```

---

## Frontend Structure

```
frontend/src/
├── auth/       AuthContext, ProtectedRoute, role types
├── components/ TopBar, BottomNav, Sidebar, NotificationPanel
├── pages/      50 pages (lazy-loaded)
├── services/   api.ts + 23 domain service files
├── utils/      slugs.ts, date helpers
└── app/        router.tsx (95+ routes)
```

Key services: `content.ts`, `analytics.ts`, `assessments.ts`, `livesessions.ts`, `notifications.ts`, `gamification.ts`, `courseProgress.ts`


---

## Documents to Read for Context

| Document | When to read |
|---|---|
| `docs/SYSTEM_ARCHITECTURE_AND_DESIGN_DOCUMENTATION.md` | Any architectural question |
| `docs/API_AND_FRONTEND_END_POINTS.md` | Adding or modifying any endpoint |
| `docs/ORACLE_DEPLOYMENT.md` | Any deployment or infra question |
| `docs/DOMAIN_AND_SERVICES.md` | Any external service or env var question |
| `docs/DATA_MODEL.md` | Any model or database question |
| `docs/SIGNAL_CHAIN.md` | Any signal, enrollment, or gamification question |
| `SENTRY_ERRORS.md` | Any error investigation |
| `FUTURE_TASKS.md` | Planning next sprint |

---

## What NOT to do

- ❌ Do not use `render.com` — it is decommissioned
- ❌ Do not use `gyangrit.onrender.com` — dead URL
- ❌ Do not use Tailwind CSS
- ❌ Do not add JWT auth — session-based only
- ❌ Do not use SQLite — PostgreSQL only
- ❌ Do not use `sleep()` in views — use Redis or async
- ❌ Do not import views across apps — use model relationships
- ❌ Do not add Celery — use QStash for async/cron tasks
- ❌ Do not hardcode API URLs in frontend — always relative paths via `api.ts`
