# GyanGrit

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-4.2-092E20?style=flat&logo=django&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=flat&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-Academic-lightgrey?style=flat)

**Empowering rural students, one lesson at a time.**

A role-based digital learning platform for government schools in Punjab, India.
Built for low-bandwidth environments and shared devices, GyanGrit delivers
government-curated content with session-controlled access, teacher dashboards,
district-level analytics, and a gamification layer to keep students engaged.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| Backend | Django 4.2, Python 3.11+ |
| Database | PostgreSQL via Supabase (all environments) |
| Auth | Django session-based with single-device enforcement |
| API | REST, versioned under `/api/v1/` |
| Styling | Custom CSS design system — no UI library |

---

## Architecture

```
Browser (React SPA)
        │
        │  HTTPS + Session Cookie + CSRF Token
        ▼
  REST API  /api/v1/
        │
        ▼
  Django Backend
  ┌──────────────────────────────────────────────────────────┐
  │  accounts       users, auth, OTP, join codes             │
  │  academics      districts, schools, subjects             │
  │  accesscontrol  role decorators, queryset scoping        │
  │  content        courses, lessons, section lessons        │
  │  learning       enrollments, learning paths              │
  │  assessments    quizzes, scoring, attempts               │
  │  roster         bulk student pre-registration            │
  │  gamification   points, badges, streaks, leaderboard     │
  │  notifications  in-app + push notifications              │
  │  media          Cloudflare R2 media management           │
  │  ai_assistant   Gemini-powered curriculum tutor          │
  │  chatrooms      real-time chat via Ably                  │
  │  competitions   live quiz competition rooms              │
  │  flashcards     spaced-repetition flashcard decks        │
  │  gradebook      term-based marks & grading               │
  │  livesessions   LiveKit WebRTC live classes              │
  └──────────────────────────────────────────────────────────┘
        │
        ▼
  PostgreSQL (Supabase)
```

---

## Roles

| Role | Access Scope | Login |
|---|---|---|
| STUDENT | Own courses, lessons, assessments, leaderboard | Password only |
| TEACHER | Class analytics, roster upload, lesson/assessment builder | Password + OTP |
| PRINCIPAL | Institution overview, teacher list, lesson/assessment builder | Password + OTP |
| OFFICIAL | District-level analytics | Password + OTP |
| ADMIN | Full system | Password only |

Registration is join-code-based. Admins generate time-limited codes that lock
the user's role, institution, and section — users cannot choose their own role.

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

### Environment

Create `backend/.env`:

```env
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgres://user:password@host:port/dbname?sslmode=require
```

`DATABASE_URL` is required in all environments — no SQLite fallback in production.

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
│   │   ├── assessments/     quizzes, scoring, attempt history, builder
│   │   ├── roster/          Excel-based bulk student registration
│   │   ├── gamification/    points, badges, streaks, leaderboard
│   │   ├── notifications/   in-app + push notification delivery
│   │   ├── media/           Cloudflare R2 presigned URL management
│   │   ├── ai_assistant/    Gemini-powered AI curriculum tutor
│   │   ├── chatrooms/       real-time messaging via Ably
│   │   ├── competitions/    live quiz competition rooms
│   │   ├── flashcards/      spaced-repetition study decks
│   │   ├── gradebook/       term-based marks & grading
│   │   └── livesessions/    LiveKit WebRTC live classes
│   ├── gyangrit/
│   │   └── settings/        base.py · dev.py · prod.py
│   └── requirements/        base.txt · dev.txt · prod.txt
├── frontend/
│   └── src/
│       ├── auth/            AuthContext, role guards, types
│       ├── components/      TopBar, BottomNav, LessonItem, NotificationPanel, LogoutButton
│       ├── pages/           one file per route (38 pages)
│       ├── services/        api.ts and per-domain service files (19 files)
│       └── app/             router.tsx
└── docs/
    ├── API_AND_FRONTEND_END_POINTS.md
    ├── SYSTEM_ARCHITECTURE_AND_DESIGN_DOCUMENTATION.md
    ├── DATA_MODEL.md
    ├── LEARNING_LOOP.md
    ├── SIGNAL_CHAIN.md
    ├── GAMIFICATION.md
    └── DEPLOYMENT.md
```

---

## Documentation

| Document | Description |
|---|---|
| [API & Endpoints](docs/API_AND_FRONTEND_END_POINTS.md) | Full API reference — all 17 apps, request/response shapes, role restrictions |
| [Architecture](docs/SYSTEM_ARCHITECTURE_AND_DESIGN_DOCUMENTATION.md) | System design, models, data scoping, security, frontend structure |
| [Data Model](docs/DATA_MODEL.md) | Every model, field, constraint, and the design decision behind each |
| [Learning Loop](docs/LEARNING_LOOP.md) | Content loop, assessment loop, and learning path flow |
| [Signal Chain](docs/SIGNAL_CHAIN.md) | Auto-enrollment, assessment scoring, and gamification signal architecture |
| [Gamification](docs/GAMIFICATION.md) | Points, streaks, badges, leaderboard scoping, and frontend integration |
| [Deployment](docs/DEPLOYMENT.md) | Production setup, environment config, whitenoise, database backup |

---

## Key Design Decisions

**Session-based auth** over JWT — server-side session revocation is essential for
single-device enforcement. A revoked JWT cannot be invalidated without a blocklist.

**Single-device enforcement** — `SingleActiveSessionMiddleware` compares the current
session key against the stored `DeviceSession` on every request. A new login from another
device terminates the previous session immediately.

**Signal-driven enrollment** — When a student registers, subjects and course enrollments
are assigned automatically via Django signals. No manual setup required per student.

**Derived progress** — Course completion percentage is computed at request time from
lesson completion counts. Never stored as a separate field. Eliminates inconsistency.

**Join-code registration** — Users cannot self-select their role. Time-limited codes
encode role, institution, section, and subject. The frontend previews this before submission.

**Explicit queryset scoping** — All list endpoints filter through `scope_queryset()`,
which applies role-based ORM filters via an explicit traversal map. No data leakage
through missed conditions.

**Ledger-based gamification** — Points are stored as immutable `PointEvent` records before
being aggregated into a `StudentPoints` total. This makes double-awarding architecturally
impossible and gives a full audit trail. Gamification signals never block core learning flows.

**Supabase PostgreSQL everywhere** — Both development and production use PostgreSQL via
Supabase. SQLite is not used in any environment. This eliminates the class of bugs that
only appear when switching databases before deployment.

---

## Academic Context

Capstone project — B.Tech Computer Science, Lovely Professional University, 2026.

Built to address the digital education divide in rural Punjab:
- Government-curated content delivery
- District-level administrative oversight
- Single-device policy for shared-device households
- Gamification to maintain student engagement
- PWA with offline content download and push notifications
