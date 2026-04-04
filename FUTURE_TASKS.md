# GyanGrit — Future Tasks & Technical Roadmap

> **Living document.** Prioritized list of upcoming features, upgrades, and architectural improvements.
> Updated: 2026-04-04 | Backend: Oracle Cloud Mumbai | Frontend: Vercel
>
> Priority tiers: 🔴 P0 (critical) · 🟠 P1 (high) · 🟡 P2 (medium) · 🟢 P3 (nice to have)

---

## ⚡ NEXT SESSION — START HERE

### 🔴 P0 — SECURITY: Leaked GitHub PAT in `.env.example`

`backend/.env.example` contains a live GitHub Personal Access Token as an example clone command.
**Even if the PAT is expired, it must be removed immediately.**

```bash
# Step 1: Revoke it → https://github.com/settings/tokens
# Step 2: Remove it from the file
```
Delete the line containing `github_pat_11BOXMJBI0Y...` from `backend/.env.example`.
No token or credential — even an example — should ever appear in a committed file.

---

### 🟠 P1 — ONE-TIME ORACLE CLOUD TASKS (SSH in once, ~10 minutes)

These require SSH access but unlock recordings and better AI:

```bash
ssh -i ~/Downloads/ssh-key-2026-03-26.key ubuntu@161.118.168.247

# 1. Generate + set the LiveKit recording webhook secret
openssl rand -hex 32
# Copy output → add to /opt/gyangrit/backend/.env:
# LIVEKIT_RECORDING_WEBHOOK_SECRET=<output>

# 2. Install Together AI SDK (fallback AI provider)
source /opt/gyangrit/backend/venv/bin/activate
pip install together>=1.3
pip freeze | grep together   # verify: together==x.x.x

# 3. Verify all AI keys are set in .env
grep -E "GROQ_API_KEY|TOGETHER_API_KEY|GEMINI_API_KEY" /opt/gyangrit/backend/.env

# 4. Verify R2 public URL is set (needed for recording_url to work)
grep CLOUDFLARE_R2_PUBLIC_URL /opt/gyangrit/backend/.env
# Must be set to something like: https://pub-xxxx.r2.dev
# If not set, recordings will save to R2 but recording_url will be empty

# 5. Reload the service to pick up any .env changes
sudo systemctl reload gyangrit
```

---

### 🟡 P2 — VERIFY R2 BUCKET IS PUBLIC (needed for video playback)

Recordings are stored in R2. Students watch them via `recording_url`. This URL
is built as `{CLOUDFLARE_R2_PUBLIC_URL}/{r2_key}`. It only works if:

**Option A — R2 public bucket (easiest):**
1. Cloudflare Dashboard → R2 → `gyangrit-media` → Settings → Public Access
2. Enable "Allow Public Access"
3. Copy the public URL (e.g. `https://pub-xxxx.r2.dev`)
4. Set `CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxxx.r2.dev` in Oracle `.env`

**Option B — Presigned URLs (more secure):**
The `_recording_to_dict()` serializer in `livesessions/views.py` would need to call
`boto3.generate_presigned_url()` per recording (adds ~50ms per list request).
Defer this until scale demands it. For now, Option A is correct.

---

## CURRENT PRODUCTION STATE (as of 2026-04-04)

| Layer | Stack | Status |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript → Vercel | ✅ Live |
| Backend | Django 4.2 + Gunicorn (gthread, 5 workers) → Oracle Cloud Mumbai | ✅ Live |
| Database | PostgreSQL via Supabase (Mumbai) | ✅ Live |
| Real-time | Ably (chat, notifications) + LiveKit (WebRTC) | ✅ Live |
| Media / Recordings | Cloudflare R2 | ✅ Configured — public URL TBD |
| Cache / Sessions | Upstash Redis | ✅ Session store only |
| AI Chatbot | Groq → Together AI → Gemini fallback chain | ✅ Built |
| AI Tools (Flashcards + Assessments) | AIToolsPage.tsx + backend endpoints | ✅ Fixed 2026-04-04 |
| Recordings backend | LiveSession model fields + Egress API + webhook + list/detail endpoints | ✅ Built |
| Recordings frontend | RecordedSessionsPage + RecordingPlayerPage | ✅ Built — needs R2 public URL |
| PWA | App shell cached, IndexedDB for text lessons + flashcards | ⚠️ Partial |
| Background Jobs | QStash configured (keys obtained) | ⚠️ Partial |
| CI/CD | GitHub Actions with git rollback on health check failure | ✅ Fixed 2026-04-04 |

### Oracle Cloud Instance

| Property | Value |
|---|---|
| Region | ap-mumbai-1 |
| Shape | VM.Standard.A1.Flex (ARM64) |
| OCPU | 2 |
| RAM | 12 GB |
| Workers | 5 gthread × 4 threads = 20 concurrent requests |
| Timeout | 30s (same-region DB, no cold starts) |
| DB conn_max_age | 60s (persistent connections safe with gthread + same-region) |
| Public IP | 161.118.168.247 |
| Backend URL | https://api.gyangrit.site |

### Concurrent User Capacity (current)

| Scenario | Comfortable Concurrent Users | Bottleneck |
|---|---|---|
| Current (5 workers × 4 threads) | ~200 | Gunicorn threads |
| + Redis caching on hot endpoints | ~400 | Ably free (100 ws connections) |
| + Ably Starter ($39/mo) | ~1,000 | Gunicorn threads |
| + Scale to 4 OCPU (Oracle free tier allows) | ~2,000 | DB pool |

---

## WHAT WAS CONFIRMED ALREADY DONE (not pending)

These were marked "pending" in old FUTURE_TASKS but are confirmed built and deployed:

| Item | Confirmed Done |
|---|---|
| `gunicorn.conf.py` workers=5, timeout=30, keepalive=75 | ✅ 2026-04-03 |
| `prod.py` conn_max_age=60, gthread workers | ✅ 2026-04-03 |
| `providers.py` Groq → Together AI → Gemini fallback chain | ✅ 2026-04-03 |
| `ratelimit.py` Redis sliding-window rate limiter for AI | ✅ 2026-04-03 |
| AI chatbot using `call_ai()` (not direct Gemini) | ✅ 2026-04-03 |
| `LiveSession` recording fields + migration `0003` | ✅ 2026-04-03 |
| `recording.py` LiveKit Egress + R2 naming convention | ✅ 2026-04-03 |
| `recordings_list` + `recording_detail` views | ✅ 2026-04-03 |
| Recording webhook endpoint | ✅ 2026-04-03 |
| `RecordedSessionsPage.tsx` + `RecordingPlayerPage.tsx` | ✅ 2026-04-03 |
| `recordings.ts` service | ✅ 2026-04-03 |
| `AIToolsPage.tsx` (basic structure) | ✅ 2026-04-03 |
| Flashcard AI backend endpoint + URL wiring | ✅ 2026-04-03 |
| Assessment AI backend endpoint + URL wiring | ✅ 2026-04-03 |
| `FlashcardDeck.Status` draft/published model | ✅ 2026-04-03 |
| `Assessment.Status` draft/published model | ✅ 2026-04-03 |
| GROQ_API_KEY + TOGETHER_API_KEY in base.py | ✅ 2026-04-03 |

## WHAT WAS FIXED THIS SESSION (2026-04-04)

| Fix | Root Cause | File |
|---|---|---|
| AI Flashcard "Paste Text" mode returned 400 | Frontend sent `{text, count}` with no `subject_id` — backend requires it for text mode | `AIToolsPage.tsx` |
| AI Assessment tab unusable | Raw Course ID number input — teachers don't know course IDs | `AIToolsPage.tsx` |
| deploy.yml had no git rollback | Health check failure only restarted gunicorn (still on broken code) | `.github/workflows/deploy.yml` |

**AIToolsPage.tsx changes:**
- Added `useTeacherData()` hook: fetches `/academics/my-assignments/` + `/courses/` in parallel on mount
- Flashcard tab: subject dropdown (required in text mode), auto-inferred in lesson mode
- Assessment tab: subject dropdown → course dropdown (client-side filtered by subject). No more raw ID input.
- Courses fetched once, filtered client-side — no extra round-trips per subject change
- Proper TypeScript types throughout, no `any` casts

**deploy.yml changes:**
- `PREV_SHA=$(git rev-parse HEAD)` saved before pull
- `rollback()` function: `git checkout $PREV_SHA`, re-runs collectstatic with old code, reloads gunicorn
- `trap rollback ERR` — fires automatically on any unhandled error anywhere in the script
- Health check retried 3× with 5s gaps before triggering rollback
- `trap - ERR` disabled after confirmed success (prevents false-positive rollback on cleanup)
- Failure step prints exact SSH + journalctl commands to investigate

---

## SECTION 1 — RECORDINGS: REMAINING WORK

### What's built ✅
- `LiveSession` model: `recording_status`, `recording_r2_key`, `recording_url`, `recording_duration_seconds`, `recording_size_bytes`, `recording_egress_id`
- Migration `0003` applied
- `recording.py`: `start_recording()`, `build_r2_key()`, `verify_webhook_signature()`, `handle_recording_webhook()`
- Views: `recordings_list`, `recording_detail`, `recording_webhook`
- URLs: `GET /live/recordings/`, `GET /live/recordings/<id>/`, `POST /live/recording-webhook/`
- Frontend: `RecordedSessionsPage.tsx`, `RecordingPlayerPage.tsx`, `recordings.ts`

### What's missing ⚠️
1. **R2 public URL not set** → `recording_url` built as `{CLOUDFLARE_R2_PUBLIC_URL}/{r2_key}` — empty if env var not set
2. **`start_recording()` not wired to `session_start`** → recordings never start automatically. Teacher ends the session but Egress was never triggered.
3. **`LIVEKIT_RECORDING_WEBHOOK_SECRET` not set** → webhook currently runs in fail-open mode (logs warning, accepts all)

### Fix for #2 — Wire Egress to session_start view

In `backend/apps/livesessions/views.py`, the `session_start` view sets `session.status = "live"` and saves. Add after that:

```python
# After session.status = SessionStatus.LIVE + session.save():
import threading
from .recording import start_recording
threading.Thread(target=start_recording, args=(session,), daemon=True).start()
logger.info("Recording Egress triggered for session %s", session.public_id)
```

Use `threading.Thread` (fire-and-forget) so the HTTP response is not blocked if Egress API is slow.

---

## SECTION 2 — AI CHATBOT: CONFIRMED WORKING

The full provider chain is built and deployed:
- **Primary**: Groq `llama-3.3-70b-versatile` (30 req/min, 14,400/day free)
- **Fallback**: Together AI `Llama-4-Maverick-17B` ($25 free credit)
- **Last resort**: Gemini `gemini-2.0-flash` (15 req/min free tier)
- Redis rate limiting: 10 req/min per user (prevents one student exhausting Groq)
- Retry on `ProviderRateLimitError`, `Timeout`, `ConnectionError`

**Only remaining risk**: Groq/Together API keys may not be in Oracle `.env`. Verify with:
```bash
grep -E "GROQ|TOGETHER" /opt/gyangrit/backend/.env
```

---

## SECTION 3 — AI TEACHER TOOLS: CONFIRMED WORKING (after fix)

### Flashcard Generator
- Backend: `POST /api/v1/flashcards/ai-generate/` — fully built, URL wired
- Frontend: **Fixed 2026-04-04** — subject dropdown in text mode, proper payload
- Publish: `POST /api/v1/flashcards/ai-generate/<id>/publish/` — notifies students

### Assessment Generator
- Backend: `POST /api/v1/assessments/course/<id>/ai-generate/` — fully built
- Frontend: **Fixed 2026-04-04** — subject → course dropdowns, no raw ID input
- Publish: `PATCH /api/v1/assessments/<id>/update/` with `is_published: true`

### Teacher UI Access
- `/teacher/ai-tools` → Teacher role
- `/principal/ai-tools` → Principal role
- `/admin/ai-tools` → Admin role

---

## SECTION 4 — PWA OFFLINE: REMAINING WORK

### Current state
- ✅ App shell cached (HTML/CSS/JS via service worker)
- ✅ Text lessons saved to IndexedDB (`offline.ts`)
- ✅ Flashcard decks saved to IndexedDB
- ❌ No offline assessment queuing (submit when reconnected)
- ❌ No offline video/PDF downloads
- ❌ No background sync for lesson progress

### Priority fix: Assessment offline queue

Add to `public/sw.js`:
```javascript
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-assessment-submissions') {
    event.waitUntil(flushAssessmentQueue());
  }
});
```

Add to `src/services/offline.ts`:
```typescript
const ASSESSMENT_QUEUE_STORE = 'assessment_queue';
// Store submission when offline, flush when Background Sync fires
```

---

## SECTION 5 — REDIS CACHING: REMAINING WORK

Redis is wired for sessions only. Expand to API response caching for:

| Endpoint | TTL | Cache key |
|---|---|---|
| Leaderboard | 5 min | `leaderboard:{section_id}` |
| Course list | 30 min | `courses:{user_role}:{user_id}` |
| Subject list | 1 hour | `subjects:{section_id}` |
| Analytics summary | 15 min | `analytics:class:{section_id}` |
| Notification count | 30 sec | `notif_count:{user_id}` |

Pattern (already in `prod.py` cache backend):
```python
from django.core.cache import cache

def get_leaderboard(section_id):
    key = f"leaderboard:{section_id}"
    data = cache.get(key)
    if data is None:
        data = _compute_leaderboard(section_id)
        cache.set(key, data, timeout=300)
    return data
```

---

## SECTION 6 — ANALYTICS & RISK AI: NOT STARTED

Full spec in original FUTURE_TASKS. Summary:

1. Expand `EngagementEvent` types (login, recording_view, assessment_pass/fail, etc.)
2. `StudentRiskScore` model (score 0–100, tier: on_track/needs_attention/at_risk/critical)
3. `compute_student_risk()` function: weighted signals (login recency, score trend, completion rate, attendance)
4. Nightly recompute via QStash cron
5. Risk cards on Student/Teacher/Principal dashboards
6. Auto-notifications when student drops to "At Risk"

**Complexity**: ~3 days. Defer until post-capstone unless needed for research paper.

---

## SECTION 7 — CI/CD: CONFIRMED COMPLETE

GitHub Actions `deploy.yml` now has:
- ✅ Lint job (Django system check before deploy)
- ✅ `PREV_SHA` saved before pull
- ✅ `rollback()` function with `trap ERR`
- ✅ 3-attempt health check with 5s retry gaps
- ✅ Auto git rollback + gunicorn reload on any failure
- ✅ Explicit failure message with SSH/journalctl commands
- ✅ `concurrency: production-deploy` prevents parallel deploys

---

## SECTION 8 — ENV VARS NEEDED ON ORACLE (verify these exist)

SSH into Oracle and run `cat /opt/gyangrit/backend/.env` to verify:

```bash
# AI providers (all three needed for full fallback chain)
GROQ_API_KEY=gsk_xxx                        # Primary — Groq free tier
TOGETHER_API_KEY=xxx                         # Fallback — Together AI
GEMINI_API_KEY=AIzaxxxx                      # Last resort — Gemini

# LiveKit recording
LIVEKIT_RECORDING_WEBHOOK_SECRET=xxx         # Generate: openssl rand -hex 32
LIVEKIT_URL=wss://gyangrit-ld2s7sp2.livekit.cloud
LIVEKIT_API_KEY=xxx
LIVEKIT_API_SECRET=xxx

# Cloudflare R2 — recordings need public URL
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxxx.r2.dev   # REQUIRED for video playback
CLOUDFLARE_R2_BUCKET_NAME=gyangrit-media
CLOUDFLARE_R2_ACCESS_KEY_ID=xxx
CLOUDFLARE_R2_SECRET_ACCESS_KEY=xxx
CLOUDFLARE_R2_ACCOUNT_ID=xxx
CLOUDFLARE_R2_RECORDINGS_PREFIX=recordings/

# Other
BACKEND_BASE_URL=https://api.gyangrit.site
UPSTASH_REDIS_KV_URL=rediss://default:xxx@xxx.upstash.io:6379
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## SECTION 9 — SPRINT PLAN (updated)

### Sprint 1 — Recordings activation (2–3 hours)
```
1. Set CLOUDFLARE_R2_PUBLIC_URL in Oracle .env (5 min)
2. Set LIVEKIT_RECORDING_WEBHOOK_SECRET (5 min)
3. Wire start_recording() into session_start view (15 min)
4. Test: start a live session, end it, verify recording appears in /recordings/
```

### Sprint 2 — Redis caching (2–3 hours)
```
1. Add cache.get/set to leaderboard view
2. Add cache.get/set to courses list view  
3. Add cache.get/set to analytics summary view
4. Verify: check response times before/after
```

### Sprint 3 — PWA offline assessment queue (3–4 hours)
```
1. Add assessment_queue store to offline.ts
2. Add Background Sync registration to sw.js
3. Wire AssessmentPage to queue submissions when offline
4. Test: submit assessment offline, go online, verify auto-submit
```

### Sprint 4 — Analytics & Risk AI (5–7 hours)
```
1. Expand EngagementEvent model types
2. StudentRiskScore model + migration
3. compute_student_risk() function
4. Risk API endpoints
5. Dashboard widgets (Student + Teacher + Principal)
```

---

## ARCHITECTURE DECISION RECORDS (updated)

| ADR | Decision | Rationale | Date |
|---|---|---|---|
| ADR-001 | Groq primary AI, Gemini last resort | Groq: 30 req/min free vs Gemini: 15 req/min shared | 2026-04-03 |
| ADR-002 | LiveKit Egress for recording | No extra VM load, LiveKit Cloud handles encoding | 2026-04-03 |
| ADR-003 | Redis rate limiting not sleep() | sleep() blocks gthread workers; Redis is non-blocking | 2026-04-03 |
| ADR-004 | conn_max_age=60 (same-region DB) | Safe with gthread + Mumbai-Mumbai; was 0 for gevent+cross-region | 2026-04-03 |
| ADR-005 | Dedicated /recordings page | Recordings accumulate; need own search/filter UI | 2026-04-03 |
| ADR-006 | ARM64 wheels only on Oracle A1 | Oracle A1.Flex is aarch64; x86 wheels fail with SIGILL | 2026-04-03 |
| ADR-007 | AI Tools: fetch courses once, filter client-side | No ?subject_id= param on /courses/ — role-scoped automatically; client filter is simpler | 2026-04-04 |
| ADR-008 | R2 public bucket for recordings | Presigned URLs add 50ms per list request; public bucket is zero-latency for read-only media | 2026-04-04 |
| ADR-009 | deploy.yml trap ERR for rollback | Bash trap fires on any unhandled error — safer than explicit checks after every step | 2026-04-04 |

---

*End of FUTURE_TASKS.md — Next revision after Sprint 1 (recordings activation).*
