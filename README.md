# GyanGrit

A role-based digital learning platform for rural government schools in Punjab, India.

---

## Production URLs

| Service | URL |
|---|---|
| Frontend | https://www.gyangrit.site |
| Backend API | https://api.gyangrit.site/api/v1/ |
| Admin Panel | https://api.gyangrit.site/admin/ |
| Health Check | https://api.gyangrit.site/api/v1/health/ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Backend | Django 4.2 + Python 3.12 |
| Database | PostgreSQL via Supabase (shared dev/prod) |
| Auth | Django session-based, single-device enforcement |
| API | REST under `/api/v1/` |
| Cache / Sessions | Upstash Redis (serverless, Mumbai region) |
| Cron Jobs | Upstash QStash (health check + nightly analytics) |
| Real-time Chat | Ably WebSocket |
| Live Classes | LiveKit Cloud (WebRTC, Mumbai region) |
| Recordings | LiveKit Egress → Cloudflare R2 |
| AI Tutor | Bay of Assets Claude Haiku (primary) → Groq → Together → Gemini |
| Push Notifications | pywebpush + VAPID |
| SMS OTP | Fast2SMS (India) |
| Email | Zoho Mail SMTP (`noreply@gyangrit.site`) |
| Media Storage | Cloudflare R2 |
| Frontend Deploy | Vercel |
| Backend Deploy | Oracle Cloud Mumbai (A1 ARM64 VM) |
| CI/CD | GitHub Actions (lint → deploy → rollback) |
| Error Tracking | Sentry |
| Styling | Custom CSS design system (Obsidian glassmorphism v3) |

---

## Architecture

```
Browser (React SPA + PWA)
        │
        │  HTTPS + Session Cookie + CSRF Token
        ▼
  REST API  /api/v1/
        │
        ▼
  Django Backend (18 modular apps)
  ┌──────────────────────────────────────────────────────────────┐
  │  accounts       users, auth, OTP, join codes, sessions       │
  │  academics      districts, schools, subjects, assignments    │
  │  accesscontrol  role decorators, queryset scoping            │
  │  content        courses, lessons, section lessons, progress  │
  │  learning       enrollments, learning paths                  │
  │  assessments    quizzes, scoring, attempts, AI generator     │
  │  roster         bulk student pre-registration (Excel)        │
  │  gamification   points, badges, streaks, leaderboard         │
  │  notifications  in-app + browser push notifications          │
  │  media          Cloudflare R2 presigned URL management       │
  │  ai_assistant   Groq/Together/Gemini AI tutor                │
  │  chatrooms      real-time chat via Ably                      │
  │  competitions   live quiz competition rooms                  │
  │  flashcards     spaced-repetition study decks (SM-2)         │
  │  gradebook      term-based marks & class grading             │
  │  livesessions   LiveKit WebRTC live classes + recording      │
  │  analytics      student risk scoring + engagement tracking   │
  └──────────────────────────────────────────────────────────────┘
        │
        ├── PostgreSQL (Supabase)
        ├── Redis (Upstash — sessions, rate limiting, caching)
        └── R2 (Cloudflare — media, recordings)
```

---

## Roles

| Role | Access Scope | Login |
|---|---|---|
| STUDENT | Own courses, lessons, assessments, leaderboard | Password only |
| TEACHER | Class analytics, roster, lesson/assessment builder, AI tools | Password + OTP |
| PRINCIPAL | Institution overview, teacher list, AI tools | Password + OTP |
| OFFICIAL | District-level analytics dashboard | Password + OTP |
| ADMIN | Full system, Django admin | Password only |

Registration is join-code-based. Admins generate time-limited codes that lock the user's role, institution, and section on signup. Users cannot choose their own role.

---

## Running Locally

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements/dev.txt
python manage.py migrate
python manage.py seed_punjab
python manage.py runserver
```

Runs at `http://127.0.0.1:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`

### Minimum `.env` for local dev

Create `backend/.env`:

```env
SECRET_KEY=any-long-random-string
DATABASE_URL=postgres://user:password@host:port/dbname?sslmode=require
DJANGO_SETTINGS_MODULE=gyangrit.settings.dev
```

---

## Repository Structure

```
GyanGrit/
├── backend/
│   ├── apps/
│   │   ├── accounts/        user model, auth, OTP, join codes, sessions
│   │   ├── academics/       districts, schools, classrooms, subjects
│   │   ├── accesscontrol/   permission decorators, queryset scoping
│   │   ├── content/         courses, lessons, section lessons, progress
│   │   ├── learning/        enrollments, learning paths
│   │   ├── assessments/     quizzes, scoring, attempt history, AI generator
│   │   ├── roster/          Excel-based bulk student registration
│   │   ├── gamification/    points, badges, streaks, leaderboard
│   │   ├── notifications/   in-app + push notification delivery
│   │   ├── media/           Cloudflare R2 presigned URL management
│   │   ├── ai_assistant/    Groq/Together/Gemini AI curriculum tutor
│   │   ├── chatrooms/       real-time messaging via Ably
│   │   ├── competitions/    live quiz competition rooms
│   │   ├── flashcards/      spaced-repetition study decks (SM-2)
│   │   ├── gradebook/       term-based marks & grading
│   │   ├── livesessions/    LiveKit WebRTC live classes + recording
│   │   └── analytics/       student risk scoring + engagement tracking
│   ├── gyangrit/
│   │   ├── settings/        base.py · dev.py · prod.py
│   │   └── storage.py       RelaxedManifestStaticFilesStorage
│   ├── gunicorn.conf.py     5 gthread workers, max_requests=500
│   └── requirements/        base.txt · dev.txt · prod.txt
├── frontend/
│   └── src/
│       ├── auth/            AuthContext, role guards, types
│       ├── components/      TopBar, BottomNav, Sidebar, NotificationPanel
│       ├── pages/           50 route pages
│       ├── services/        23 API service files + api.ts
│       └── app/             router.tsx
├── docs/                    Architecture, API, data model, deployment docs
├── .github/workflows/       deploy.yml (lint → deploy → rollback → health check)
├── SENTRY_ERRORS.md         42 error log — all resolved
└── FUTURE_TASKS.md          Next sprints and roadmap
```

---

## CI/CD Pipeline

Every `git push origin master` (touching `backend/`):

1. **Lint** — `python manage.py check --fail-level WARNING` on Ubuntu runner
2. **Deploy** — SSH into Oracle, git pull, pip install, migrate, collectstatic
3. **Graceful reload** — `systemctl reload gyangrit` (zero-downtime)
4. **Health check** — 3 attempts × 5s against `http://127.0.0.1:8000/api/v1/health/`
5. **Rollback** — Auto `git reset --hard $PREV_SHA` + restart if health check fails

---

## Cron Jobs (QStash)

| Schedule | Endpoint | Purpose |
|---|---|---|
| Every 5 min | `/api/v1/health/` | Keep-alive ping |
| Daily 2:00 AM UTC | `/api/v1/analytics/nightly-recompute/` | Recompute student risk scores + teacher alerts |

---

## Documentation

| Document | Description |
|---|---|
| [API & Endpoints](docs/API_AND_FRONTEND_END_POINTS.md) | Full API reference — all 18 apps, request/response shapes, role restrictions |
| [Architecture](docs/SYSTEM_ARCHITECTURE_AND_DESIGN_DOCUMENTATION.md) | System design, models, data scoping, security, frontend structure |
| [Data Model](docs/DATA_MODEL.md) | Every model, field, constraint, and the design decision behind each |
| [Learning Loop](docs/LEARNING_LOOP.md) | Content loop, assessment loop, and learning path flow |
| [Signal Chain](docs/SIGNAL_CHAIN.md) | Auto-enrollment, scoring, and gamification signal architecture |
| [Gamification](docs/GAMIFICATION.md) | Points, streaks, badges, leaderboard scoping, frontend integration |
| [Oracle Deployment](docs/ORACLE_DEPLOYMENT.md) | Full Oracle Cloud VM setup — Nginx, gunicorn, systemd, SSL |
| [Domain & Services](docs/DOMAIN_AND_SERVICES.md) | DNS, email, external API service map |

---

## Key Design Decisions

**Session-based auth** — Server-side revocation is essential for single-device enforcement. JWT cannot be invalidated without a blocklist.

**Single-device enforcement** — `SingleActiveSessionMiddleware` compares the current session key against `DeviceSession` on every request. New login terminates the old session.

**Signal-driven enrollment** — Student registration auto-assigns subjects and course enrollments via Django signals. No manual setup per student.

**Derived progress** — Course completion % is computed at request time from lesson completion records. Never stored as a separate field.

**Ledger-based gamification** — Points are immutable `PointEvent` records, aggregated into `StudentPoints`. Double-awarding is architecturally impossible.

**Join-code registration** — Users cannot choose their own role. Codes encode role + institution + section and are time-limited.

**Explicit queryset scoping** — All list endpoints filter through `scope_queryset()`. Role-based ORM filters applied via an explicit map. No data leakage.

**RelaxedManifestStaticFilesStorage** — Custom WhiteNoise subclass with `manifest_strict=False`. Prevents admin 500 crashes when `django-unfold` ships new static files between deploys.

**Batch course progress** — Dashboard fetches all course progress in 2 DB queries via `/courses/progress/batch/` instead of N individual requests.

**AI provider chain** — Groq (30 req/min free) → Together AI ($25 free credit) → Gemini (final fallback). Redis rate limiting prevents one user exhausting shared quota.

---

## Academic Context

Capstone project — B.Tech Computer Science, Lovely Professional University, 2026.

Built to address the digital education divide in rural Punjab:
- Government-curated content delivery
- District-level administrative oversight  
- Single-device policy for shared-device households
- Gamification to sustain student engagement
- PWA with offline content download and push notifications
- Predictive student risk analytics with teacher alerts
