# GyanGrit

GyanGrit is an education-focused SaaS platform designed to deliver structured learning content through a modern, scalable web architecture.

The long-term goal is to support offline-first learning, government-curated content delivery, and administrative oversight.  
This repository currently contains the **foundational architecture and integration setup**.

---

## Repository Structure

```
GyanGrit/
├── backend/     # Django + DRF backend (API, admin, business logic)
├── frontend/    # React frontend (student-facing UI)
├── docs/        # Architecture, API, and planning documentation
├── infra/       # Infrastructure and deployment-related files
├── scripts/     # Utility and maintenance scripts
└── README.md
```

---

## Tech Stack

### Backend
- Python
- Django
- Django REST Framework
- SQLite (development)
- CORS configured for frontend integration

### Frontend
- React
- Vite
- TypeScript
- Fetch-based API layer

---

## Current Status

### Implemented
- Clean backend–frontend separation
- Django settings split (`base`, `dev`, `prod`)
- React app scaffolded with domain-ready structure
- Backend health API (`/api/health/`)
- Frontend ↔ backend integration verified
- CORS correctly configured for development

### Not Implemented Yet
- Authentication
- Database-backed domain models
- Role-based access (student/teacher/admin)
- Offline/PWA features
- Media streaming
- Analytics
- Deployment automation

---

## Running the Project (Development)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements/dev.txt
python manage.py runserver
```

Backend runs at:
```
http://127.0.0.1:8000
```

Health check:
```
http://127.0.0.1:8000/api/health/
```

---

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:
```
http://localhost:5173 (or next available port)
```

---

## Development Philosophy

- API-first backend
- Frontend and backend deployed independently
- Django templates reserved for admin/internal use only
- Clear separation of concerns
- Avoid premature optimization

---

## Roadmap (High-Level)

1. Static domain APIs (courses, lessons)
2. Database-backed models and migrations
3. Authentication and role management
4. Offline-first frontend (PWA)
5. Content delivery and analytics
6. Deployment and scaling

---

## Notes

This README reflects the **current state of the project** and will evolve as the platform matures.
