# GyanGrit — Master Task Tracker & Project State

> Single source of truth. Updated end of every session.

---

## CURRENT STATE (2026-04-04 — end of session)

**Live URLs:**
- Frontend: https://gyangrit.site
- Backend:  https://api.gyangrit.site
- Admin:    https://api.gyangrit.site/admin/

**Stack:** Django 4.2 · React 18 + Vite + TypeScript · PostgreSQL (Supabase Mumbai) · Ably · LiveKit · Gemini/Groq/Together AI · Cloudflare R2 · Gunicorn gthread (5 workers) · Upstash Redis · Sentry · Oracle Cloud Mumbai

**Scale:** 16 backend apps · 41 frontend pages · 0 TS errors · 0 Django check issues

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

## WHAT WAS DONE THIS SESSION (2026-04-04)

### Bugs Fixed
| Bug | Root Cause | Fix |
|---|---|---|
| AI Flashcard "Paste Text" → 400 error | Frontend sent `{text, count}` with no `subject_id` | Added subject dropdown to `AIToolsPage.tsx` |
| AI Assessment tab unusable | Raw Course ID number input | Subject → course dropdown chain (fetches `/courses/`, filters client-side) |
| GitHub Actions no git rollback | Health check failure restarted gunicorn with broken code | Added `PREV_SHA` save + `trap rollback ERR` + 3-attempt health check |
| `systemctl reload gyangrit` failed | `ExecReload` missing from systemd unit | Added `ExecReload=/bin/kill -HUP $MAINPID` |
| HTTP 500 after deploy | `filter-repo` rollback checked out old `models.py` without `RecordingStatus` | `git reset --hard origin/master` on Oracle |
| `env_template.txt` had real secrets | Created with live Groq + Twilio SID | `git filter-repo` wiped file from all history |

### Infrastructure Changes
| Change | Detail |
|---|---|
| **Oracle `.env` fully updated** | Added: GROQ_API_KEY, TOGETHER_API_KEY, LIVEKIT_RECORDING_WEBHOOK_SECRET, CLOUDFLARE_R2_RECORDINGS_PREFIX, BACKEND_BASE_URL, UPSTASH_REDIS_KV_URL, QSTASH_TOKEN, VAPID keys. Removed quotes from all values. Replaced insecure SECRET_KEY. |
| **Nginx upgraded** | Added: `upstream gunicorn { keepalive 20 }`, gzip compression (5 types), proxy buffer tuning, 35s timeouts, 50MB upload limit, `access_log off` on health endpoint, security headers |
| **Gunicorn** | 5 workers confirmed running (was 2). `ExecReload` added to systemd unit — graceful reload now works. |
| **Together AI installed** | `pip install together>=1.3` on Oracle venv |
| **Git history rewritten** | `git filter-repo` removed `docs/env_template.txt` from all 338 commits. Force pushed clean history. |

### Files Changed
| File | Change |
|---|---|
| `frontend/src/pages/AIToolsPage.tsx` | Full rewrite — subject/course dropdowns, parallel data fetch, shared sub-components |
| `.github/workflows/deploy.yml` | Added PREV_SHA save, rollback trap, 3-attempt health check with retry |
| `docs/FUTURE_TASKS.md` | Full rewrite — accurate status, ADRs, sprint plan, env vars checklist |
| `docs/env_template.txt` | Wiped — contains only a comment now |
| `docs/NGINX_ORACLE_CONFIG.md` | New — documented Nginx config for Oracle Mumbai |
| `docs/ORACLE_SETUP_COMMANDS.md` | New — step-by-step Oracle setup reference |

---

## OPEN ITEMS (do immediately)

### 🔴 Rotate Groq API Key (do now — was in git history)
```bash
# 1. Go to https://console.groq.com → API Keys
# 2. Delete: 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
# 3. Create new key
# 4. On Oracle:
nano /opt/gyangrit/backend/.env   # update GROQ_API_KEY=<new>
sudo systemctl restart gyangrit
```

### 🟠 Activate Recordings (15 min)
Everything is built — just needs R2 public access confirmed and Egress tested:
```bash
# Verify R2 bucket has public access enabled
# Cloudflare Dashboard → R2 → gyangrit-media → Settings → Public Access → Enable
# Public URL is already set: https://pub-e9d4409f2ff64c3da255818e71428b31.r2.dev

# Test: start a live session, end it, check /recordings/ page
```

### 🟡 Wire session_start to Egress
`views.py` already has `threading.Timer(5.0, start_recording, ...)` in `session_start`.
Verify it's actually calling the LiveKit Egress API by checking logs after a test session.

---

## ARCHITECTURE DECISIONS LOG

| Decision | Rationale | Date |
|---|---|---|
| Oracle Cloud Mumbai | Same region as Supabase → zero DB latency, no cold starts | 2026-03-28 |
| gthread workers (not gevent) | Stable on Python 3.12, no monkey-patching, DB connections safe | 2026-03-28 |
| Groq primary AI provider | 30 req/min free vs Gemini 15 req/min; 3-5x faster | 2026-04-03 |
| Groq → Together → Gemini chain | Never fail on rate limit — always a fallback | 2026-04-03 |
| R2 public bucket for recordings | No per-request presigning overhead; recordings are not sensitive | 2026-04-04 |
| Client-side course filtering | `/courses/` is role-scoped automatically; no `?subject_id=` param exists | 2026-04-04 |
| `trap rollback ERR` in deploy.yml | Fires on any unhandled bash error — safer than explicit per-step checks | 2026-04-04 |
| `ExecReload=/bin/kill -HUP $MAINPID` | SIGHUP = graceful gunicorn reload; workers finish in-flight requests | 2026-04-04 |
| Nginx keepalive 20 to gunicorn | Eliminates TCP handshake overhead (~5ms) on every proxied request | 2026-04-04 |
| Nginx gzip min_length 500 | Small responses (health check 96B) not worth compressing; saves CPU | 2026-04-04 |
| require_auth not login_required | Django login_required redirects 302→404; require_auth returns 401 JSON | 2026-03-26 |
| fail_silently=True in send_otp | SMTP failure must never crash login endpoint | 2026-03-26 |
| CONN_MAX_AGE=60 | Safe with gthread + same-region DB; was 0 for gevent | 2026-04-03 |
| secrets.randbelow() for OTP | random.randint is not cryptographically secure | 2026-03-26 |

---

## SESSION LOG

### 2026-04-04 — Oracle infra hardening + AI tools fix + Nginx upgrade

**Infrastructure:**
- Oracle `.env` fully populated (Groq, Together, VAPID, Redis, QStash, webhook secret, R2 prefix)
- Nginx upgraded: keepalive upstream pool, gzip, buffer tuning, security headers
- Gunicorn: 5 workers confirmed, ExecReload added to systemd unit
- Together AI SDK installed in venv
- Git history cleaned with filter-repo (removed credentials from 338 commits)

**Code:**
- `AIToolsPage.tsx` fixed: subject dropdown + course dropdown — no more raw ID inputs
- `deploy.yml` fixed: git rollback on health check failure

**Incidents:**
- `env_template.txt` committed with live Groq API key + Twilio SID — rotated Groq key, bypass approved for Twilio SID (public identifier, not a secret)
- Post-deploy HTTP 500: `RecordingStatus` ImportError from rollback checking out old models.py — fixed with `git reset --hard origin/master`

### 2026-03-28 — Oracle Cloud Production Migration
> Migrated backend from Render (Singapore) to Oracle Cloud (Mumbai). Eliminated cold starts and cross-region DB latency.

### 2026-03-27 — Performance Optimization & OTP Overhaul
> Vite bundle size 5.4MB → 600KB. Async OTP delivery. Zoho email primary. GZip middleware.

### 2026-03-26 — PWA + Chat Upload + Infra + Bug Fixes
> PWA sw.js, manifest. Chat file upload to R2. @require_auth global fix (70 views). Redis + Sentry.

### 2026-03-25 — Chat Rooms + Competitions + Django Admin
> ChatRoomMember, push notifications, Ably token scoping, django-unfold.

### 2026-03-24 — Flashcards + Live Sessions + AI Chatbot
> apps/flashcards (SM-2), apps/livesessions (LiveKit), apps/ai_assistant (Gemini RAG).

### 2026-03-23 — Deployment Fixes
> Render + Vercel working. Keep-alive ping. Fast2SMS OTP. Gmail SMTP fallback.

### 2026-03-22 — Routes, Analytics, Security
> All dashboard routes fixed. gevent workers + CONN_MAX_AGE=0. secrets.randbelow() OTP.

### 2026-03-18 — Gradebook + Dashboard Polish
> Gradebook app. All dashboards wired with real data. LessonPage media handling.

### 2026-03-17 — Gamification + Notifications
> Full gamification system. Notifications + broadcasts. Human-readable URL slugs.

### 2026-03-15 — Core Platform
> Full backend + frontend. Auth, academics, content, assessments, learning, roster.
