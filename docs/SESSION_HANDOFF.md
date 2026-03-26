# GyanGrit — Session Handoff (2026-03-26)

Paste this at the start of a new Opus chat to resume where we left off.

---

## What was just completed (push this first!)

```bash
cd /Users/veera/PycharmProjects/GyanGrit
git add .
git commit -m "feat: bell notifications, school filter, student mic/camera, chunk defense"
git push
```

### Files changed (on disk, ready to push):
- `frontend/src/components/ChunkErrorBoundary.tsx` — NEW: global error boundary for stale chunk 404s
- `frontend/src/main.tsx` — ChunkErrorBoundary wrapper + vite:preloadError listener
- `frontend/src/app/router.tsx` — lazyRetry() on all 35 lazy imports
- `frontend/src/auth/AuthContext.tsx` — Ably authCallback with `as any` (TS2769 fix)
- `frontend/src/pages/LiveSessionPage.tsx` — school filter dropdown, student mic/camera ControlBar, error UX
- `frontend/src/pages/CompetitionRoomPage.tsx` — section dropdown for ADMIN
- `frontend/src/pages/LoginPage.tsx` — Safari ITP warning banner
- `frontend/public/sw.js` — notification click full URL + client.navigate
- `backend/apps/livesessions/views.py` — `_notify_students_inapp` (creates Broadcast + Notification + push), `canPublish=true` for all users
- `backend/apps/notifications/views.py` — `from django.conf import settings` fix
- `backend/apps/academics/views.py` — `my_assignments` supports PRINCIPAL/ADMIN
- `backend/apps/chatrooms/views.py` — students reply-only in chat rooms (confirmed)

---

## What needs to be done next (this session's work)

### 1. Excalidraw whiteboard in live sessions
- Embed `@excalidraw/excalidraw` React component in LiveSessionPage
- Teacher draws, students see (read-only for students, or collaborative)
- Use LiveKit data channels to sync whiteboard state between participants
- NPM package: `@excalidraw/excalidraw`

### 2. Hand raise in live sessions
- Student clicks "Raise Hand" button → sends LiveKit data message
- Teacher sees raised hands list → can acknowledge/dismiss
- Use `room.localParticipant.publishData()` for signaling

### 3. In-room chat for live sessions
- Ably channel per live session: `livesession:{sessionId}`
- Simple text chat panel alongside the video
- Both teacher and students can type
- Different from ChatRoomPage — this is ephemeral session chat

### 4. Screen share for students (admin-controlled)
- Students already have `canPublish: true` in LiveKit token
- Add screen share button to student ControlBar
- Teacher/admin can toggle who is allowed to share (future: data channel permission)

### 5. Admin chat rooms grouped by school
- AdminChatManagementPage: group rooms by `institution_name`
- Collapsible sections: "Govt Senior Secondary School Amritsar" → rooms under it

### 6. Notification incremental fetch
- Backend: add `?since=<iso_timestamp>` param to `/notifications/` endpoint
- Frontend: after first full fetch, only fetch new notifications since last fetch timestamp
- Reduces payload from 5KB every 30s to near-zero most of the time

### 7. Gemini rate limit handling
- Current error: `429 Too Many Requests` — free tier is 15 req/min
- Add retry with backoff in `_call_gemini()`
- Show user-friendly "AI is busy, please wait a moment" instead of generic error
- System prompt already restricts to curriculum-only (confirmed working)

### 8. ASUS ROG as server deployment doc
- Create `docs/LOCAL_SERVER_DEPLOYMENT.md`
- Steps: Ubuntu Server install, Docker, Nginx reverse proxy, Let's Encrypt SSL, port forwarding, dynamic DNS

---

## Key context for the new session

### Tech stack
- Django 4.2 + React 18/Vite/TypeScript + PostgreSQL (Supabase) + custom CSS
- Deploy: Render (backend Singapore) + Vercel (frontend)
- Real-time: Ably (chat, notifications) + LiveKit (video)
- Domain: gyangrit.site (Namecheap → Vercel)

### Source of truth files
- `GYANGRIT_CLAUDE_INSTRUCTIONS.md` in project knowledge (system prompt)
- `docs/DATA_MODEL.md` — all models
- `docs/API_AND_FRONTEND_END_POINTS.md` — all endpoints
- `todo` file at project root — bug tracker

### Current env vars (Render)
- GEMINI_API_KEY=(new key, 429 rate limit)
- LIVEKIT_URL=
- ABLY_API_KEY=

### LiveKit current state
- Teacher: canPublish=true, video starts OFF, audio ON
- Student: canPublish=true (just changed), video OFF, audio OFF, can toggle via ControlBar
- Token generation: PyJWT, 4-hour expiry, room name = `gyangrit-{section_id}-{uuid}`

### Important patterns
- All CSS in `src/index.css` — custom properties, no Tailwind
- Session auth with `gyangrit_sessionid` cookie, CSRF via `gyangrit_csrftoken`
- Every view uses `@require_auth` or `@require_roles()`
- `scope_queryset()` on every list endpoint
- Push: VAPID + pywebpush, subscriber auto-enrolled in AuthContext

### Veera's working style
- Communicates directly, flags sloppy work immediately
- Expects complete files, no partial patches
- Read SKILL.md files before starting any domain task
- Read the todo file at `/Users/veera/PycharmProjects/GyanGrit/todo` for current bugs
- Read `docs/tasks_opus4.6.md` for session history
