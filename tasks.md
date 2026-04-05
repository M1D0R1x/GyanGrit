# GyanGrit — Master Task Tracker & Project State

> Single source of truth. Updated end of every session.

---

## CURRENT STATE (2026-04-05 — All Clear)

**Live URLs:**
- Frontend: https://gyangrit.site
- Backend:  https://api.gyangrit.site
- Admin:    https://api.gyangrit.site/admin/

**Stack:** Django 4.2 · React 18 + Vite + TypeScript · PostgreSQL (Supabase Mumbai) · Ably · LiveKit · Groq/Together/Gemini · Cloudflare R2 · Gunicorn gthread (3 workers × 6 threads) · Upstash Redis · Sentry · Oracle Cloud Mumbai

**Scale:** 16 backend apps · 42 frontend pages · 0 TS errors · 0 Django check issues

---

## SRS COMPLIANCE

| FR | Requirement | Status |
|---|---|---|
| FR-01 | User management, OTP, roles | ✅ |
| FR-02 | Single-device sessions | ✅ |
| FR-03 | Content management | ✅ |
| FR-04 | Adaptive streaming (HLS) | ✅ |
| FR-05 | PWA offline | ✅ |
| FR-06 | Exercises & flashcards | ✅ |
| FR-07 | Live sessions + attendance | ✅ |
| FR-08 | Competition rooms | ✅ |
| FR-09 | Progress tracking, badges | ✅ |
| FR-10 | Analytics & reports | ✅ |
| FR-11 | AI Chatbot (RAG) | ✅ |
| FR-12 | Security, RBAC | ✅ |
| FR-13 | API keys in env | ✅ |

**All 13 FRs complete.**

---

## ARCHITECTURE DECISIONS LOG

| Decision | Rationale | Date |
|---|---|---|
| Oracle Cloud Mumbai | Same region as Supabase → zero DB latency, no cold starts | 2026-03-28 |
| gthread workers (not gevent) | Stable on Python 3.12, no monkey-patching, DB connections safe | 2026-03-28 |
| Groq primary AI provider | 30 req/min free vs Gemini 15 req/min; 3-5x faster | 2026-04-03 |
| Groq → Together → Gemini chain | Never fail on rate limit — always a fallback | 2026-04-03 |
| R2 public bucket for recordings | No per-request presigning overhead; recordings are not sensitive | 2026-04-04 |
| `trap rollback ERR` in deploy.yml | Fires on any unhandled bash error — safer than explicit per-step checks | 2026-04-04 |
| `ExecReload=/bin/kill -HUP $MAINPID` | SIGHUP = graceful gunicorn reload; workers finish in-flight requests | 2026-04-04 |
| Nginx keepalive 20 to gunicorn | Eliminates TCP handshake overhead (~5ms) on every proxied request | 2026-04-04 |
| require_auth not login_required | Django login_required redirects 302→404; require_auth returns 401 JSON | 2026-03-26 |
| secrets.randbelow() for OTP | random.randint is not cryptographically secure | 2026-03-26 |
| CONN_MAX_AGE=60 | Safe with gthread + same-region DB; was 0 for gevent | 2026-04-03 |
| Gunicorn 3w × 6t (was 5w × 4t) | Lower memory on 12GB ARM; same concurrency (18 threads) | 2026-04-05 |
| Sentry before_send filter | Drop DisallowedHost noise from bot scanners | 2026-04-05 |
| `.modal` bg = `--bg-canvas` | Glass fill is transparent; modals need opaque base for readability | 2026-04-05 |

---

## SESSION LOG

| Date | Summary |
|---|---|
| 2026-04-05 | Sentry stabilization (4 issues), cache import fix, Gradebook glassmorphism, modal portal fix, contact form API, tasks cleanup |
| 2026-04-04 | Oracle infra hardening, AI tools fix, Nginx upgrade, offline phase 1, audio-only mode, N+1 elimination (12 endpoints) |
| 2026-04-03 | LiveKit Egress wiring, Excalidraw persistence, whiteboard fix |
| 2026-03-28 | Oracle Cloud production migration |
| 2026-03-27 | Performance optimization, OTP overhaul |
| 2026-03-26 | PWA + Chat + Infra + 20 bug fixes |
| 2026-03-25 | Chat Rooms + Competitions + Django Admin |
| 2026-03-24 | Flashcards + Live Sessions + AI Chatbot |
| 2026-03-22 | Routes, Analytics, Security |
| 2026-03-18 | Gradebook + Dashboard Polish |
| 2026-03-17 | Gamification + Notifications |
| 2026-03-15 | Core Platform — Auth, academics, content, assessments |
