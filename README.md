# GyanGrit

**Empowering rural students, one lesson at a time.**

A role-based digital learning platform for government schools in Punjab, India. Built for low-bandwidth environments and shared devices, GyanGrit delivers government-curated content with session-controlled access, teacher dashboards, and district-level analytics.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| Backend | Django, Python 3.11+ |
| Database | PostgreSQL (Supabase) / SQLite (dev) |
| Auth | Django session-based, single-device enforcement |
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
  ┌─────────────────────────────────────────────────┐
  │  accounts      users, auth, OTP, join codes     │
  │  academics     districts, schools, subjects      │
  │  accesscontrol role decorators, query scoping   │
  │  content       courses, lessons, progress        │
  │  learning      enrollments, learning paths       │
  │  assessments   quizzes, scoring, attempts        │
  │  roster        bulk student pre-registration     │
  └─────────────────────────────────────────────────┘
        │
        ▼
  PostgreSQL
```

---

## Roles

| Role | Access Scope | Login |
|---|---|---|
| STUDENT | Own courses, lessons, assessments | Password only |
| TEACHER | Class analytics, roster management | Password + OTP |
| PRINCIPAL | Institution overview | Password + OTP |
| OFFICIAL | District-level analytics | Password + OTP |
| ADMIN | Full system | Password only |

Registration is join-code-based. Admins generate time-limited codes that lock the user's role, institution, and section — users cannot choose their own role.

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

Leave `DATABASE_URL` unset to use SQLite in development.

---

## Repository Structure

```
GyanGrit/
├── backend/
│   ├── apps/
│   │   ├── accounts/        user model, auth, OTP, join codes, sessions
│   │   ├── academics/       districts, schools, classrooms, subjects
│   │   ├── accesscontrol/   permission decorators, queryset scoping
│   │   ├── content/         courses, lessons, progress tracking
│   │   ├── learning/        enrollments, learning paths
│   │   ├── assessments/     quizzes, scoring, attempt history
│   │   └── roster/          Excel-based bulk student registration
│   ├── gyangrit/
│   │   └── settings/        base.py, dev.py, prod.py
│   └── manage.py
├── frontend/
│   └── src/
│       ├── auth/            AuthContext, role guards, types
│       ├── components/      TopBar, LessonItem, LogoutButton
│       ├── pages/           one file per route (20 pages)
│       ├── services/        api.ts and per-domain service files
│       └── app/             router.tsx
└── docs/
    ├── API_AND_FRONTEND_END_POINTS.md
    ├── SYSTEM_ARCHITECTURE_AND_DESIGN_DOCUMENTATION.md
    ├── LEARNING_LOOP.md
    ├── SIGNAL_CHAIN.md
    └── DEPLOYMENT.md
```

---

## Documentation

| Document | Description |
|---|---|
| [API & Endpoints](docs/API_AND_FRONTEND_END_POINTS.md) | Full API reference — all 7 apps, request/response shapes, role restrictions |
| [Architecture](docs/SYSTEM_ARCHITECTURE_AND_DESIGN_DOCUMENTATION.md) | System design, models, data scoping, security, frontend structure |
| [Learning Loop](docs/LEARNING_LOOP.md) | How the content loop, assessment loop, and learning paths connect |
| [Signal Chain](docs/SIGNAL_CHAIN.md) | Auto-enrollment and auto-assignment signal architecture |
| [Deployment](docs/DEPLOYMENT.md) | Production setup, environment config, database backup |

---

## License

Academic capstone project — Lovely Professional University, 2026.
