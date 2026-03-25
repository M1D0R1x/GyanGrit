# GyanGrit — Page & Endpoint Audit Log

**Audited by:** Claude (Opus 4.6)
**Date:** 2026-03-25
**Method:** Read every frontend page import + service call, matched against backend URL patterns

---

## Frontend Pages (38 total)

### Public Pages (4)
| Page | Route | Status | Notes |
|---|---|---|---|
| LoginPage | `/login` | ✅ OK | Kicked banner added. `otp_channel` passed to OTP page |
| RegisterPage | `/register` | ✅ OK | Fetches validate-join-code, districts, schools |
| VerifyOtpPage | `/verify-otp` | ✅ FIXED | Added resend OTP with 60s countdown |
| CompleteProfilePage | `/complete-profile` | ✅ OK | PATCH /accounts/profile/ |

### Student Pages (16)
| Page | Route | Status | Notes |
|---|---|---|---|
| DashboardPage | `/dashboard` | ✅ OK | Fetches subjects, assessments/my, gamification/me |
| CoursesPage | `/courses` | ✅ OK | Fetches /courses/ |
| LessonsPage | `/courses/:grade/:subject` | ✅ OK | Uses course-by-slug resolution |
| LessonPage | `/lessons/:lessonId` | ✅ FIXED | Added Save for Offline button |
| SectionLessonPage | `/lessons/section/:lessonId` | ✅ OK | Fetches /lessons/section/:id/ |
| LearningPathsPage | `/learning` | ✅ OK | Fetches /learning/paths/ |
| LearningPathPage | `/learning/:pathId` | ✅ OK | Fetches /learning/paths/:id/ + /progress/ |
| AssessmentsPage | `/assessments` | ✅ OK | Fetches /assessments/my/ |
| AssessmentPage | `/assessments/:grade/:subject/:id` | ✅ OK | Uses slug resolution |
| AssessmentTakePage | `.../:id/take` | ✅ OK | start + submit endpoints |
| AssessmentsResultPage | `/assessment-result` | ✅ OK | Receives state via router |
| AssessmentHistoryPage | `/assessments/history` | ✅ OK | Fetches /assessments/my-history/ |
| CourseAssessmentsPage | `/courses/:g/:s/assessments` | ✅ OK | Fetches course assessments |
| LeaderboardPage | `/leaderboard` | ✅ OK | Fetches class + school leaderboard |
| ProfilePage | `/profile` | ✅ OK | Shows gamification, profile data |
| NotificationsPage | `/notifications` | ✅ OK | Inbox + send + sent history tabs |

### Teacher Pages (7)
| Page | Route | Status | Notes |
|---|---|---|---|
| TeacherDashboardPage | `/teacher` | ✅ OK | Analytics endpoints verified |
| TeacherClassDetailPage | `/teacher/classes/:id` | ✅ OK | Student list with stats |
| TeacherStudentDetailPage | `.../students/:id` | ✅ OK | Assessment history per student |
| GradebookPage | `.../gradebook` | ✅ OK | All gradebook service endpoints match |
| AdminLessonEditorPage | `.../lessons` | ✅ OK | CRUD for lessons + section lessons |
| AdminAssessmentBuilderPage | `.../assessments` | ✅ OK | Assessment + question CRUD |
| UserManagementPage | `/teacher/users` | ✅ OK | Join code management |

### Principal Pages (reuse teacher components)
| Page | Route | Status | Notes |
|---|---|---|---|
| PrincipalDashboardPage | `/principal` | ✅ OK | Institution overview |

### Official Pages
| Page | Route | Status | Notes |
|---|---|---|---|
| OfficialDashboardPage | `/official` | ✅ OK | District analytics |

### Admin Pages (4)
| Page | Route | Status | Notes |
|---|---|---|---|
| AdminDashboardPage | `/admin-panel` | ✅ OK | System stats + quick nav |
| AdminContentPage | `/admin/content` | ✅ OK | Course management |
| AdminJoinCodesPage | `/admin/join-codes` | ✅ OK | Full join code CRUD |
| AdminChatManagementPage | `/admin/chat-management` | ✅ OK | Uses /chat/admin/rooms/ |

### Feature Pages (shared across roles)
| Page | Route | Status | Notes |
|---|---|---|---|
| CompetitionRoomPage | `*/competitions/:roomId` | ✅ OK | Ably token, join, answer, leaderboard |
| ChatRoomPage | `*/chat/:roomId` | ✅ OK | Real-time via Ably |
| FlashcardDecksPage | `*/flashcards` | ✅ OK | Deck CRUD for teachers |
| FlashcardsStudyPage | `/flashcards/:deckId` | ✅ OK | Spaced repetition study |
| LiveSessionPage | `*/live/:sessionId` | ✅ FIXED | Dropdown was calling wrong endpoint |
| AIChatPage | `*/ai-tutor` | ✅ FIXED | Gemini model updated to 2.0-flash |

### Error Pages (4)
| Page | Route | Status |
|---|---|---|
| NotFoundPage | `*` | ✅ OK |
| ForbiddenPage | `/403` | ✅ OK |
| ServerErrorPage | `/500` | ✅ OK |
| NetworkErrorPage | `/network-error` | ✅ OK |

---

## Backend Apps (17 total)

| App | Mount | Endpoints | Status |
|---|---|---|---|
| accounts | `/api/v1/accounts/` | 17 endpoints | ✅ All verified |
| academics | `/api/v1/academics/` | 8 endpoints | ✅ All verified |
| content | `/api/v1/` | 18 endpoints | ✅ All verified |
| assessments | `/api/v1/assessments/` | 12 endpoints | ✅ All verified |
| learning | `/api/v1/learning/` | 7 endpoints | ✅ All verified |
| roster | `/api/v1/roster/` | 3 endpoints | ✅ All verified |
| gamification | `/api/v1/gamification/` | 3 endpoints | ✅ All verified |
| notifications | `/api/v1/notifications/` | 11 endpoints | ✅ All verified |
| media | `/api/v1/media/` | 2 endpoints | ✅ All verified |
| competitions | `/api/v1/competitions/` | 7 endpoints | ✅ All verified |
| chatrooms | `/api/v1/chat/` | 10 endpoints | ✅ All verified |
| flashcards | `/api/v1/flashcards/` | 8 endpoints | ✅ All verified |
| livesessions | `/api/v1/live/` | 7 endpoints | ✅ All verified |
| ai_assistant | `/api/v1/ai/` | 4 endpoints | ✅ All verified |
| gradebook | `/api/v1/gradebook/` | 6 endpoints | ✅ All verified |
| realtime | `/api/v1/realtime/` | 1 endpoint | ✅ All verified |
| accesscontrol | (no mount) | Library only | ✅ N/A |

---

## Issues Found & Fixed

| # | Issue | File | Fix |
|---|---|---|---|
| 1 | SW registration fails (MIME type) | `.gitignore`, `vercel.json` | Unblocked sw.js, explicit Vercel routes |
| 2 | CORS errors on cold start | `AuthContext.tsx` | Retry with exponential backoff |
| 3 | 502 Bad Gateway (gevent crash) | `gunicorn.conf.py`, `requirements/prod.txt` | Switched to gthread workers |
| 4 | Login 500 (Python 3.14) | `runtime.txt`, Render env | Pin PYTHON_VERSION=3.11.12 |
| 5 | Live session dropdown empty | `LiveSessionPage.tsx` | `/accounts/` → `/academics/my-assignments/` |
| 6 | AI chat 404 error | `ai_assistant/views.py` | gemini-1.5-flash → gemini-2.0-flash |
| 7 | No resend OTP | `views.py`, `urls.py`, `VerifyOtpPage.tsx` | New endpoint + countdown UI |
| 8 | Silent multi-device logout | `middleware.py`, `api.ts`, `LoginPage.tsx` | JSON 401 + kicked banner |
| 9 | No profile redirect | `RoleBasedRedirect.tsx` | Check profile_complete on login |
| 10 | No push notifications | `notifications/` (multiple files) | Full VAPID push stack |
| 11 | No offline storage | `offline.ts`, `LessonPage.tsx` | IndexedDB + Save button |
| 12 | TS error: LessonDetail.order | `LessonPage.tsx` | Use `lesson.course?.id`, hardcode order=0 |
| 13 | TS error: Uint8Array type | `push.ts` | Return ArrayBuffer directly |
| 14 | No push on live session start | `livesessions/views.py` | Added send_push_to_users in session_start |
| 15 | No push on assessment publish | `assessments/views.py` | Added push in update_assessment when is_published flips |
| 16 | Bell panel 26KB payload | `notifications/views.py` | Truncate message to 120 chars in bell panel |
| 17 | Push broken: missing settings import | `notifications/views.py` | Added `from django.conf import settings` |
| 18 | Vercel static 404s on JS chunks | `vercel.json` | Added `/assets/:path*` before SPA catch-all |
| 19 | FlashcardDecksPage wrong endpoint | `FlashcardDecksPage.tsx` | `/accounts/` → `/academics/my-assignments/` |
| 20 | CompetitionRoomPage section label | `CompetitionRoomPage.tsx` | Shows "Class 8 - A" instead of just "A" |
| 21 | my_assignments 403 for PRINCIPAL/ADMIN | `academics/views.py` | Scoped query for all roles |
| 22 | LiveSessionPage section label | `LiveSessionPage.tsx` | Shows "Class 8 - A" instead of just "A" |

---

## Service File → Backend URL Mapping (Verified)

| Frontend Service | Backend App | Match |
|---|---|---|
| `api.ts` | accounts (csrf, health) | ✅ |
| `assessments.ts` | assessments | ✅ |
| `content.ts` | content | ✅ |
| `courseProgress.ts` | content (progress) | ✅ |
| `gamification.ts` | gamification | ✅ |
| `learningEnrollments.ts` | learning | ✅ |
| `learningPaths.ts` | learning (paths) | ✅ |
| `media.ts` | media | ✅ |
| `notifications.ts` | notifications | ✅ |
| `progress.ts` | content (lesson progress) | ✅ |
| `teacherAnalytics.ts` | content (teacher analytics) | ✅ |
| `competitions.ts` | competitions + realtime | ✅ |
| `chat.ts` | chatrooms | ✅ |
| `flashcards.ts` | flashcards | ✅ |
| `livesessions.ts` | livesessions | ✅ |
| `aiAssistant.ts` | ai_assistant | ✅ |
| `gradebook.ts` | gradebook | ✅ |
| `push.ts` | notifications (push) | ✅ |
| `offline.ts` | (local IndexedDB only) | ✅ N/A |
