# GyanGrit — API & Frontend Endpoint Documentation

> **Status: Current as of April 2026**  
> **Backend:** Oracle Cloud Mumbai · `https://api.gyangrit.site/api/v1/`  
> **18 Django apps, 95+ API endpoints**

---

## 1. Global Rules

### API Versioning
All endpoints are under `/api/v1/`. Version co-existence without breaking changes.

### Frontend API Rules (mandatory)
- All calls go through `src/services/api.ts`
- Paths are relative — never hardcode base URLs
- Session cookies sent with every request (`credentials: "include"`)
- CSRF token read from `gyangrit_csrftoken` cookie and sent as `X-CSRFToken` header

```ts
// Correct
apiGet("/courses/")

// Wrong — never do this
fetch("https://api.gyangrit.site/api/v1/courses/")
```

### Authentication
All endpoints except those marked **Public** require an active session cookie.
- `401` — not authenticated
- `403` — wrong role or insufficient permissions

---

## 2. Accounts App

Base path: `/api/v1/accounts/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/accounts/csrf/` | Public | Seeds CSRF cookie (call on app mount) |
| POST | `/accounts/register/` | Public | Register via join code |
| POST | `/accounts/student-register/` | Public | Student self-register via roster code + DOB |
| POST | `/accounts/login/` | Public | Login (returns session, triggers OTP for staff) |
| POST | `/accounts/verify-otp/` | Public | Submit OTP to complete staff login |
| POST | `/accounts/logout/` | Auth | Terminate session |
| GET | `/accounts/me/` | Auth | Current user profile |
| PATCH | `/accounts/me/update/` | Auth | Update profile (name, email, mobile) |
| POST | `/accounts/change-password/` | Auth | Change password |
| GET | `/accounts/join-codes/` | Admin | List join codes |
| POST | `/accounts/join-codes/create/` | Admin | Create join code (role+institution+section+expiry) |

---

## 3. Content App

Base path: `/api/v1/`

### Courses

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/courses/` | Auth | List courses (role-scoped) |
| POST | `/courses/create/` | Admin/Teacher/Principal | Create course |
| GET | `/courses/by-slug/?grade=10&subject=punjabi` | Auth | Resolve URL slug to course |
| PATCH | `/courses/<id>/` | Admin/Teacher/Principal | Update course |
| DELETE | `/courses/<id>/delete/` | Admin | Delete course |

### Course Progress

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/courses/<id>/progress/` | Student | Single course progress (total/completed/resume_lesson_id) |
| GET | `/courses/progress/batch/?ids=1,2,3` | Student | **Batch progress — 2 DB queries for N courses (fixes BRONZE-7 N+1)** |

### Lessons

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/courses/<id>/lessons/` | Auth | Published lesson list for a course |
| GET | `/courses/<id>/lessons/all/` | Teacher/Admin | All lessons (including unpublished) |
| POST | `/courses/<id>/lessons/create/` | Teacher/Admin | Create lesson |
| GET | `/lessons/<id>/` | Auth | Lesson detail with video, PDF, notes |
| PATCH | `/lessons/<id>/update/` | Teacher/Admin | Update lesson |
| DELETE | `/lessons/<id>/delete/` | Admin | Delete lesson |
| POST/PATCH | `/lessons/<id>/progress/` | Student | Mark lesson complete, save video position |
| POST | `/lessons/<id>/notes/` | Auth | Add note to lesson |

### Section Lessons (Teacher-added supplemental content)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/courses/<id>/section-lessons/` | Auth | List section lessons |
| POST | `/courses/<id>/section-lessons/` | Teacher/Principal | Create section lesson |
| GET | `/lessons/section/<id>/` | Auth | Section lesson detail |
| PATCH | `/lessons/section/<id>/update/` | Teacher/Principal | Update |
| DELETE | `/lessons/section/<id>/delete/` | Teacher/Principal | Delete |

### Teacher Analytics

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/teacher/analytics/courses/` | Teacher/Principal/Admin | Per-course completion stats |
| GET | `/teacher/analytics/lessons/` | Teacher/Principal/Admin | Per-lesson engagement stats |
| GET | `/teacher/analytics/classes/` | Teacher/Principal/Admin | Per-class progress overview |
| GET | `/teacher/analytics/assessments/` | Teacher/Principal/Admin | Assessment pass rates |
| GET | `/teacher/analytics/classes/<id>/students/` | Teacher/Principal | Student list for a class |
| GET | `/teacher/analytics/classes/<id>/students/<id>/` | Teacher/Principal | Individual student assessment history |

---

## 4. Assessments App

Base path: `/api/v1/assessments/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/assessments/my/` | Student | Student's assessments with pass/fail status |
| GET | `/assessments/<id>/` | Auth | Assessment detail with questions |
| POST | `/assessments/<id>/attempt/` | Student | Submit assessment attempt |
| GET | `/assessments/<id>/result/` | Student | Last attempt result |
| POST | `/assessments/course/<id>/` | Teacher/Admin | Create assessment for course |
| POST | `/assessments/course/<id>/ai-generate/` | Teacher/Admin | AI-generate assessment questions |
| PATCH | `/assessments/<id>/update/` | Teacher/Admin | Update assessment (publish, rename) |
| DELETE | `/assessments/<id>/delete/` | Admin | Delete assessment |

---

## 5. Analytics App

Base path: `/api/v1/analytics/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/analytics/me/engagement/?days=7` | Student/Teacher | My engagement events (last N days) |
| GET | `/analytics/me/risk/` | Student | My current risk score |
| GET | `/analytics/students/risk/` | Teacher/Principal | All students' risk scores (scoped) |
| GET | `/analytics/system-stats/` | Admin | System-wide stats (60s cached) |
| POST | `/analytics/nightly-recompute/` | QStash (Bearer token) | Recompute all student risk scores |

---

## 6. Academics App

Base path: `/api/v1/academics/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/academics/subjects/` | Auth | Subject list (with course_id if enrolled) |
| GET | `/academics/districts/` | Admin | All districts |
| GET | `/academics/institutions/` | Admin/Official | Institutions (scoped) |
| GET | `/academics/classrooms/` | Admin/Principal | Classrooms for institution |
| POST | `/academics/subjects/create/` | Admin | Create subject |
| POST | `/academics/institutions/create/` | Admin | Create institution |

---

## 7. Gamification App

Base path: `/api/v1/gamification/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/gamification/me/summary/` | Student | My points, streak, badges |
| GET | `/gamification/leaderboard/?section_id=1` | Student | Leaderboard for section |
| GET | `/gamification/badges/` | Auth | All available badge definitions |

---

## 8. Notifications App

Base path: `/api/v1/notifications/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/notifications/` | Auth | List notifications (unread first) |
| POST | `/notifications/<id>/read/` | Auth | Mark as read |
| POST | `/notifications/read-all/` | Auth | Mark all as read |
| POST | `/notifications/send/` | Teacher/Admin | Send notification to users or roles |
| POST | `/notifications/push/subscribe/` | Auth | Register browser push subscription |
| GET | `/notifications/push/vapid-key/` | Public | Get VAPID public key for push setup |

---

## 9. Flashcards App

Base path: `/api/v1/flashcards/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/flashcards/my/` | Student | Student's decks |
| GET | `/flashcards/<id>/` | Auth | Deck with cards |
| POST | `/flashcards/<id>/review/` | Student | Submit SM-2 review (easy/good/hard) |
| POST | `/flashcards/ai-generate/` | Teacher/Admin | AI-generate flashcard deck |
| POST | `/flashcards/ai-generate/<id>/publish/` | Teacher/Admin | Publish deck to students (sends notification) |

---

## 10. Live Sessions App

Base path: `/api/v1/live/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/live/sessions/` | Auth | List live sessions (scoped by role) |
| POST | `/live/sessions/create/` | Teacher/Principal | Create live session |
| GET | `/live/sessions/<id>/` | Auth | Session detail |
| POST | `/live/sessions/<id>/start/` | Teacher/Principal | Start session (triggers LiveKit room + Egress recording) |
| POST | `/live/sessions/<id>/end/` | Teacher/Principal | End session |
| POST | `/live/sessions/<id>/join/` | Auth | Get LiveKit room token |
| POST | `/live/sessions/<id>/attendance/` | Student | Record attendance |
| GET | `/live/sessions/<id>/attendance/` | Teacher | View attendance list |
| GET | `/live/recordings/` | Auth | List completed recordings |

---

## 11. Gradebook App

Base path: `/api/v1/gradebook/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/gradebook/class/<id>/` | Teacher/Principal | Class marks overview |
| POST | `/gradebook/marks/` | Teacher | Record marks (oral/practical/test) |
| PATCH | `/gradebook/marks/<id>/` | Teacher | Update marks |
| GET | `/gradebook/student/<id>/` | Teacher/Principal | Student marks across terms |

---

## 12. Chatrooms App

Base path: `/api/v1/chatrooms/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/chatrooms/` | Auth | List accessible rooms |
| GET | `/chatrooms/<id>/messages/` | Auth | Recent messages |
| POST | `/chatrooms/<id>/messages/` | Auth | Send message |
| POST | `/chatrooms/auth/` | Auth | Ably channel auth token |

---

## 13. Competitions App

Base path: `/api/v1/competitions/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/competitions/` | Auth | List competitions |
| POST | `/competitions/create/` | Teacher/Admin | Create competition room |
| POST | `/competitions/<id>/join/` | Student | Join competition |
| POST | `/competitions/<id>/submit/` | Student | Submit answer |
| GET | `/competitions/<id>/leaderboard/` | Auth | Live competition scores |

---

## 14. Roster App

Base path: `/api/v1/roster/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/roster/upload/` | Teacher/Principal | Upload Excel with student pre-registration data |
| GET | `/roster/students/` | Teacher/Principal | List pre-registered students |

---

## 15. Media App

Base path: `/api/v1/media/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/media/presigned-upload/` | Teacher/Admin | Get R2 presigned upload URL |
| DELETE | `/media/delete/` | Teacher/Admin | Delete R2 object |
| GET | `/media-proxy/` | Auth | CORS proxy for offline download |

---

## 16. AI Assistant App

Base path: `/api/v1/ai-assistant/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/ai-assistant/chat/` | Student | Chat with AI tutor (BOA → Groq → Together → Gemini) |
| GET | `/ai-assistant/history/` | Student | Last 20 messages |
| DELETE | `/ai-assistant/clear/` | Student | Clear conversation history |

---

## 17. Learning App

Base path: `/api/v1/learning/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/learning/paths/` | Student | Student's learning paths |
| GET | `/learning/enrollments/` | Student | Subject enrollments |

---

## 18. Health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health/` | Public | Returns `{"status":"ok","timestamp":"..."}` |

---

## Frontend Route Map

| Route | Page Component | Role |
|---|---|---|
| `/` | `LandingPage` | Public |
| `/login` | `LoginPage` | Public |
| `/register` | `RegisterPage` | Public |
| `/dashboard` | `DashboardPage` | STUDENT |
| `/courses/:grade/:subject` | `LessonsPage` | STUDENT |
| `/courses/:grade/:subject/assessments` | `CourseAssessmentsPage` | STUDENT |
| `/lesson/:id` | `LessonDetailPage` | STUDENT |
| `/learning-path` | `LearningPathPage` | STUDENT |
| `/live/:sessionId` | `LivePage` | STUDENT |
| `/notifications` | `NotificationsPage` | ALL |
| `/chat` | `ChatPage` | ALL |
| `/competitions` | `CompetitionsPage` | ALL |
| `/flashcards` | `FlashcardsPage` | STUDENT |
| `/ai-chat` | `AIChatPage` | STUDENT |
| `/profile` | `ProfilePage` | ALL |
| `/downloads` | `OfflineDownloadsPage` | STUDENT |
| `/teacher/dashboard` | `TeacherDashboardPage` | TEACHER |
| `/teacher/ai-tools` | `AIToolsPage` | TEACHER |
| `/teacher/courses/:id/lessons` | `AdminLessonEditorPage` | TEACHER |
| `/teacher/courses/:id/assessments` | `AdminAssessmentBuilderPage` | TEACHER |
| `/principal/dashboard` | `PrincipalDashboardPage` | PRINCIPAL |
| `/principal/ai-tools` | `AIToolsPage` | PRINCIPAL |
| `/official/dashboard` | `OfficialDashboardPage` | OFFICIAL |
| `/admin-panel` | `AdminContentPage` | ADMIN |
| `/admin/live` | `AdminLiveSessionsPage` | ADMIN/T/P |
| `/admin/live/new` | `AdminCreateSessionPage` | ADMIN/T/P |
| `/admin/live/recordings` | `RecordingsPage` | ADMIN/T/P |
| `/admin/ai-tools` | `AIToolsPage` | ADMIN |
| `/admin/gradebook` | `GradebookPage` | ADMIN/T/P |
| `/admin/roster` | `RosterPage` | ADMIN/T/P |
| `/admin/competitions` | `AdminCompetitionsPage` | ADMIN/T |
| `/admin/notifications` | `AdminNotificationsPage` | ADMIN/T/P |

> **Note:** `T` = TEACHER, `P` = PRINCIPAL
