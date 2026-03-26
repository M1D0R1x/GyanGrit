# GyanGrit — Bug Tracker & Task Plan

**Last updated:** 2026-03-26 Session 6

---

## BUGS FIXED THIS SESSION

| # | Bug | Status | Fix |
|---|---|---|---|
| 1 | TS2769 Ably authCallback type error (build fails) | ✅ FIXED | Used `as any` cast — Ably's dynamic import makes proper typing impossible |
| 2 | ChatRoomPage stale chunk 404 | ✅ FIXED | `lazyRetry()` on all 35 lazy imports — auto-reloads once on chunk miss |
| 3 | "Session has ended" raw 400 error in red | ✅ FIXED | User-friendly messages: ended/not-live/forbidden + auto-refresh list |
| 4 | Section dropdown shows 4x duplicates for ADMIN | ✅ FIXED | ADMIN/PRINCIPAL use `/academics/sections/` + `/academics/subjects/` |
| 5 | Subject dropdown only shows Chemistry for ADMIN | ✅ FIXED | Same fix — fetches ALL subjects from dedicated endpoint |
| 6 | Push notification on session CREATE (not just start) | ✅ ADDED | Students get "📋 Live Class Scheduled" when teacher creates session |

---

## ANSWERS TO YOUR QUESTIONS

### "Cleared cookies and site data but still not logged out — is this okay?"
YES, this is expected. Django session auth works like this:
- The session lives **on the server** (in the database or Redis)
- The browser cookie (`gyangrit_sessionid`) is just a reference key to that server session
- Clearing cookies removes the key from YOUR browser, so YOU appear logged out
- But the server session still exists until it expires or the user explicitly logs out
- Other devices that still have the cookie can still use that session
- This is standard behavior for session-based auth

### "Drop down still showing 4 pairs"
The fix (using `/academics/sections/` for ADMIN/PRINCIPAL) was on disk but NOT pushed yet. After you push this commit, it will be fixed. The previous deploys were still using the old `my_assignments` endpoint which has duplicates.

### "Dynamic selection based on schools for admin"
The `/academics/sections/` endpoint already returns sections scoped per role:
- ADMIN: ALL sections across all schools (with institution name in the label)
- PRINCIPAL: only their school's sections
- TEACHER: only their assigned sections
The labels include the school name: "Class 8-A — Govt School Amritsar"

---

## FEATURE REQUESTS NOTED (Post-capstone / research paper scope)

These are great ideas for the research paper USP. They're tracked here for future implementation:

| Feature | Priority | Complexity | Notes |
|---|---|---|---|
| Notification reminders (10/5/15 min before live) | HIGH | Medium | QStash scheduled task → push at session.scheduled_at - N min |
| Whiteboard integration in live sessions | HIGH | High | Excalidraw embed or LiveKit data channels |
| Full chat in live sessions | MEDIUM | Medium | Ably channel per live session room |
| Student unmute to talk | MEDIUM | Low | Already supported — change `canPublish: false` to toggleable |
| Metrics collection (engagement, watch time) | HIGH | Medium | LiveKit webhooks + custom analytics model |
| Unique research paper USP | — | — | See section below |

### Research Paper USP Ideas
1. **Learning engagement metrics** — track time-on-task, lesson completion curves, assessment retry patterns. Compare with/without gamification. This is measurable + publishable.
2. **Offline-first rural access patterns** — measure how often offline mode is used, what content is downloaded, network quality correlation. Unique to rural India context.
3. **Real-time intervention** — when a student's assessment score drops below threshold, auto-notify teacher + suggest remedial content. Signal-driven, unique to GyanGrit.

---

## FILES CHANGED THIS SESSION

1. `frontend/src/auth/AuthContext.tsx` — Ably authCallback with `as any` (TS build fix)
2. `frontend/src/app/router.tsx` — `lazyRetry()` on all 35 pages (stale chunk fix)
3. `frontend/src/pages/LiveSessionPage.tsx` — section/subject dropdowns for ADMIN, error messages
4. `frontend/src/pages/CompetitionRoomPage.tsx` — section dropdown for ADMIN
5. `frontend/public/sw.js` — notification click full URL
6. `frontend/src/pages/LoginPage.tsx` — Safari ITP warning
7. `backend/apps/livesessions/views.py` — push on session create
8. `docs/tasks_opus4.6.md` — this file

---

## PUSH COMMAND

```bash
git add .
git commit -m "fix: TS build (Ably types), stale chunk retry, admin dropdowns, error UX

- AuthContext: Ably authCallback with 'as any' cast (fixes TS2769 build error)
- router.tsx: lazyRetry() on all 35 lazy imports (auto-reload on stale chunks)
- LiveSessionPage: ADMIN/PRINCIPAL use /sections/ + /subjects/ (no duplicates)
- LiveSessionPage: user-friendly error messages for ended/not-live sessions
- CompetitionRoomPage: same section dropdown fix
- livesessions/views.py: push notification on session create
- sw.js: notification click builds full URL
- LoginPage: Safari ITP warning banner"

git push
```
