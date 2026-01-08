# GyanGrit – System Architecture & Design Documentation

## Document Name
**GyanGrit_System_Architecture_and_Design.md**

---

## 1. Introduction

**GyanGrit** is a role-based digital learning platform designed to deliver structured educational content, track learner progress, and provide analytics for educators and officials.

The system is implemented as a **modular web application** using Django for the backend and React for the frontend, following clean architectural boundaries suitable for a **B.Tech capstone project**.

---

## 2. High-Level Architecture

### 2.1 Architecture Overview

GyanGrit follows a **client–server architecture**:

- **Frontend**: React (Vite)
- **Backend**: Django
- **Database**: SQLite (development)
- **Authentication**: Session-based
- **API Versioning**: `/api/v1/`


Browser (React)
↓
REST API (/api/v1)
↓
Django Backend
↓
Database
---
## 3. Backend Architecture

### 3.1 Modular App Design

The backend is divided into independent Django apps:

| App Name | Responsibility                         |
|----------|----------------------------------------|
| accounts | Authentication, users, roles           |
| content  | Courses, lessons, lesson progress      |
| learning | Enrollments, learning paths, analytics |

This structure avoids tight coupling and enables independent evolution of features.

---

### 3.2 Accounts App

**Purpose**
- User management
- Authentication
- Role-based access control

**Key Features**
- Custom `User` model
- Role hierarchy:
```

ADMIN > OFFICIAL > TEACHER > STUDENT

```
- Session-based login/logout
- Identity endpoint: `/api/v1/accounts/me/`

**Design Choice**
Session authentication is chosen for simplicity, security, and suitability for academic environments.

---

### 3.3 Content App

**Purpose**
- Owns all learning content
- Acts as the single source of truth for progress

**Core Models**
- Course
- Lesson
- LessonProgress

**Key Design Decisions**
- Lessons are ordered per course
- Lesson progress is tracked per user
- Course progress is **derived**, not stored

**Why derived progress?**
- Prevents inconsistent data
- Eliminates redundant updates
- Simplifies schema and logic

---

### 3.4 Learning App

**Purpose**
- Manages enrollment and curriculum structure
- Provides analytics and learning paths

**Core Models**
- Enrollment
- LearningPath
- LearningPathCourse

**Responsibilities**
- Enroll learners into courses
- Define learning paths
- Compute learning path progress dynamically
- Provide teacher-level analytics

**Important Rule**
The learning app never stores lesson progress; it only consumes data from the content app.

---

## 4. Frontend Architecture

### 4.1 Routing Structure

The frontend uses React Router with explicit role-based guards.

| Route          | Role     | Purpose           |
|----------------|----------|-------------------|
| `/`            | STUDENT  | Student dashboard |
| `/courses`     | All      | Course listing    |
| `/courses/:id` | Enrolled | Course lessons    |
| `/lessons/:id` | Enrolled | Lesson view       |
| `/learning`    | STUDENT  | Learning paths    |
| `/teacher`     | TEACHER+ | Teacher analytics |
| `/login`       | Public   | Login             |
| `/register`    | Public   | Registration      |

---

### 4.2 Role Enforcement

Role-based access is enforced using:
- `AuthContext`
- `RequireRole` wrapper
- Explicit role hierarchy comparison

This ensures unauthorized users cannot access restricted UI routes.

---

### 4.3 API Access Layer

All API calls are centralized in:

```

services/api.ts

```

**Rules**
- No direct `fetch()` usage elsewhere
- All calls relative to `/api/v1`
- Session cookies included
- CSRF-safe POST/PATCH helpers

This guarantees consistency and maintainability.

---

## 5. Data Flow Design

### 5.1 Lesson Completion Flow

```

Student
→ Lesson Page
→ PATCH /lessons/{id}/progress/
→ LessonProgress updated
→ Course progress derived dynamically

```

No course-level progress table exists.

---

### 5.2 Learning Path Progress Flow

```

LearningPath
→ Courses in path
→ Enrollments
→ Completed enrollments counted
→ Progress percentage derived

```

Progress is computed at request time.

---

## 6. Security Considerations

- Django session authentication
- CSRF protection enabled
- CORS restricted to frontend origins
- Role validation on frontend and backend

This is sufficient and appropriate for a capstone project.

---

## 7. Scalability & Extensibility

The architecture supports:
- API version upgrades
- Database migration
- Adding assessments later
- Introducing token-based auth without breaking APIs

---

## 8. Design Principles Followed

- Separation of concerns
- Single source of truth
- Derived data over stored aggregates
- Idempotent APIs
- Explicit role enforcement
- Minimal but complete feature set

---

## 9. Conclusion

GyanGrit demonstrates a clean, modular, and scalable architecture suitable for an academic capstone project.  
It showcases proper backend design, role-based access control, progress tracking, and frontend–backend integration.

The system is **stable, extensible, and submission-ready**.

---

**End of Document**
