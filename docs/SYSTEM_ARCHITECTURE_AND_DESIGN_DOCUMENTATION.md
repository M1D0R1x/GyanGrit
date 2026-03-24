# GyanGrit — System Architecture & Design Documentation

> **Updated: 2026-03-26** — 16 backend apps, 41 frontend pages, fully operational.
> Live at: https://gyan-grit.vercel.app (frontend) | https://gyangrit.onrender.com (backend)

---

## 1. Introduction

GyanGrit is a role-based digital learning platform for rural government schools in Punjab, India. It delivers structured educational content, tracks learner progress, provides real-time communication, AI-assisted doubt clearance, live video classes, spaced-repetition flashcards, and gamified competition — all on a zero-cost production stack.

**Stack:**
- **Backend:** Django 4.2 + Python 3.11 · PostgreSQL (Supabase) · gunicorn + gevent
- **Frontend:** React 18 + Vite + TypeScript · Custom CSS design system
- **Real-time:** Ably (chat, competitions, push notifications)
- **Live video:** LiveKit Cloud (WebRTC SFU)
- **AI:** Gemini 1.5 Flash (RAG-based curriculum chatbot)
- **Media:** Cloudflare R2 (videos, PDFs, attachments)
- **Auth:** Django session-based · single-device enforcement

---

## 2. High-Level Architecture

```
Student/Teacher/Admin Browser
        │
        ├── HTTPS (session cookie + CSRF token)
        │         ↓
        │    Vercel CDN (React SPA, Mumbai edge)
        │         ↓
        │    REST API /api/v1/ (Render, Singapore)
        │         ↓
        │    Django 16 apps + gunicorn/gevent
        │         ↓
        │    PostgreSQL via Supabase pgBouncer (Mumbai)
        │
        ├── WebSocket (Ably — chat, competitions, notifications)
        │
        ├── WebRTC (LiveKit Cloud — live video classes)
        │
        └── CDN (Cloudflare R2 — videos, PDFs, file uploads)
```

The frontend and backend are deployed independently. The frontend is a fully client-side SPA that communicates exclusively through the versioned REST API. Django templates are used only for the admin panel (django-unfold theme).

---

## 3. Backend Architecture

### 3.1 App Structure — 16 Django Apps

| App | Responsibility |
|---|---|
| `accounts` | Users, authentication, OTP, join codes, device sessions, profile |
| `academics` | Districts, institutions, classrooms, sections, subjects, teaching assignments |
| `accesscontrol` | Role-based permission decorators and queryset scoping (no models, no endpoints) |
| `content` | Courses, lessons, section lessons, lesson progress, teacher analytics |
| `learning` | Enrollments, learning paths, student dashboard |
| `assessments` | Assessments, questions, options, attempts, scoring, assessment builder |
| `roster` | Bulk student pre-registration via Excel upload |
| `gamification` | Points ledger, badges, streaks, class/school leaderboard |
| `notifications` | Broadcasts, per-recipient notifications, read-status, audience targeting |
| `media` | Cloudflare R2 media management (presigned upload/delete URLs) |
| `gradebook` | Manual marks (oral, practical, project, paper-based) per student/subject/term |
| `competitions` | Real-time quiz competition rooms via Ably Pub/Sub |
| `chatrooms` | Subject/staff/officials chat rooms · ChatRoomMember · push notifications |
| `flashcards` | Spaced-repetition flashcard decks · SM-2 algorithm · FlashcardProgress |
| `livesessions` | LiveKit WebRTC live classes · attendance tracking |
| `ai_assistant` | Gemini 1.5 Flash chatbot · curriculum RAG · multi-turn conversations |

Each app owns its domain completely. Cross-app access goes through model relationships and signals — never direct view imports.

---

### 3.2 Accounts App

**Models:** `User`, `JoinCode`, `OTPVerification`, `DeviceSession`, `StudentRegistrationRecord`, `AuditLog`

**Role hierarchy:** `STUDENT(1) < TEACHER(2) < PRINCIPAL(3) < OFFICIAL(4) < ADMIN(5)`

**Login flows:**
- STUDENT / ADMIN: direct session login, no OTP
- TEACHER / PRINCIPAL / OFFICIAL: OTP verification required (6-digit, 5-attempt limit, 10-minute expiry, generated via `secrets.randbelow()`)

**OTP delivery:**
- Primary: Fast2SMS (₹0.15/SMS, Indian numbers)
- Fallback: Gmail SMTP when `mobile_primary` is empty

**Single-device enforcement:**
`SingleActiveSessionMiddleware` runs on every authenticated request. Compares current session key with stored `DeviceSession.device_fingerprint`. Mismatch → logout.

---

### 3.3 Chat Rooms App

**Room types:**
- `subject` — "Class 10A Computer Science" — teacher + enrolled students
- `staff` — "School Name — Staff" — all teachers + principal of institution
- `officials` — "Officials" — officials + principals + admin

**Key models:**
- `ChatRoom` — room metadata, FK to section/subject/institution
- `ChatRoomMember` — explicit membership (enables push notifications + member counts)
- `ChatMessage` — content, optional attachment, threading via `parent` FK

**Membership rules:** Rooms created lazily via signals:
- `TeachingAssignment.post_save` → create subject room, enroll teacher + existing students
- `User.post_save (STUDENT)` → enroll in existing rooms for their section only (never create rooms)

**Push notifications on send:**
- `_create_notification_records()` — persists `Notification` for each member (shows in bell)
- `_push_chat_notification()` — Ably REST publish to `notifications:{user_id}` for real-time badge

**Moderation:** ADMIN shown as "Chat Moderator" (name hidden), monitoring banner on all rooms.

---

### 3.4 Competitions App

**Models:** `CompetitionRoom`, `CompetitionParticipant`, `CompetitionAnswer`

**Status machine:** `draft → active → finished`

**Real-time via Ably REST HTTP API** (not SDK — Ably Python v3 is async-only, incompatible with sync Django):
- `room:started` → published when teacher clicks Start
- `room:scores` → published after every student answer (live leaderboard)
- `room:finished` → published with final standings

**Ably token endpoint:** `POST /api/v1/realtime/token/`
- STUDENT + `channel_type=competition` → `competition:{room_id}` capability (subscribe only)
- TEACHER → `competition:*` capability (publish + subscribe)
- Any user + `channel_type=chat` → `chat:{room_id}` for each membership + `notifications:{user_id}`

---

### 3.5 Flashcards App

**Models:** `FlashcardDeck`, `Flashcard`, `FlashcardProgress`

**SM-2 Algorithm** (same as Anki):
1. Student rates card 0-3 after seeing answer
2. Algorithm updates `interval`, `ease_factor`, `next_review`
3. Cards due today (`next_review <= today`) shown in study session
4. Maximum 20 cards per session; overdue sorted first

**Scoping:** Deck is visible to students in sections where a `TeachingAssignment` exists for the deck's subject.

---

### 3.6 Live Sessions App

**Models:** `LiveSession`, `LiveAttendance`

**Status machine:** `scheduled → live → ended`

**LiveKit JWT generation** via PyJWT (not LiveKit SDK — avoids deployment complexity):
```python
payload = {
    "iss": LIVEKIT_API_KEY,
    "sub": str(user.id),
    "video": {
        "room": room_name,
        "roomJoin": True,
        "canPublish": user.role in ("TEACHER", "PRINCIPAL", "ADMIN"),
        "canSubscribe": True,
    }
}
token = jwt.encode(payload, LIVEKIT_API_SECRET, algorithm="HS256")
```

**Attendance:** `LiveAttendance` row auto-created when student calls `POST /api/v1/live/sessions/:id/join/`.

**Ably notification:** When teacher starts session, all students in the section receive `session:started` on their `notifications:{user_id}` channel.

---

### 3.7 AI Assistant App

**Models:** `ChatConversation`, `AIChatMessage`

**RAG approach (no vector DB):**
1. Fetch course titles + lesson descriptions for student's enrolled subjects (max 3,000 chars)
2. Inject as system context into Gemini 1.5 Flash API call
3. Gemini answers using curriculum context, constrained to educational topics
4. Supports English, Hindi, Punjabi in same session
5. Conversations persisted per subject for teacher analytics

**Cost:** Free tier — 60 requests/minute, 1,500 requests/day.

---

### 3.8 Gamification App

All gamification is **signal-driven**. No gamification logic in views. All handlers wrapped in `try/except` — gamification failure never blocks a core action.

**Point deduplication:** `PointEvent` ledger check before every award. Re-completing a lesson or re-running a signal never causes double-awarding.

**Leaderboard:** Denormalized via `StudentPoints` — never sums the full ledger per request.

---

## 4. Production Infrastructure

### 4.1 Deployment Stack

| Layer | Platform | Region | Cost |
|---|---|---|---|
| Frontend | Vercel (free) | Mumbai edge | ₹0 |
| Backend | Render (free) | Singapore | ₹0 |
| Database | Supabase (free) | Mumbai | ₹0 |
| Real-time | Ably (free, 100 connections) | Global | ₹0 |
| Live video | LiveKit Cloud (free, 5k min/mo) | Global | ₹0 |
| AI | Gemini API (free, 1.5k req/day) | Global | ₹0 |
| Media | Cloudflare R2 (free 10GB/mo) | Global | ₹0 |

**Total production cost: ₹0/month** for capstone-scale usage.

### 4.2 Gunicorn Configuration

**Worker class: gevent** (not sync) — handles 50 concurrent users on Render free 512MB RAM.

**Critical:** `CONN_MAX_AGE=0` in prod settings. Persistent DB connections are incompatible with gevent green threads — causes `DatabaseWrapper thread-sharing` errors.

```python
# gunicorn.conf.py
worker_class       = "gevent"
workers            = 1
worker_connections = 100  # 100 concurrent connections per worker

def post_fork(server, worker):
    from django.db import connections
    for conn in connections.all():
        conn.close()  # fresh connection per green thread
```

### 4.3 Keep-alive

`AuthContext.tsx` pings `/api/v1/health/` every 10 minutes in production to prevent Render free tier cold starts (15-minute sleep threshold).

### 4.4 Required Environment Variables

```env
# Django
SECRET_KEY=
DATABASE_URL=postgresql://...?sslmode=require
ALLOWED_HOSTS=gyangrit.onrender.com
CORS_ALLOWED_ORIGINS=https://gyan-grit.vercel.app
DEBUG=False
DJANGO_SETTINGS_MODULE=gyangrit.settings.prod

# OTP delivery
FAST2SMS_API_KEY=
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=

# Real-time
ABLY_API_KEY=

# Live video
LIVEKIT_URL=wss://gyangrit-xxxx.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# AI
GEMINI_API_KEY=

# Media
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_ENDPOINT_URL=
```

---

## 5. Frontend Architecture

### 5.1 Stack

- **React 18** + Vite + TypeScript (strict mode)
- **Routing:** React Router v6 with lazy-loaded pages
- **Auth state:** `AuthContext` — wraps `useAuth()` hook, calls `/api/v1/accounts/me/` on mount
- **API calls:** All through `src/services/api.ts` — `apiGet`, `apiPost`, `apiPatch`, `apiDelete`
- **Styling:** Custom CSS design system in `src/index.css` (CSS custom properties only — no Tailwind, no CSS Modules, no external UI libraries)

### 5.2 Design System

All visual tokens in `src/index.css` (~1,600 lines):

```css
--role-student:   #3b82f6;  --role-teacher:   #10b981;
--role-principal: #f59e0b;  --role-official:  #8b5cf6;
--role-admin:     #ef4444;

--font-display:   "Sora", sans-serif;
--font-body:      "DM Sans", sans-serif;
```

**Rule:** Extend `src/index.css`, never replace it. All new components use existing variable names.

### 5.3 Pages — 41 Total

| Category | Pages |
|---|---|
| Auth | LoginPage, RegisterPage, VerifyOtpPage, CompleteProfilePage |
| Student | DashboardPage, CoursesPage, LessonsPage, LessonPage, AssessmentsPage, AssessmentPage, AssessmentTakePage, AssessmentResultPage, AssessmentHistoryPage, CourseAssessmentsPage, LearningPathsPage, LearningPathPage, ProfilePage, LeaderboardPage, ChatRoomPage, CompetitionRoomPage, **FlashcardsStudyPage**, **LiveSessionPage**, **AIChatPage** |
| Teacher | TeacherDashboardPage, TeacherClassDetailPage, TeacherStudentDetailPage, GradebookPage, **FlashcardDecksPage** |
| Staff shared | AdminLessonEditorPage, AdminAssessmentBuilderPage, UserManagementPage, AdminJoinCodesPage |
| Dashboards | PrincipalDashboardPage, OfficialDashboardPage, AdminDashboardPage, AdminContentPage, **AdminChatManagementPage** |
| Shared | NotificationsPage, SectionLessonPage |
| Errors | NotFoundPage, ForbiddenPage, ServerErrorPage, NetworkErrorPage, ErrorPage |

**Bold** = added in recent sessions.

### 5.4 Real-time Architecture (Frontend)

**Ably connection lifecycle:**
1. `AuthContext` connects to Ably on login using `channel_type=chat` token
2. Subscribes to `notifications:{user_id}` for cross-page push notifications
3. Dispatches `window.dispatchEvent("notif:new")` on receipt
4. `TopBar` listens for `notif:new` → immediately refreshes bell badge count
5. `ChatRoomPage` subscribes to `chat:{room_id}` for real-time messages
6. `CompetitionRoomPage` subscribes to `competition:{room_id}` for scores

**LiveKit connection lifecycle:**
1. Student/teacher calls `GET /api/v1/live/sessions/:id/token/`
2. Django generates JWT with `canPublish: true/false` based on role
3. Frontend connects `<LiveKitRoom>` component with the token
4. Teacher: full `<VideoConference>` UI with camera + mic
5. Student: subscriber-only with `<StudentVideoLayout>` grid

### 5.5 Route Protection

`<RequireRole role="X">` wraps every non-public page. Role rank is checked against `ROLE_RANK` map — insufficient rank shows `ForbiddenPage`. Not authenticated → redirect to `/login`.

### 5.6 Navigation

- **Students:** `BottomNav` (Home | Courses | Tests | Chat | Profile) + `NavMenu` dropdown
- **Staff:** `NavMenu` dropdown with all role-appropriate routes grouped by category
- **NavMenu groups:** Overview | Learning | Communication (Chat, Competitions, Live, Flashcards) | Content | Users

**⚠️ Note:** `NavMenu` is a supervisor demo nav pending replacement with a proper `SidebarDrawer`. See tasks.md for the post-capstone redesign plan.

---

## 6. Signal Architecture

See `docs/SIGNAL_CHAIN.md` for complete signal graph. New signals added:

| Signal | Sender | Effect |
|---|---|---|
| `post_save` | `TeachingAssignment` | Create chat subject room, enroll teacher + existing students |
| `post_save` | `User (STUDENT)` | Enroll in EXISTING chat rooms for their section (never create rooms) |
| `post_save` | `User (TEACHER)` | Enroll in staff chat room for their institution |
| `post_save` | `User (PRINCIPAL)` | Enroll in staff + officials chat rooms |
| `post_save` | `User (OFFICIAL)` | Enroll in officials chat room |

**Chat room creation rule:** Rooms are created ONLY by `TeachingAssignment.post_save`. Students never create rooms. This prevents phantom rooms (a previous bug where student registration triggered 12 empty subject rooms).

---

## 7. Data Scoping Architecture

Data visibility enforced at two layers:

**Layer 1 — View decorators** (`accesscontrol/permissions.py`)
Answers: "Can this user access this endpoint?"

**Layer 2 — Queryset scoping** (`accesscontrol/scoped_service.py`)
Answers: "What data can this user see?"

Chat rooms additionally scope by `ChatRoomMember` — access check is a single DB lookup:
```python
ChatRoomMember.objects.filter(room=room, user=user).exists()
```

Admin bypasses all room membership checks (can access any room by design).

---

## 8. Security

| Concern | Implementation |
|---|---|
| Authentication | Django session cookies (HttpOnly), named `gyangrit_sessionid` |
| CSRF | Custom cookie `gyangrit_csrftoken`, verified on all POST/PATCH/DELETE |
| Single device | `SingleActiveSessionMiddleware` + `DeviceSession` model |
| Role enforcement | `@require_roles()` on all protected views |
| Data scoping | `scope_queryset()` on all list endpoints + `ChatRoomMember` for chat |
| OTP brute force | 5-attempt limit, 10-minute expiry, `secrets.randbelow()` (cryptographically secure) |
| Correct answers | `is_correct` NEVER sent in any student-facing response (assessments + competitions) |
| Competition answers | `CompetitionAnswer.is_correct` never in student response |
| AI safety | Gemini system prompt blocks off-curriculum questions |
| LiveKit scoping | Students get `canPublish=False` token — cannot broadcast video |
| Ably scoping | Students' token capability scoped to their enrolled rooms only |
| Chat moderation | All rooms display monitoring banner; ADMIN shown as "Chat Moderator" |

---

## 9. Settings Structure

```
backend/gyangrit/settings/
├── base.py    — shared config, LIVEKIT_*, GEMINI_* env vars, django-unfold config
├── dev.py     — DEBUG=True, console email (OTP prints to terminal)
└── prod.py    — HTTPS flags, locked CORS, Supabase PostgreSQL, CONN_MAX_AGE=0
```

---

## 10. Database

**All environments:** PostgreSQL via Supabase.

**Critical production settings:**
- `CONN_MAX_AGE=0` — required with gevent workers (persistent connections cause thread-sharing errors)
- `DISABLE_SERVER_SIDE_CURSORS=True` — required for pgBouncer transaction-mode pooling
- `sslmode=require` on all connections

### Migration State (as of 2026-03-26)

| App | Latest Migration |
|---|---|
| accounts | 0004 |
| academics | 0002 |
| assessments | 0001 |
| chatrooms | 0001 |
| competitions | 0001 |
| content | 0003 |
| flashcards | 0001 |
| gamification | 0001 |
| gradebook | 0002 |
| learning | 0001 |
| livesessions | 0001 |
| ai_assistant | 0001 |
| notifications | 0002 |
| roster | 0001 |

---

## 11. Post-Deploy Commands

After every production deploy:
```bash
python manage.py migrate
python manage.py bootstrap_chatrooms   # idempotent — safe to re-run
python manage.py collectstatic --no-input
```

---

## 12. Design Principles

- **Separation of concerns** — each app owns its domain completely
- **Rooms only when teachers exist** — chat rooms created on `TeachingAssignment`, never on student registration
- **Explicit membership** — `ChatRoomMember` is the single source of truth for who is in which room
- **Token-scoped real-time** — Ably and LiveKit tokens carry only the capabilities the user is entitled to
- **Non-blocking gamification** — all gamification signals wrapped in `try/except`; failure never blocks learning
- **DB-safe async** — `CONN_MAX_AGE=0` + `post_fork` connection reset for gevent compatibility
- **AI stays on-topic** — Gemini system prompt enforces curriculum-only responses
- **Rural-context aware** — low bandwidth (lazy video loading, PDF fallback), low-literacy UX, sibling edge cases handled at model level
