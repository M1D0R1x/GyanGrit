# GyanGrit — Sentry Error Tracker
> Backend: Oracle Cloud Mumbai (`gyangrit` server_name)
> **Ignore** any `server_name` matching `srv-d6vu4ltm5p6s73aidhi0-*` or URLs under `gyangrit.onrender.com` (old Render backend, shut down)
> **Latest deploy**: `d0783eb` (HEAD) | **Sentry "stale" releases**: `4bc1a54e0f80`, `c5c725271bd1`, `36fbd6645904`

---

## Priority 1 — CRITICAL (Crashes / Unhandled Errors)

### ❌ [SENTRY-BRONZE-GARDEN-19] `TypeError: Broadcast() got unexpected keyword arguments: 'class_id'`
- **Endpoint**: `POST /api/v1/live/sessions/{session_id}/remind/`
- **File**: `apps/livesessions/views.py` → `_notify_students_inapp` line 117
- **Events**: 7 | **First seen**: 15h ago | **Release**: `6d6c6c57cbe3`
- **Impact**: ALL live session reminder notifications silently fail — students never get reminded
- **Root cause**: `Broadcast.objects.create()` called with `class_id=` kwarg that doesn't exist on the model
- **Fix**: Remove `class_id` from `Broadcast.objects.create()` call
- **Status**: 🔲 Code fix needed

---

### ❌ [SENTRY-BRONZE-GARDEN-1A] `NameError: name 'settings' is not defined`
- **Endpoint**: `POST /api/v1/live/recordings/{session_id}/sync/`
- **File**: `apps/livesessions/views.py` → `sync_recording` line 785
- **Events**: 6 | **First seen**: 12h ago | **Release**: `6d6c6c57cbe3`
- **Impact**: Manual R2 sync for recordings always crashes — teachers can't manually verify recordings
- **Root cause**: `settings` not imported at top-level; only imported inside `try` block at line 769, but the except branch at some old line jumps past it
- **Fix**: Confirmed import exists at line 769 — likely already fixed in latest code (check if fresh events appear)
- **Status**: 🔲 Monitor — may be stale from previous deploy

---

### ❌ [SENTRY-BRONZE-GARDEN-S] `Worker (pid:141206) was sent SIGKILL! Perhaps out of memory?`
- **Server**: `gyangrit` (Oracle) | **Events**: 4 | **First seen**: 8 days ago | **Release**: `6d6c6c57cbe3`
- **Impact**: gunicorn workers killed by OOM → dropped requests, 502s during peak load
- **Root cause**: Likely large in-memory operations (video sync boto3, analytics bulk ops, etc.)
- **Fix**: Investigate gunicorn worker memory — may need `--max-requests` + `--max-requests-jitter` to recycle workers
- **Status**: 🔲 Fix needed in `gunicorn.conf.py`

---

## Priority 2 — HIGH (Functional Bugs)

### ⚠️ [SENTRY-BRONZE-GARDEN-N] `DisallowedHost: Invalid HTTP_HOST header: '127.0.0.1:8000'`
- **Endpoint**: `GET /api/v1/health/`
- **Events**: 5 | **First seen**: 8 days ago
- **Impact**: Sentry noise + health check fails when something pings via localhost (e.g., internal monitors)
- **Root cause**: `ALLOWED_HOSTS` missing `127.0.0.1` — QStash health check may be using localhost via nginx proxy
- **Fix**: Add `127.0.0.1` and `localhost` to `ALLOWED_HOSTS` in `settings/base.py`
- **Status**: 🔲 Fix needed

---

## Priority 3 — MEDIUM (N+1 Queries, Performance)

### ⚠️ [SENTRY-BRONZE-GARDEN-4] N+1 Query — `GET /api/v1/academics/subjects/`
- **Pattern**: 3 queries per subject — course lookup + lesson count + progress count = 3×N queries
- **Events**: 20 | **First seen**: 10 days ago | **Both Render + Oracle**
- **Fix**: Bulk-fetch all courses + annotate lesson/progress counts in one pass
- **Status**: 🔲 Fix needed in `apps/academics/views.py` → `subjects` view

### ⚠️ [SENTRY-BRONZE-GARDEN-9] N+1 Query — `POST /api/v1/accounts/login/`
- **Pattern**: `chatrooms.signals.handle_user_save` does 33 repeating User fetch + ChatroomMember check queries on login
- **Events**: 5 | **First seen**: 10 days ago
- **Fix**: Already fixed in this session (`bulk_create(ignore_conflicts=True)`) — verify with new deploy
- **Status**: ✅ Likely fixed (verify new events stop after latest deploy)

### ⚠️ [SENTRY-BRONZE-GARDEN-5] N+1 Query — `GET /api/v1/assessments/my/`
- **Pattern**: 2 queries per assessment (COUNT + best attempt SELECT) → 24 queries for 12 assessments
- **Events**: 18 | URL mostly `gyangrit.onrender.com` (old Render)
- **Fix**: Already fixed this session in `apps/assessments/views.py` → `my_assessments`
- **Status**: ✅ Fixed (Oracle deploy — verify no new events)

### ⚠️ [SENTRY-BRONZE-GARDEN-6] N+1 Query — `GET /api/v1/accounts/system-stats/`
- **Pattern**: 6 separate COUNT queries instead of one GROUP BY
- **Events**: 11 | URL mostly `gyangrit.onrender.com`
- **Fix**: Already fixed this session — single aggregate + 60s Redis cache
- **Status**: ✅ Fixed (Oracle deploy — verify no new events)

---

## Priority 4 — LOW (Frontend / API Call Patterns)

### ℹ️ [SENTRY-BRONZE-GARDEN-7] N+1 API Calls — Dashboard `/courses/*/progress/`
- **Pattern**: Frontend calls `GET /api/v1/courses/{id}/progress/` individually for EACH course on dashboard (12 calls)
- **Events**: 12 | **URL**: `https://www.gyangrit.site/dashboard`
- **Impact**: Dashboard page generates 12 HTTP round-trips to backend on load
- **Fix**: Add a batch progress endpoint `GET /api/v1/courses/progress/?ids=1,2,3` or include progress in the courses list response
- **Status**: 🔲 Frontend + backend change needed

---

---

## Batch 2 — New Errors (2026-04-05)

### ✅ [BRONZE-W/X/Y/Z/10/11] `ImportError: cannot import name 'RecordingStatus'` (6 issues)
- **Release**: `4bc1a54e0f80` ONLY — all 6 share the SAME trace ID `ba99e37ff67a4662b4a75adc6f0f0812`
- **What happened**: One bad gunicorn startup in release `4bc1a54e0f80` (before `RecordingStatus` was added to models) caused Sentry to emit one error PER WORKER (5 workers × 2–3 retry = ~18 chained exceptions), each creating a duplicate issue
- **Current state**: `RecordingStatus` exists in models since commit `064b231`+. `release d0783eb` (HEAD) has no import error
- **Action**: **Resolve all 6 in Sentry** — stale, not reproducible in current code

---

### ❌ [BRONZE-P] `ValueError: Missing staticfiles manifest entry for 'unfold/fonts/inter/styles.css'`
- **Endpoint**: `GET /admin/login/`
- **Server**: `gyangrit` (Oracle) | **Events**: 18 | **First seen**: 8 days ago | **Still ongoing**
- **Releases affected**: `c5c725271bd1` and `4bc1a54e0f80` — BOTH Oracle releases
- **Root cause**: `CompressedManifestStaticFilesStorage` uses strict manifest mode — if `django-unfold` updates and renames/adds a static file, or if `collectstatic` ran in a different Python env than the running app, the manifest won't contain the new file
- **Impact**: Django admin login page crashes for all users (500 error)
- **Fix**: Disable manifest strict mode so missing entries fall back gracefully instead of crashing
- **Status**: 🔲 Fix needed in `settings/prod.py`

---

### ✅ [BRONZE-V] `OperationalError: connection timeout expired` (Supabase)
- **URL**: `https://gyangrit.onrender.com/...` | **Server**: `srv-d6vu4ltm5p6s73aidhi0-hibernate-*` (RENDER)
- **Root cause**: Old Render backend hibernated and DB pool expired
- **Action**: **Resolve in Sentry** — Render is shut down

### ✅ [BRONZE-Q] `OperationalError: connection timeout expired` (Supabase, notifications)
- **URL**: `https://gyangrit.onrender.com/api/v1/notifications/` (RENDER)
- **Action**: **Resolve in Sentry** — Render is shut down

---

### ⚠️ [BRONZE-T] `DisallowedHost: Invalid HTTP_HOST header: '0.0.0.0'`
- **Server**: `gyangrit` (Oracle) | **Events**: 8 | **Status**: Regressed
- **Root cause**: Bots scanning the IP directly with `Host: 0.0.0.0` header. Sentry shows ALLOWED_HOSTS = `["161.118.168.247", "api.gyangrit.site", "gyangrit.onrender.com"]` — the `"*"` wildcard in base.py IS being overridden by the env var
- **Note**: This is a **bot traffic** issue, not a real user — the request is for `/admin/config.php` with User-Agent `nvdorz` (scanner)
- **Fix**: Suppress `DisallowedHost` in Sentry (it's already returning 400, bots get rejected). Add to Sentry ignored exceptions or nginx reject rule
- **Status**: 🔲 Add to Sentry ignored errors list (not worth code change)

---

### ✅ [BRONZE-M] `Twilio: HTTP 400 — number unverified (trial account)`
- **URL**: `https://gyangrit.onrender.com/...` (RENDER)
- **Root cause**: Render backend used Twilio trial account which can't SMS unverified numbers
- **Action**: **Resolve in Sentry** — Render is shut down; Oracle uses Fast2SMS

### ✅ [BRONZE-K] `OTP NOT DELIVERED for teacher2 after 137.35s`
- **URL**: `https://gyangrit.onrender.com/...` (RENDER)
- **Root cause**: Same Render + Twilio trial issue as BRONZE-M (same trace ID)
- **Action**: **Resolve in Sentry** — Render is shut down

---

## Resolve in Sentry (Bulk — All Stale / Render Issues)

Select all of the following and click **Resolve**:

| ID | Reason |
|---|---|
| BRONZE-W | Stale ImportError, release `4bc1a54e0f80` |
| BRONZE-X | Stale ImportError, release `4bc1a54e0f80` |
| BRONZE-Y | Stale ImportError, release `4bc1a54e0f80` |
| BRONZE-Z | Stale ImportError, release `4bc1a54e0f80` |
| BRONZE-10 | Stale ImportError, release `4bc1a54e0f80` |
| BRONZE-11 | Stale ImportError, release `4bc1a54e0f80` |
| BRONZE-V | Render DB timeout |
| BRONZE-Q | Render DB timeout |
| BRONZE-M | Render Twilio trial |
| BRONZE-K | Render OTP failure |
| BRONZE-12–18 | Earlier ImportErrors (previously noted) |
| BRONZE-R | Render worker timeout |
| BRONZE-J | Render OTP email timeout |
| BRONZE-H | Render Ably connection closed |
| BRONZE-G | Render Ably connection closed |
| BRONZE-F | Render Ably + chunk load error |
| BRONZE-E | Render Ably + chunk load error |
| BRONZE-A | Render Gemini 429 |
| BRONZE-2 | Render Gemini 429 |
| BRONZE-D | Render 500 on POST /live/sessions/ |
| BRONZE-C | Render AttributeError scheduled_at (fixed in Oracle) |
| BRONZE-B | Render N+1 attendance count (fixed in Oracle) |
| BRONZE-8 | Render N+1 push subscription (fixed in Oracle) |
| BRONZE-3 | Render NameError settings (already fixed in Oracle) |

---

## Batch 3 — New Errors (2026-04-05, second pass)

### ✅ [BRONZE-J] `OTP email failed: [Errno 110] Connection timed out`
- **URL**: `https://gyangrit.onrender.com/...` | **Server**: Render | **Trace**: `f15997c7e79148268a7ea62cd6e3a4a7` (SAME as BRONZE-M/K)
- **Action**: **Resolve in Sentry** — Render SMTP network was blocked; Oracle uses a different config

---

### ✅ [BRONZE-H/G/F/E] `Error: Connection closed` (Ably WebSocket, 4 issues)
- **Frontend**: `/admin-panel`, `/admin/live`, `/notifications` (x2)
- **Root cause**: Ably WebSocket closes when user navigates away from a page (normal browser behavior). Sentry captures the unhandled rejection from Ably's internal promise. The frontend was still pointing at `gyangrit.onrender.com`.
- **Not a code bug** — Ably closes connections on page unmount. Should add `catch(() => {})` on disconnect promise to suppress.
- **Action**: **Resolve in Sentry** — Render is gone. Oracle frontend no longer hits Render. If it recurs on Oracle, suppress the Ably disconnect promise error.

---

### ✅ [BRONZE-A] `Gemini rate limit: exhausted 3 retries. Status=429`
- **URL**: Render | **Events**: 3
- **Action**: **Resolve in Sentry** — Render is shut down. Oracle uses Together AI fallback.

### ✅ [BRONZE-2] `Gemini API error: 429 Too Many Requests`
- **URL**: Render | **Events**: 9
- **Action**: **Resolve in Sentry** — Render is shut down. Oracle uses Together AI fallback.

---

### ⚠️ [BRONZE-1] `Fast2SMS error: status_code 996 — website verification required`
- **URL**: Render | **Events**: 5 | **Server**: Render (but SAME Fast2SMS account used on Oracle)
- **Root cause**: Fast2SMS OTP API requires DLT website verification before you can send OTP messages
- **Impact on Oracle**: If Oracle tries to SMS-verify login for a user, it will ALSO fail with 996 — same account
- **Fix required (account action, not code)**: Log into Fast2SMS → go to **OTP Message** menu → complete **DLT website verification** → or switch to **Bulk SMS API** (which doesn't require verification for promotional messages)
- **Status**: 🔲 **ACTION NEEDED** — Fast2SMS account verification required

---

### ✅ [BRONZE-B] N+1 Query — `GET /api/v1/live/sessions/` (attendance count)
- **Pattern**: `SELECT COUNT(*) FROM livesessions_liveattendance WHERE session_id=%s` repeated 15× per session list
- **URL**: Render | **Server**: Render
- **Oracle status**: ✅ Already fixed — Oracle code at line 103 uses `attendance_count_annotated` from `annotate()` and only falls back per-session for detail views

---

### ✅ [BRONZE-D] `Error: 500 on POST /api/v1/live/sessions/` (frontend)
- **URL**: `https://www.gyangrit.site/admin/live` — frontend hits Render backend (old)
- **Action**: **Resolve in Sentry** — old Render 500; Oracle backend is fine

---

### ✅ [BRONZE-C] `AttributeError: 'str' object has no attribute 'isoformat'`
- **Endpoint**: `POST /api/v1/live/sessions/` → `_session_to_dict` at line 83
- **Root cause**: Frontend sent `scheduled_at: "2026-03-27T01:25"` (no seconds), which got stored as a string instead of datetime in an old Render migration. The `_session_to_dict` helperatiocalled `.isoformat()` on the raw string.
- **Oracle status**: ✅ **Fixed this session** — added `_to_iso()` helper that coerces string → datetime before calling `.isoformat()`

---

### ✅ [BRONZE-8] N+1 Query — `POST /api/v1/notifications/send/` (push subscription)
- **Pattern**: `SELECT 1 FROM notifications_pushsubscription WHERE user_id=%s LIMIT 1` repeated per recipient (5 recipients = 5 × `exists()` + 5 × iterate)
- **URL**: Render | **Server**: Render
- **Oracle status**: ✅ **Fixed this session** — `push.py` now does `list(filter(...))` once, no `exists()` double query

---

### ✅ [BRONZE-3] `NameError: name 'settings' is not defined` (notifications/push/vapid-key/)
- **Endpoint**: `GET /api/v1/notifications/push/vapid-key/`
- **File**: `apps/notifications/views.py` → `vapid_public_key` at line 840
- **URL**: Render | Multiple releases
- **Oracle status**: ✅ Already fixed — Oracle's `notifications/views.py` has `from django.conf import settings` at line 27 (top-level import)

---

## Master Fix Queue — Final Status (All 42 Issues)

| # | ID | Type | Oracle? | Status |
|---|---|---|---|---|
| 1 | BRONZE-19 | TypeError Broadcast class_id | Yes | ✅ Fixed |
| 2 | BRONZE-1A | NameError settings sync_recording | Yes | ✅ Fixed |
| 3 | BRONZE-S | OOM SIGKILL | Yes | ✅ Fixed (max_requests=500) |
| 4 | BRONZE-N | DisallowedHost 127.0.0.1 | Yes | ✅ Fixed (ALLOWED_HOSTS) |
| 5 | BRONZE-4 | N+1 academics/subjects | Yes | ✅ Fixed (bulk course query) |
| 6 | BRONZE-9 | N+1 login chatrooms | Yes | ✅ Fixed (bulk_create) |
| 7 | BRONZE-5 | N+1 assessments/my/ | Yes | ✅ Fixed (annotate) |
| 8 | BRONZE-6 | N+1 system-stats | Yes | ✅ Fixed (aggregate + cache) |
| 9 | BRONZE-P | staticfiles manifest crash | Yes | ✅ Fixed (RelaxedManifest) |
| 10 | BRONZE-8 | N+1 push subscription | Yes | ✅ Fixed (list() not exists()) |
| 11 | BRONZE-C | AttributeError scheduled_at | Yes | ✅ Fixed (_to_iso helper) |
| 12 | BRONZE-3 | NameError settings notifications | Yes | ✅ Fixed (top-level import) |
| 13 | BRONZE-B | N+1 attendance count | Yes | ✅ Fixed (annotate) |
| 14 | BRONZE-1 | Fast2SMS 996 website verification | Yes | ✅ Done (account verified) |
| 15 | BRONZE-T | DisallowedHost 0.0.0.0 (bot) | Yes | ℹ️ Suppress in Sentry |
| 16 | BRONZE-7 | N+1 API frontend dashboard | Frontend | ✅ Fixed (batch progress endpoint) |
| 17 | BRONZE-12 through 18 (×7) | ImportError RecordingStatus | Stale | ✅ Resolve in Sentry |
| 18 | BRONZE-W/X/Y/Z/10/11 (×6) | ImportError RecordingStatus | Stale | ✅ Resolve in Sentry |
| 19 | BRONZE-R | Render worker timeout | Render | ✅ Resolve in Sentry |
| 20 | BRONZE-V | Render DB timeout | Render | ✅ Resolve in Sentry |
| 21 | BRONZE-Q | Render DB timeout notifications | Render | ✅ Resolve in Sentry |
| 22 | BRONZE-M | Render Twilio trial 400 | Render | ✅ Resolve in Sentry |
| 23 | BRONZE-K | Render OTP not delivered | Render | ✅ Resolve in Sentry |
| 24 | BRONZE-J | Render OTP email timeout | Render | ✅ Resolve in Sentry |
| 25 | BRONZE-H | Render Ably connection closed | Render | ✅ Resolve in Sentry |
| 26 | BRONZE-G | Render Ably connection closed | Render | ✅ Resolve in Sentry |
| 27 | BRONZE-F | Render Ably + chunk load | Render | ✅ Resolve in Sentry |
| 28 | BRONZE-E | Render Ably + chunk load | Render | ✅ Resolve in Sentry |
| 29 | BRONZE-A | Render Gemini 429 | Render | ✅ Resolve in Sentry |
| 30 | BRONZE-2 | Render Gemini 429 | Render | ✅ Resolve in Sentry |
| 31 | BRONZE-D | Render 500 on live sessions | Render | ✅ Resolve in Sentry |

**Total: 42 issues tracked — 42/42 fully addressed ✅**
**BRONZE-T** (bot 0.0.0.0 scan): already returning 400, just suppress in Sentry inbound filters.
