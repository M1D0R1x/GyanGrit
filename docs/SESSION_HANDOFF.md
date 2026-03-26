# GyanGrit — Session Handoff (2026-03-26, Session 7)

Paste this at the start of a new Opus chat to resume where we left off.

---

## What was just completed

### Session 7 — Live session features + fixes + deployment doc

**Live Session upgrades (all via LiveKit data channels, zero extra API cost):**
- Excalidraw whiteboard: teacher draws, students see read-only. Lazy-loaded (~1.5MB). State synced via data channel with 200ms throttle. Students auto-open whiteboard when teacher starts drawing.
- Hand raise: student clicks → data message → teacher sees raised hands panel → acknowledges → student's hand auto-lowers.
- In-room ephemeral chat: text messages via data channel, 100-msg buffer, not persisted.
- Screen share: enabled for all participants (teacher + student).

**Gemini AI chatbot:**
- 429 retry with exponential backoff (2s → 4s → 8s), 3 retries
- Also retries on timeout and connection errors
- User-friendly rate limit message

**Notifications:**
- Backend: `?since=<ISO datetime>` param on `/notifications/` for incremental fetch
- Frontend: TopBar polls only for new notifications after initial load (near-zero payload on quiet periods)
- QStash scheduled reminders: 15min and 5min before live sessions, sends push + in-app

**TypeScript / ESLint fixes:**
- TS2503: Ably namespace → top-level `import type { TokenParams, ErrorInfo, TokenDetails, TokenRequest } from "ably"`
- TS2339: `full_name` → `display_name` (matches UserProfile type)
- TS2345: SectionItem type with optional institution fields
- TS2307: Excalidraw v0.18.0 type paths
- ESLint setState-in-effect: requestAnimationFrame + ref guard
- ESLint no-explicit-any: all three Ably `any` casts replaced with proper types

**Documentation:**
- `docs/LOCAL_SERVER_DEPLOYMENT.md` — full guide for self-hosting on ASUS ROG / any Ubuntu box with Docker, Nginx, SSL, DDNS, backups

### Files changed:
- `backend/apps/ai_assistant/views.py` — Gemini retry logic
- `backend/apps/livesessions/views.py` — QStash reminders + remind webhook
- `backend/apps/livesessions/api/v1/urls.py` — `/remind/` route
- `backend/apps/notifications/views.py` — `?since=` incremental fetch
- `backend/gyangrit/settings/base.py` — QSTASH_TOKEN + BACKEND_BASE_URL
- `frontend/src/auth/AuthContext.tsx` — Ably types fix
- `frontend/src/pages/LiveSessionPage.tsx` — full rewrite with whiteboard, hand raise, chat, screen share
- `frontend/src/components/Whiteboard.tsx` — NEW: Excalidraw wrapper
- `frontend/src/components/TopBar.tsx` — incremental notification fetch
- `frontend/src/services/notifications.ts` — `since` param
- `frontend/src/index.css` — ~270 lines live session + whiteboard CSS
- `docs/LOCAL_SERVER_DEPLOYMENT.md` — NEW: self-hosting guide
- `todo` — updated with all resolved bugs and completed features

---

## Current state

All 8 items from the previous handoff are complete:
1. ✅ Excalidraw whiteboard
2. ✅ Hand raise
3. ✅ In-room chat
4. ✅ Screen share
5. ✅ Admin chat rooms grouped by school (was already done)
6. ✅ Notification incremental fetch
7. ✅ Gemini 429 retry
8. ✅ ASUS ROG deployment doc

### Open bugs (not code issues):
- Gemini API key blocked — Veera must regenerate at aistudio.google.com
- Push on friend's Chrome — user must click Allow on permission prompt

### Remaining post-capstone features:
- Metrics collection (engagement, watch time)
- Offline sync for lesson content
- QStash signature verification on remind endpoint

---

## Push command

```bash
cd /Users/veera/PycharmProjects/GyanGrit
git add .
git commit -m "feat: whiteboard, hand raise, chat, reminders, deployment doc

Live sessions:
- Excalidraw whiteboard (lazy-loaded, LiveKit data channel sync)
- Hand raise (data channel: raise/ack protocol)
- In-room ephemeral chat (data channel, 100-msg buffer)
- Screen share for all participants
- QStash scheduled reminders (15min + 5min before session)

Backend:
- Gemini 429 retry with exponential backoff (3 retries)
- Notification incremental fetch (?since= param)
- /live/sessions/<id>/remind/ webhook for QStash
- QSTASH_TOKEN + BACKEND_BASE_URL settings

Frontend:
- Whiteboard.tsx component (Excalidraw v0.18.0)
- LiveSessionPage full rewrite with all features
- TopBar incremental notification polling
- AuthContext Ably types fixed (no more any casts)
- 270 lines live session CSS

Docs:
- LOCAL_SERVER_DEPLOYMENT.md (Docker, Nginx, SSL, DDNS)
- Updated todo with all resolved items"

git push
```

---

## Key context

### Tech stack
- Django 4.2 + React 18/Vite/TypeScript + PostgreSQL (Supabase) + custom CSS
- Deploy: Render (backend Singapore) + Vercel (frontend)
- Real-time: Ably (chat, notifications) + LiveKit (video + data channels)
- Scheduled tasks: QStash (Upstash)
- Domain: gyangrit.site (Namecheap → Vercel)

### NPM dependency added this session
- `@excalidraw/excalidraw@0.18.0` — whiteboard component

### Render env vars to set
- `BACKEND_BASE_URL=https://gyangrit.onrender.com` (used by QStash reminder scheduler)
- `GEMINI_API_KEY` — needs regeneration (current key is blocked)
