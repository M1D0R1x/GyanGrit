# GyanGrit — Master Work Tracker

> **Purpose:** Single source of truth for all work across conversations.
> **Last updated:** 2026-04-04
> **Database:** Supabase PostgreSQL (both dev and prod)
> **AI Chain:** Groq (llama-3.3-70b) → Together AI (Llama-4-Maverick) → Gemini 2.0 Flash
> **Stack:** Django 4.2 · React 19 + Vite + TS · PostgreSQL (Supabase) · Ably · LiveKit · Cloudflare R2 · Upstash Redis · Sentry
> **Server:** Oracle Cloud Mumbai (aarch64, Ubuntu 24.04, nginx + gunicorn)
> **Frontend:** Vercel (Mumbai edge)
> **Design system:** Glassmorphism (Sora + DM Sans fonts, CSS custom properties)
> **Design skills:** EMILUI_SKILL.md (Emil Kowalski animation philosophy), NEEFE_SKILL.md (Nefee atomic design tokens)

---

## BSRS COMPLIANCE STATUS

All 13 Functional Requirements ✅ complete. See below for remaining work.

---

## 🔴 ACTIVE WORK QUEUE — Prioritised

### Phase 1: Offline-First Infrastructure (BSRS §6) — HIGH PRIORITY
> Critical for rural deployment. Students have intermittent connectivity.

- [x] **IndexedDB storage layer** — `src/services/offline.ts` (v2)
  - [x] IndexedDB wrapper for lessons, exercises, flashcards, PDFs, videos
  - [x] Schema: `lessons`, `flashcards`, `pdfs`, `videos`, `assessments`, `offline_queue`, `meta` stores
  - [x] Storage quota management (Navigator.storage API)
- [x] **Offline download UI** — DownloadManager component
  - [x] Download progress indicator with cancel option
  - [x] Downloaded content indicator (checkmark badge)
  - [ ] Storage usage dashboard in Profile page
  - [ ] Bulk download by course/subject
- [x] **Offline exercise sync queue** — Complete assessments/flashcards offline
  - [x] `offline_queue` store: `{ type, payload, timestamp, synced }`
  - [x] Background sync on reconnect (navigator.onLine + visibilitychange)
  - [x] Conflict resolution: server timestamp wins
  - [x] Visual indicator: OfflineStatusBar with pending count
- [ ] **Video offline downloads** — Save MP4/HLS segments to IndexedDB
  - [x] Streaming download with progress callback
  - [ ] Low-res variant selection (240p/360p for storage efficiency)
  - [ ] Streaming from IndexedDB when offline
  - [ ] Auto-cleanup of watched+old downloads
- [x] **PDF offline downloads** — Cache PDFs in IndexedDB
- [x] **Lesson content offline** — Cache text/markdown content
- [ ] **Adaptive HLS streaming** — Multi-bitrate transcoding pipeline
  - [ ] FFmpeg worker service for auto-transcoding uploads
  - [ ] 240p/360p/480p/720p HLS output
  - [ ] Auto-select bitrate based on `navigator.connection.effectiveType`
- [ ] **Audio-only fallback in live sessions**
  - [ ] Detect 2G/slow-3G connection → auto-disable video track
  - [ ] "Audio only" toggle button in live room
  - [ ] Lower bandwidth LiveKit track settings for slow connections
- [x] **Service Worker upgrade** — Enhanced `sw.js` (v3)
  - [ ] Cache lesson metadata for offline browse
  - [ ] Queue API POST requests when offline (assessment submissions, flashcard reviews)
  - [x] Background sync API (`SyncManager`) — SW triggers client-side queue processing

---

### Phase 2: Redis & Real-time Infrastructure
> Redis is configured but only used for sessions. Zero application cache.

- [ ] **Application-level Redis caching**
  - [ ] Add Redis config to `dev.py` (mirror prod.py setup)
  - [ ] Cache leaderboard rankings (5 min TTL)
  - [ ] Cache subject lists (10 min TTL)
  - [ ] Cache course lists per grade (10 min TTL)
  - [ ] Cache dashboard stats (5 min TTL)
  - [ ] Cache section lists (10 min TTL)
  - [ ] Use `cache_page()` decorator for read-heavy endpoints
- [ ] **WebSocket push for session enforcement** (BSRS §5)
  - [ ] Redis-keyed `user:{id}:session` records
  - [ ] Push "logout" event to old session on concurrent login
  - [ ] Graceful UI: "You were logged out because your account was used on another device"

---

### Phase 3: Chatbot & AI Improvements (BSRS §8)
> Currently: Groq → Together → Gemini fallback chain. No vector DB.

- [ ] **Chatbot offline FAQ** — Cache common Q&A pairs in IndexedDB
  - [ ] Pre-populate with top-20 curriculum questions per subject
  - [ ] Show cached answers when offline, mark as "offline answer"
- [ ] **Teacher escalation** — Route unanswered queries to teacher queue
  - [ ] "Ask Teacher" button when AI answer is unsatisfying
  - [ ] Creates a notification for the teacher with student question + AI response
  - [ ] Teacher can reply via chat or notification
- [ ] **Better RAG context** — Improve curriculum injection
  - [ ] Include lesson content text (not just titles) - expand `MAX_CONTEXT`
  - [ ] Subject-scoped context (only relevant subject for conversation)
  - [ ] Consider Upstash Vector for semantic search (post-capstone)
- [ ] **AI Tools enhancements**
  - [ ] Assessment auto-generation from lesson content
  - [ ] Flashcard auto-generation from lesson content
  - [ ] Lesson summary generation

---

### Phase 4: Video Processing Pipeline (BSRS §9)
> Currently: manual upload only, no auto-transcoding.

- [ ] **FFmpeg transcoding service**
  - [ ] Management command: `transcode_video` — takes uploaded MP4, outputs HLS
  - [ ] Multiple bitrates: 240p, 360p, 480p, 720p
  - [ ] Upload HLS segments + manifest to R2
  - [ ] Update lesson `hls_manifest_url` on completion
- [ ] **Thumbnail generation**
  - [ ] Extract poster frame from first 5 seconds
  - [ ] Upload thumbnail to R2, set `thumbnail_url`
  - [ ] Use as `poster` on `<video>` elements
- [ ] **Recording thumbnails** — Same pipeline for live session recordings

---

### Phase 5: Analytics Pipeline (BSRS §10)
> Currently: Django ORM queries. No stream processing.

- [ ] **Event tracking model** — `AnalyticsEvent` table
  - [ ] Track: lesson_view, lesson_complete, assessment_start, assessment_submit, login, live_session_join
  - [ ] Fields: user_id, event_type, metadata (JSON), created_at
- [ ] **Real-time teacher dashboard**
  - [ ] Live student count per session
  - [ ] Class engagement metrics (active vs idle)
  - [ ] Assessment completion rates with trend lines
- [ ] **Student recording analytics** — Track video watch duration
  - [ ] `RecordingView` model: student, recording, watched_duration, total_duration
  - [ ] "X students watched" on teacher recording list
  - [ ] "Rahul hasn't watched Photosynthesis" alerts

---

### Phase 6: Scalability & Infrastructure (NFR-03)

- [ ] **Auto-sync stale recordings** — Background task
  - [ ] Find recordings with `recording_status=processing` older than 10 min
  - [ ] Auto-run R2 head_object check
  - [ ] Celery beat or management command cron
- [ ] **Rate limiting** — Django REST framework throttling
  - [ ] Public endpoints: 60/min
  - [ ] Authenticated: 120/min
  - [ ] AI chat: 10/min (already implemented in Redis)
- [ ] **CI/CD test stage** — Add tests to deploy pipeline
  - [ ] Django test runner in GitHub Actions
  - [ ] TypeScript type check (`tsc --noEmit`)
- [ ] **Health endpoint improvements**
  - [ ] R2 connectivity check
  - [ ] Redis connectivity check
  - [ ] LiveKit API check
  - [ ] Version/commit hash in response

---

### Phase 7: Security Hardening (BSRS §11)

- [ ] **Rate limiting on all public endpoints** (see Phase 6)
- [ ] **Periodic attendance checks** — In-session interaction prompts
  - [ ] Random "Are you still here?" modal during live sessions
  - [ ] Mark attendance only for students who responded
- [ ] **Security headers audit**
  - [ ] CSP headers
  - [ ] Referrer-Policy
  - [ ] Permissions-Policy
- [ ] **Input validation audit** — Ensure all user inputs are validated server-side

---

### Phase 8: Feature Enhancements (Beyond BSRS)

- [ ] **Parent Portal** — Read-only view of child's progress
  - [ ] New PARENT role
  - [ ] Linked to student account
  - [ ] View: grades, attendance, lesson progress, badges
- [ ] **Multi-language UI** — Hindi/Punjabi/English i18n
  - [ ] `react-intl` or `react-i18next`
  - [ ] Translation files for all UI strings
  - [ ] Language selector in profile/settings
- [ ] **Search** — Full-text search across courses, lessons, assessments
  - [ ] Django search (PostgreSQL full-text) or Upstash Search
  - [ ] Global search bar in TopBar
  - [ ] Search results page with filters
- [ ] **Monitoring** — Beyond Sentry
  - [ ] QStash health check every 5 min ✅ (endpoint ready)
  - [ ] Uptime monitoring dashboard
  - [ ] Performance metrics collection

---

## ✅ COMPLETED WORK

### All 13 Functional Requirements — DONE
| FR | Requirement | Status |
|---|---|---|
| FR-01 – FR-13 | All | ✅ Complete |

### Infrastructure
- [x] LiveKit live sessions with whiteboard, hand raises, chat
- [x] Recording pipeline (LiveKit Egress → R2)
- [x] Cloudflare R2 media storage
- [x] Upstash Redis (sessions only)
- [x] Sentry error tracking
- [x] Health endpoint with DB check (`/api/v1/health/`)
- [x] Nginx redirect loop fix (X-Forwarded-Proto on health endpoint)
- [x] QStash-ready health endpoint (GET/POST/HEAD, returns 200/503)
- [x] Oracle Cloud deployment with GitHub Actions CI/CD
- [x] Vercel frontend deployment with immutable caching
- [x] Zoho email for OTP delivery
- [x] PWA with service worker shell caching

### Apps (18 Django apps)
- [x] accounts, academics, accesscontrol, content, learning
- [x] assessments, roster, gamification, notifications, media
- [x] ai_assistant, chatrooms, competitions, flashcards, gradebook
- [x] livesessions, analytics

### Frontend (48 pages)
- [x] All 5 role dashboards
- [x] All content, assessment, flashcard, chat, live session pages
- [x] Glassmorphism design system (dark/light mode)
- [x] Bottom navigation for students
- [x] Notification panel with attachments

### Recent Fixes (2026-04-04)
- [x] Removed manual "Sync from R2" button
- [x] Date format fix (full → medium)
- [x] Recording indicator (pulsing red "REC" badge)
- [x] Error message HTML sanitization
- [x] Health endpoint enhanced with DB check
- [x] Nginx X-Forwarded-Proto fix for health endpoint
- [x] ISSUES.md cleaned — only open issues remain

---

## ARCHITECTURE DECISIONS

| Decision | Rationale | Date |
|---|---|---|
| Groq → Together → Gemini chain | Free tiers, rate limit mitigation | 2026-04-02 |
| No Docker (for now) | Single server, systemd sufficient | 2026-04-04 |
| IndexedDB for offline (planned) | Better than localStorage for structured data | 2026-04-04 |
| Redis for caching (planned) | Already deployed, just needs app-level usage | 2026-04-04 |
| No vector DB (for now) | Gemini 1M context + simple injection works | 2026-04-02 |
| Oracle Cloud over Render | Free tier, Mumbai region, more resources | 2026-04-02 |

---

## DESIGN REFERENCES

- **EMILUI_SKILL.md** — Emil Kowalski UI philosophy: animation decision framework, easing curves, perceived performance, button press feedback, origin-aware popovers, stagger animations, `prefers-reduced-motion`
- **NEEFE_SKILL.md** — Nefee atomic design system: glassmorphism recipe, color tokens, typography scale (Inter), spacing/radius, button variants, input fields, toast messages, modal patterns, z-index scale
- **Current GyanGrit design:** Sora (headings) + DM Sans (body), CSS custom properties in `index.css`, glassmorphism with `backdrop-filter: blur()`, role-based colors

---

## HOW TO PICK UP WHERE LEFT OFF

1. Read this file first
2. Check `ISSUES.md` for open bugs
3. Check Phase 1-8 above for the next unchecked item
4. Read relevant backend files in `backend/apps/` and frontend files in `frontend/src/`
5. Reference `.claude/SYSTEM_ARCHITECTURE_AND_DESIGN_DOCUMENTATION.md` for architecture
6. Reference `.claude/DATA_MODEL.md` for database schema
7. Reference `.claude/API_AND_FRONTEND_END_POINTS.md` for API contracts
