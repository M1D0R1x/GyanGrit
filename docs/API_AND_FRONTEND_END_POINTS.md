# GyanGrit — API & Frontend Endpoint Documentation

> **Status: Updated 2026-03-26**
> 16 backend apps. 41 frontend pages. Production: https://gyangrit.onrender.com

---

## 1. Global Rules

### API Versioning
All endpoints under `/api/v1/`. Future versions coexist without breaking this contract.

### Frontend API Rules (mandatory)
- All calls through `src/services/api.ts` — never hardcode base URLs
- Session cookies sent with every request (`credentials: "include"`)
- CSRF token from `gyangrit_csrftoken` cookie, sent as `X-CSRFToken` header

### Authentication
All endpoints except Public require an active session cookie.
Unauthenticated → `401`. Insufficient role → `403`.

---

## 2. Accounts — `/api/v1/accounts/`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `csrf/` | Public | Seed CSRF cookie |
| POST | `register/` | Public | Join-code registration |
| POST | `student-register/` | Public | Student self-register via roster code |
| POST | `login/` | Public | Session login |
| POST | `verify-otp/` | Public | OTP verification (teacher/principal/official) |
| POST | `logout/` | Auth | Clear session |
| GET | `me/` | Auth | Current user profile |
| PATCH | `profile/` | Auth | Update profile fields |
| GET | `users/` | TEACHER+ | Users list (scoped by role) |
| GET | `teachers/` | PRINCIPAL+ | Teachers in institution/district |
| GET | `my-assignments/` | TEACHER | Teaching assignments for this teacher |
| GET | `system-stats/` | ADMIN | Platform-wide user/content stats |
| GET | `health/` | Public | Health check (used by keep-alive ping) |

---

## 3. Academics — `/api/v1/academics/`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `districts/` | Public | All 23 Punjab districts |
| GET | `institutions/` | Auth | Filterable by `?district_id=` |
| GET | `classrooms/` | Auth | Filterable by `?institution_id=` |
| GET | `sections/` | Auth | Filterable by `?classroom__institution_id=` |
| GET | `subjects/` | Auth | Student: enrolled subjects with progress + `course_id`; Staff: global catalog |

---

## 4. Content — `/api/v1/`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `courses/` | Auth | List courses (`?subject_id=`, `?grade=`, `?is_core=`) |
| GET | `courses/by-slug/` | Auth | Resolve `?grade=&subject=` to course |
| POST | `courses/` | ADMIN | Create course |
| GET | `courses/:id/lessons/` | Auth | Merged curriculum + section lessons with `completed` flag |
| GET | `lessons/:id/` | Auth | Lesson detail (video, PDF, content, notes) |
| POST | `courses/:id/lessons/` | TEACHER+ | Create curriculum lesson |
| PATCH | `lessons/:id/` | TEACHER+ | Update lesson |
| POST | `courses/:id/section-lessons/` | TEACHER+ | Add teacher-authored lesson |
| PATCH | `lessons/:id/progress/` | STUDENT | Mark complete, update video position |
| GET | `courses/:id/progress/` | Auth | Course completion % + `resume_lesson_id` |
| GET | `teacher/analytics/courses/` | TEACHER+ | Course analytics |
| GET | `teacher/analytics/classes/` | TEACHER+ | Class analytics |
| GET | `teacher/analytics/classes/:id/students/` | TEACHER+ | Per-student progress in a class |
| GET | `teacher/analytics/assessments/` | TEACHER+ | Assessment analytics |

---

## 5. Assessments — `/api/v1/assessments/`

**Security:** `is_correct` is NEVER returned to students. Hard rule — never weaken.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/` | Auth | List assessments |
| GET | `my/` | STUDENT | Student assessments with attempt context |
| POST | `/` | TEACHER+ | Create assessment |
| GET | `:id/` | STUDENT | Questions + options (no `is_correct`) |
| GET | `:id/admin/` | TEACHER+ | Questions + options WITH `is_correct` (builder) |
| POST | `:id/attempt/` | STUDENT | Submit answers → returns score + gamification |
| GET | `history/` | Auth | All attempts |
| GET | `:id/history/` | Auth | Attempts for one assessment |

---

## 6. Learning — `/api/v1/learning/`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `enrollments/` | Auth | List enrollments |
| POST | `enrollments/` | STUDENT | Enroll in course |
| GET | `student/dashboard/` | STUDENT | All enrolled courses with progress |
| GET | `paths/` | Auth | Learning paths |
| GET | `paths/:id/` | Auth | Path detail |
| GET | `paths/:id/progress/` | Auth | Path progress |

---

## 7. Roster — `/api/v1/roster/`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `upload/` | TEACHER+ | Upload `.xlsx` student roster |
| GET | `records/` | TEACHER+ | List registration records (`?section_id=`) |
| POST | `regenerate-code/` | TEACHER+ | New registration code for a student |

---

## 8. Notifications — `/api/v1/notifications/`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `me/` | Auth | Inbox with `unread` count |
| GET | `history/` | Auth | Paginated inbox history |
| POST | `mark-read/` | Auth | Mark notifications read |
| POST | `read-all/` | Auth | Mark all read |
| POST | `send/` | TEACHER+ | Send broadcast |
| GET | `sent/` | TEACHER+ | Sent broadcasts |
| GET | `sent/:id/` | TEACHER+ | Broadcast detail |
| GET | `audience-options/` | TEACHER+ | Available audience types and targets |

---

## 9. Gamification — `/api/v1/gamification/`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `me/` | STUDENT | Points, streak, badges, rank |
| GET | `leaderboard/class/` | Auth | Class leaderboard (top 20) |
| GET | `leaderboard/school/` | Auth | School leaderboard |

**Point values:** lesson_complete +10, assessment_attempt +5, assessment_pass +25, perfect_score +50, streak_3 +15, streak_7 +50.

---

## 10. Gradebook — `/api/v1/gradebook/`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `choices/` | TEACHER+ | Term and category options for dropdowns |
| POST | `entry/` | TEACHER+ | Create grade entry |
| PATCH | `entry/:id/` | TEACHER+ | Update entry (teacher who created it or PRINCIPAL) |
| DELETE | `entry/:id/delete/` | TEACHER+ | Delete entry |
| GET | `student/:id/` | TEACHER+ | All grades for a student |
| GET | `class/:id/` | TEACHER+ | All grades for a class |

---

## 11. Competitions — `/api/v1/competitions/` + `/api/v1/realtime/`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/` | Auth | List rooms (scoped) |
| POST | `create/` | TEACHER+ | Create competition room |
| GET | `:id/` | Auth | Room detail (questions only when `active`) |
| POST | `:id/join/` | STUDENT | Join room |
| POST | `:id/start/` | TEACHER+ | Go live → Ably `room:started` |
| POST | `:id/finish/` | TEACHER+ | End → Ably `room:finished` + leaderboard |
| POST | `:id/answer/` | STUDENT | Submit answer → Ably `room:scores` |
| POST | `realtime/token/` | Auth | Ably JWT (`channel_type=competition\|chat`) |

**Ably token capabilities:**
- STUDENT, `channel_type=competition` → `competition:{room_id}` subscribe only
- TEACHER, `channel_type=competition` → `competition:*` publish + subscribe
- Any user, `channel_type=chat` → `chat:{room_id}` for each membership + `notifications:{user_id}`

---

## 12. Chat Rooms — `/api/v1/chat/`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `rooms/` | Auth | List rooms (membership-based; admin: filtered by institution) |
| GET | `rooms/:id/` | Auth | Room detail + member count |
| GET | `rooms/:id/history/` | Auth | Last 50 top-level messages |
| GET | `rooms/:id/thread/:msg_id/` | Auth | Parent message + all replies |
| POST | `rooms/:id/message/` | Auth | Send message (students: reply only in subject rooms) |
| POST | `rooms/:id/pin/:msg_id/` | TEACHER+ | Toggle pin |
| GET | `rooms/:id/pinned/` | Auth | Pinned messages |
| GET | `rooms/:id/members/` | Auth | Room member list |
| GET | `admin/rooms/` | ADMIN | All rooms filterable (`?institution_id=`, `?room_type=`, `?q=`) |
| GET | `admin/rooms/:id/messages/` | ADMIN | All messages in a room |

**Admin query params:** `?institution_id=all` returns everything (used by AdminChatManagementPage). Default: admin's own institution.

---

## 13. Flashcards — `/api/v1/flashcards/`

### Teacher endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `decks/` | TEACHER+ | List my decks |
| POST | `decks/` | TEACHER+ | Create deck |
| GET | `decks/:id/` | TEACHER+ | Deck detail with all cards |
| PATCH | `decks/:id/` | TEACHER+ | Update title/description/is_published |
| DELETE | `decks/:id/` | TEACHER+ | Delete deck and all cards |
| POST | `decks/:id/cards/` | TEACHER+ | Add card to deck |
| PATCH | `decks/:id/cards/:cid/` | TEACHER+ | Edit card |
| DELETE | `decks/:id/cards/:cid/` | TEACHER+ | Delete card |

### Student endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `study/` | Auth | List available published decks with `due_count` |
| GET | `study/:deck_id/due/` | Auth | Cards due today (max 20, overdue first) |
| POST | `study/:deck_id/review/` | Auth | Submit rating 0-3, get updated SM-2 state |
| GET | `study/:deck_id/stats/` | Auth | Deck stats (total, reviewed, mastered, due) |

---

## 14. Live Sessions — `/api/v1/live/`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `sessions/` | TEACHER+ | List my sessions with attendance count |
| POST | `sessions/` | TEACHER+ | Create session |
| GET | `sessions/upcoming/` | STUDENT | Upcoming + live sessions for my section |
| POST | `sessions/:id/start/` | TEACHER+ | Go live → Ably notify students |
| POST | `sessions/:id/end/` | TEACHER+ | End session |
| POST | `sessions/:id/join/` | STUDENT | Record attendance |
| GET | `sessions/:id/token/` | Auth | LiveKit JWT token for room |
| GET | `sessions/:id/attendance/` | TEACHER+ | Attendance list |

**Token response:**
```json
{
  "token": "<JWT>",
  "room_name": "gyangrit-5-abc12345",
  "livekit_url": "wss://gyangrit-xxxx.livekit.cloud",
  "identity": "4",
  "can_publish": false
}
```

---

## 15. AI Assistant — `/api/v1/ai/`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `conversations/` | Auth | List conversations |
| GET | `conversations/:id/` | Auth | Conversation history |
| DELETE | `conversations/:id/delete/` | Auth | Delete conversation |
| POST | `chat/` | Auth | Send message → get Gemini response |

**Chat request:**
```json
{
  "message": "Explain photosynthesis simply",
  "conversation_id": 5,
  "subject_id": 8
}
```

**Chat response:**
```json
{
  "conversation_id": 5,
  "message": {
    "id": 42,
    "role": "assistant",
    "content": "Photosynthesis is...",
    "created_at": "2026-03-26T..."
  }
}
```

---

## 16. Frontend Routes (complete)

### Public

| Route | Component |
|---|---|
| `/login` | LoginPage |
| `/register` | RegisterPage |
| `/verify-otp` | VerifyOtpPage |
| `/complete-profile` | CompleteProfilePage |

### Shared (all authenticated)

| Route | Component |
|---|---|
| `/notifications` | NotificationsPage |
| `/profile` | ProfilePage |

### Student

| Route | Component | Purpose |
|---|---|---|
| `/dashboard` | DashboardPage | Subject progress + assessments + gamification |
| `/courses` | CoursesPage | All enrolled courses |
| `/courses/:grade/:subject` | LessonsPage | Lesson list |
| `/courses/:grade/:subject/assessments` | CourseAssessmentsPage | Course assessments |
| `/lessons/:lessonId` | LessonPage | Video, PDF, Markdown |
| `/lessons/section/:lessonId` | SectionLessonPage | Teacher-added lesson |
| `/assessments` | AssessmentsPage | All assessments |
| `/assessments/history` | AssessmentHistoryPage | All attempts |
| `/assessments/:grade/:subject/:id` | AssessmentPage | Instructions + start |
| `/assessments/:grade/:subject/:id/take` | AssessmentTakePage | Timer, dot nav, submit |
| `/assessment-result` | AssessmentResultPage | Score + points |
| `/learning` | LearningPathsPage | Learning paths |
| `/learning/:pathId` | LearningPathPage | Path detail |
| `/leaderboard` | LeaderboardPage | Class + school |
| `/chat` | ChatRoomPage | Chat rooms (sidebar by type) |
| `/chat/:roomId` | ChatRoomPage | Specific room |
| `/competitions` | CompetitionRoomPage | Competition rooms |
| `/competitions/:roomId` | CompetitionRoomPage | Specific room |
| `/flashcards` | FlashcardsStudyPage | Deck list + study |
| `/flashcards/:deckId` | FlashcardsStudyPage | Study specific deck |
| `/live` | LiveSessionPage | Upcoming live classes |
| `/live/:sessionId` | LiveSessionPage | Join specific session |
| `/ai-tutor` | AIChatPage | AI chatbot |

### Teacher

| Route | Component |
|---|---|
| `/teacher` | TeacherDashboardPage |
| `/teacher/classes/:id` | TeacherClassDetailPage |
| `/teacher/classes/:id/gradebook` | GradebookPage |
| `/teacher/classes/:id/students/:sid` | TeacherStudentDetailPage |
| `/teacher/courses/:id/lessons` | AdminLessonEditorPage |
| `/teacher/courses/:id/assessments` | AdminAssessmentBuilderPage |
| `/teacher/users` | UserManagementPage |
| `/teacher/chat`, `/teacher/chat/:roomId` | ChatRoomPage |
| `/teacher/competitions`, `/teacher/competitions/:roomId` | CompetitionRoomPage |
| `/teacher/flashcards` | FlashcardDecksPage |
| `/teacher/live`, `/teacher/live/:sessionId` | LiveSessionPage |
| `/teacher/ai-tutor` | AIChatPage |

### Principal

| Route | Component |
|---|---|
| `/principal` | PrincipalDashboardPage |
| `/principal/classes/:id/gradebook` | GradebookPage |
| `/principal/courses/:id/lessons` | AdminLessonEditorPage |
| `/principal/courses/:id/assessments` | AdminAssessmentBuilderPage |
| `/principal/users` | UserManagementPage |
| `/principal/chat`, `/principal/chat/:roomId` | ChatRoomPage |
| `/principal/competitions`, `/principal/competitions/:roomId` | CompetitionRoomPage |
| `/principal/flashcards` | FlashcardDecksPage |
| `/principal/live` | LiveSessionPage |

### Official

| Route | Component |
|---|---|
| `/official` | OfficialDashboardPage |
| `/official/users` | UserManagementPage |

### Admin

| Route | Component |
|---|---|
| `/admin-panel` | AdminDashboardPage |
| `/admin/content` | AdminContentPage |
| `/admin/content/courses/:id/lessons` | AdminLessonEditorPage |
| `/admin/content/courses/:id/assessments` | AdminAssessmentBuilderPage |
| `/admin/join-codes` | AdminJoinCodesPage |
| `/admin/users` | UserManagementPage |
| `/admin/chat`, `/admin/chat/:roomId` | ChatRoomPage |
| `/admin/chat-management` | AdminChatManagementPage |
| `/admin/competitions`, `/admin/competitions/:roomId` | CompetitionRoomPage |
| `/admin/flashcards` | FlashcardDecksPage |
| `/admin/live` | LiveSessionPage |
| `/admin/ai-tutor` | AIChatPage |

### Errors

| Route | Component |
|---|---|
| `/403` | ForbiddenPage |
| `/500` | ServerErrorPage |
| `/network-error` | NetworkErrorPage |
| `*` | NotFoundPage |

---

## 17. Frontend Service Files

| File | Responsibility |
|---|---|
| `api.ts` | Base fetch helpers (`apiGet`, `apiPost`, `apiPatch`, `apiDelete`), CSRF init |
| `assessments.ts` | Assessment CRUD, attempts, admin detail |
| `aiAssistant.ts` | Gemini chatbot — conversations, send message, delete |
| `chat.ts` | Chat rooms — list, history, thread, send, pin, admin endpoints |
| `competitions.ts` | Competition rooms + Ably token (`getAblyToken(roomId?, channelType?)`) |
| `content.ts` | Section lesson CRUD, lesson detail, course by slug |
| `courseProgress.ts` | Course progress, `resume_lesson_id` |
| `flashcards.ts` | Deck CRUD (teacher) + study session (student) + SM-2 review |
| `gamification.ts` | Points, leaderboard |
| `gradebook.ts` | GradeEntry CRUD, class/student views, choices |
| `learningEnrollments.ts` | Enrollment management |
| `learningPaths.ts` | Learning path listing, detail, progress |
| `livesessions.ts` | LiveSession CRUD, token, attendance |
| `media.ts` | Cloudflare R2 presigned upload |
| `notifications.ts` | Inbox, mark read, broadcasts |
| `progress.ts` | Lesson progress PATCH |
| `teacherAnalytics.ts` | All teacher analytics endpoints |
