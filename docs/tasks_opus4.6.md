# GyanGrit — Opus 4.6 Task Plan

**Created:** 2026-03-25
**Engineer:** Claude (Opus 4.6) under Veera's direction
**Goal:** Fix all bugs, finish integrations, make the project submission-ready

---

## Session Log

### Session 1 — PWA / Deployment Crisis (2026-03-25, completed)
- Fixed SW registration (MIME type error, gitignore blocking sw.js)
- Fixed CORS/cold-start (retry logic, Vercel routing)
- Switched gevent → gthread (Python 3.14 incompatibility)
- Added Sentry SDK (conditional import)
- Added Upstash Redis session store (conditional import)
- Fixed Gemini model (1.5-flash → 2.0-flash)
- Health endpoint accepts POST for QStash keep-alive
- Created ALTERNATIVE_DEPLOYMENT.md
- Created Dockerfile for future migration

---

### Session 2 — Bug Fixes, Push, Offline, OTP (2026-03-25, completed)
- Fixed Live Session class dropdown (wrong endpoint path)
- Multi-device logout notification (middleware JSON 401 + frontend banner)
- Endpoint audit: all 17 service files verified against backend URLs
- Resend OTP: backend endpoint with 60s rate limit + frontend countdown timer
- Profile completion redirect in RoleBasedRedirect
- Push Notifications full stack
- Offline content IndexedDB + Save for Offline button on LessonPage
- VAPID keys generated

### Session 3 — TS Fixes, Full Audit, Docs, Domain (2026-03-25, completed)
- Fixed TS error: push.ts Uint8Array → return ArrayBuffer directly
- Fixed TS error: LessonPage.order → hardcoded 0 (was already fixed but re-verified)
- Created AUDIT_LOG.md — 38 pages verified, 17 apps verified, 19 services matched, 13 issues logged
- Created DOMAIN_AND_SERVICES.md — domain comparison, Namecheap guide, DNS setup, email options
- Updated README.md — 17 apps (was 10), 38 pages (was 30), 19 services (was 11)
- Full push notification stack:
  - PushSubscription model + migration
  - pywebpush delivery service (push.py)
  - subscribe/unsubscribe/vapid-key endpoints
  - Frontend push.ts service + auto-subscribe in AuthContext
  - Push delivery integrated into notification broadcasts
- Offline content: IndexedDB storage service (offline.ts)
- Save for Offline button on LessonPage
- VAPID keys generated

---

## Session 2 — Bug Fixes & Endpoint Audit (COMPLETED)

### Priority 1: Critical Bugs (Blocking normal usage)

- [ ] **Live Session class dropdown empty**
  - `LiveSessionPage.tsx` line ~148: calls `/accounts/my-assignments/` — should be `/academics/my-assignments/`
  - Fix: update the apiGet path
  - Files: `frontend/src/pages/LiveSessionPage.tsx`

- [ ] **Teacher OTP delivery slow (Fast2SMS DLT not verified)**
  - Fast2SMS returns 996 error — needs website/DLT verification on their dashboard
  - Immediate fix: reduce timeout (already done from 8s→4s)
  - TODO: Add a "Resend OTP" button on VerifyOtpPage if not present
  - Files: `backend/apps/accounts/services.py`, `frontend/src/pages/VerifyOtpPage.tsx`

- [ ] **DEBUG=True still on in Render** (Veera must toggle in dashboard)
  - Action: Veera sets DEBUG=False in Render env vars
  - Also set PYTHON_VERSION=3.11.12 in Render env vars

### Priority 2: Endpoint Bugs (Found during audit)

- [ ] **Gradebook — verify endpoints work**
  - Check: `GET /api/v1/gradebook/entries/`, create, update
  - Check: frontend GradebookPage fetches correct endpoints
  - Files: `backend/apps/gradebook/views.py`, `frontend/src/pages/GradebookPage.tsx`

- [ ] **Competitions — verify room lifecycle**
  - Check: create room, join, submit answer, leaderboard
  - Check: Ably token vending works
  - Files: `backend/apps/competitions/views.py`, `frontend/src/pages/CompetitionRoomPage.tsx`

- [ ] **Flashcards — verify CRUD + study flow**
  - Check: deck list, deck detail, study mode, flip/next
  - Check: teacher can create decks
  - Files: `backend/apps/flashcards/views.py`, `frontend/src/pages/FlashcardDecksPage.tsx`, `FlashcardsStudyPage.tsx`

- [ ] **Chat rooms — verify message send/receive**
  - Check: room list, send message, Ably real-time
  - Check: admin chat management page
  - Files: `backend/apps/chatrooms/views.py`, `frontend/src/pages/ChatRoomPage.tsx`

- [ ] **AI Chat — verify after Gemini model fix**
  - Test: send message, get response, conversation history
  - Verify: curriculum context injection works for students
  - Files: `backend/apps/ai_assistant/views.py`, `frontend/src/pages/AIChatPage.tsx`

- [ ] **Notifications — verify broadcast + read flow**
  - Check: teacher/admin can send, students receive, mark read
  - Check: attachment upload + view works
  - Files: `backend/apps/notifications/views.py`, `frontend/src/pages/NotificationsPage.tsx`

### Priority 3: Missing Features (Required for capstone)

- [ ] **Push Notifications (Browser + PWA)**
  - Backend: VAPID key generation, subscription storage, push delivery
  - Frontend: Service worker push handler (already has placeholder in sw.js)
  - Trigger on: new notification broadcast, live session started, assessment published
  - New model: `PushSubscription(user, endpoint, p256dh, auth, created_at)`
  - Use: `pywebpush` library for delivery
  - Files: new in `backend/apps/notifications/`, update `frontend/public/sw.js`, new `frontend/src/services/push.ts`

- [ ] **Offline Content Download**
  - Frontend: Download lesson content (text + small media) to IndexedDB
  - SW: Serve cached lessons when offline
  - UI: "Download for offline" button on lesson list
  - Constraint: Videos NOT downloadable (too large for mobile storage)
  - Text lessons + flashcard decks ARE downloadable
  - Single-session enforcement: offline mode is read-only, no new progress PATCH until online
  - Files: new `frontend/src/services/offline.ts`, update `frontend/public/sw.js`

- [ ] **Multi-device logout notification**
  - When SingleActiveSessionMiddleware forces logout, the old device should see a message
  - Currently: silently logs out on next request
  - Fix: Add a "kicked" reason to the logout redirect
  - Frontend: Show "You were logged out because your account was signed in on another device"
  - Files: `backend/apps/accounts/middleware.py`, `frontend/src/auth/AuthContext.tsx`

### Priority 4: Improvements (Nice-to-have for demo)

- [ ] **Profile completion flow polish**
  - Required: first_name, last_name, email, mobile_primary
  - Optional: middle_name, mobile_secondary
  - Redirect to /complete-profile after first login if profile_complete=False
  - Files: `frontend/src/pages/CompleteProfilePage.tsx`, `frontend/src/auth/RoleBasedRedirect.tsx`

- [ ] **Resend OTP button + countdown timer**
  - VerifyOtpPage: show "Resend OTP" after 60s countdown
  - Backend: clear old OTP, generate new, send
  - Files: `frontend/src/pages/VerifyOtpPage.tsx`, `backend/apps/accounts/views.py`

- [ ] **Login identifier improvements**
  - Current: username/password
  - Issue: siblings at same school create collisions with email login
  - Comment: Consider mobile_primary + OTP as primary login for all roles
  - Comment: public_id (UUID) not user-memorable — generate short readable IDs
  - Action: Add comments in code for post-capstone work

- [ ] **Upstash QStash integration for background tasks**
  - Scheduled assessment reminders
  - Daily streak reset notifications
  - Weekly progress summary emails
  - Files: new `backend/apps/notifications/tasks.py`

---

## Session 3 — Push Notifications + Offline

(After Session 2 bugs are fixed)

- [ ] VAPID key setup + PushSubscription model
- [ ] Browser notification permission request UI
- [ ] Push delivery on broadcast, live session, assessment publish
- [ ] Offline lesson download to IndexedDB
- [ ] Offline flashcard study mode
- [ ] SW cache strategy for downloaded content

---

## Session 4 — Polish & Demo Prep

- [ ] Multi-device logout message
- [ ] Profile completion redirect
- [ ] Resend OTP with countdown
- [ ] QStash scheduled tasks
- [ ] Performance: reduce notification payload size (currently 26KB!)
- [ ] Performance: paginate notifications
- [ ] Final audit: all 30 pages load correctly for each role

---

## Notes

- UI polish is LAST PRIORITY — functionality first
- Every fix must be complete, copy-pasteable files — no partial patches
- Test against Render deployment after every push
- Sentry will capture production errors after DEBUG=False
- Always check Render logs for new errors after deploy
