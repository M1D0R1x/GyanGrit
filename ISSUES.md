# GyanGrit — Issues, Fixes & Upgrade Roadmap

> Generated 2026-04-04 from a full project audit.

---

## 🔴 Critical Bugs (Fixed)

### 1. `sync_recording` — `NameError: 'settings' is not defined`
**File:** `backend/apps/livesessions/views.py` → `sync_recording()`  
**Cause:** The `from django.conf import settings` import was missing from the function body. The rest of this file uses function-local imports (not top-level), and the new `sync_recording` view didn't include one.  
**Fix:** Added `from django.conf import settings` inside the function.  
**Status:** ✅ Fixed

### 2. `sync_recording` — 403 CSRF rejection on production
**File:** `backend/apps/livesessions/views.py`  
**Cause:** Cross-origin POST from `gyangrit.site` → `api.gyangrit.site` triggers Django's CSRF check. The view wasn't exempt.  
**Fix:** Added `@csrf_exempt` decorator (same pattern as `recording_webhook`). Still protected by `@require_auth`.  
**Status:** ✅ Fixed

### 3. Whiteboard stays visible on student side after teacher closes it
**File:** `frontend/src/pages/LiveSessionPage.tsx`  
**Cause:** The student view (`StudentWhiteboardView`) auto-detected the screenshare track to decide whether to show the whiteboard. But the canvas captureStream keeps publishing for recording even when the teacher closes the whiteboard UI — so students always saw the fullscreen whiteboard.  
**Fix:** Added `whiteboard_toggle` data channel message. Teacher broadcasts `{type: "whiteboard_toggle", open: true/false}` when toggling. Students use this signal (not track presence) to decide their view.  
**Status:** ✅ Fixed

### 4. Students can't send hand raises or chat messages
**File:** `backend/apps/livesessions/views.py` → `session_token()`  
**Cause:** BUG2 fix (preventing students from broadcasting whiteboard data) set `canPublishData=False` for students. This also blocked all data channel messages — including hand raises, hand ack, and chat. Students appeared unable to interact.  
**Fix:** Set `canPublishData=True` for all participants. Whiteboard security is enforced at the application layer — only the teacher's Excalidraw `onChange` calls `broadcastWhiteboard()`.  
**Status:** ✅ Fixed

### 5. Recording webhook not parsing LiveKit Cloud payload
**File:** `backend/apps/livesessions/recording.py` → `handle_recording_webhook()`  
**Cause:** LiveKit Cloud sends Egress completion data nested under `egressInfo` (camelCase keys: `egressId`, `status`). The handler expected flat snake_case keys (`egress_id`, `status`).  
**Fix:** Handler now reads both shapes: checks `payload["egressInfo"]` first, falls back to flat keys.  
**Status:** ✅ Fixed

---

## 🟡 Known Issues (Not Yet Fixed)

### 6. No top-level `from django.conf import settings` in `views.py`
**File:** `backend/apps/livesessions/views.py`  
**Impact:** Low — works correctly with function-local imports, but is inconsistent with Django conventions. Every function that needs settings does its own `from django.conf import settings`, sometimes aliased (`_s`, `django_settings`).  
**Recommendation:** Add a single top-level import and remove all function-local ones. Lower priority — cosmetic.

### 7. R2 key has spaces in subject names (e.g. `Social 2`)
**File:** `backend/apps/livesessions/recording.py` → `build_r2_key()`  
**Impact:** Medium — R2 and boto3 handle spaces via URL encoding, but it can cause confusion when debugging paths in the Cloudflare dashboard. Some S3-compatible clients may fail on keys with spaces.  
**Recommendation:** Run subject names through `_slugify()` in `build_r2_key()` or use URL encoding. Not breaking currently but could be.

### 8. Recording duration is never set by the sync endpoint
**File:** `backend/apps/livesessions/views.py` → `sync_recording()`  
**Impact:** Low — duration shows as "—" in the player UI. The `HEAD` request against R2 doesn't return duration metadata (only `ContentLength`).  
**Recommendation:** Either parse the MP4 header on sync (heavyweight), or accept that duration is webhook-only data. Could also use `ffprobe` via a background task.

### 9. `recording_url` uses R2 public URL which may have CORS issues
**File:** `backend/apps/livesessions/views.py` lines 825–826  
**Impact:** Medium — If the R2 public bucket doesn't have CORS headers configured, the `<video>` element may fail to load the MP4 on `gyangrit.site`.  
**Recommendation:** Ensure R2 bucket CORS is configured: `AllowedOrigins: ["https://www.gyangrit.site", "https://gyangrit.site"]`, `AllowedMethods: ["GET", "HEAD"]`.

### 10. No retry/fallback if recording webhook signature verification fails
**File:** `backend/apps/livesessions/views.py` → `recording_webhook()`  
**Impact:** If the webhook JWT validation fails (clock skew, wrong secret), the recording stays in `processing` forever until manually synced.  
**Recommendation:** The "Sync from R2" button is the current workaround. Could add a periodic celery beat task to auto-sync stale `processing` recordings after 10 minutes.

---

## 🟢 Suggested Upgrades

### A. Auto-sync stale recordings (background task)
Add a periodic task (cron or Celery beat) that finds all sessions with `recording_status=processing` older than 10 minutes and runs the R2 `head_object` check automatically. Eliminates the need for manual Sync button clicks.

### B. Recording thumbnails
Generate a poster frame from the first second of the video and upload it alongside the MP4. Use it as a `poster` attribute on the `<video>` tag and as a card thumbnail in the recordings list.

### C. Student recording analytics
Track which students have watched which recordings and for how long. Useful for teacher dashboards — "Rahul hasn't watched the Photosynthesis session yet".

### D. Recording search and filtering
Add full-text search across recording titles/subjects. Currently only filter-by-subject is supported.

### E. WebSocket notifications for recording readiness
When a recording transitions from `processing` → `ready`, push a real-time notification to the teacher via Ably. Currently the teacher has to refresh or click Sync.

### F. Health check for R2 connectivity
Add an R2 connection test to the `/api/v1/health/` endpoint. Currently the health check only verifies the database. A failed R2 connection would silently break all recording features.

### G. Whiteboard persistence across sessions
Currently whiteboard drawings are stored in `localStorage` keyed by session ID. If the teacher clears browser data or switches devices, drawings are lost. Consider persisting to the backend (e.g., store Excalidraw JSON in a `TextField` on `LiveSession`).

### H. Rate limiting on sync endpoint
The `sync_recording` endpoint makes a boto3 `HEAD` request to R2 on every call. A user spamming the button could hit R2 rate limits. Add a cooldown (e.g., once per 30 seconds per session).

---

## 📋 Environment Checklist

Ensure these are set in your production `.env`:

| Variable | Purpose | Set? |
|---|---|---|
| `CLOUDFLARE_R2_ACCOUNT_ID` | R2 account for boto3 endpoint | ✅ |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 API token access key | ✅ |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API token secret | ✅ |
| `CLOUDFLARE_R2_BUCKET_NAME` | Bucket name (`gyangrit-media`) | ✅ |
| `CLOUDFLARE_R2_PUBLIC_URL` | Public CDN URL for serving videos | ✅ |
| `LIVEKIT_API_KEY` | LiveKit Cloud API key | ✅ |
| `LIVEKIT_API_SECRET` | LiveKit Cloud API secret | ✅ |
| `LIVEKIT_URL` | LiveKit Cloud WebSocket URL | ✅ |

> All verified present in local dev environment (from the Django debug page).
