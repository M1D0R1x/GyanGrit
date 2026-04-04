# GyanGrit — Open Issues & Upgrade Roadmap

> Updated 2026-04-04. Contains **only** unresolved items.

---

## 🔴 Issues (Needs Fixing)

### 1. Redis configured but unused — no application-level caching
**Files:** `backend/gyangrit/settings/prod.py` (lines 118–139)  
**Impact:** High — Redis (Upstash) is configured for **session storage only** (`SESSION_ENGINE = "django.contrib.sessions.backends.cache"`). No application code uses `cache.get()`/`cache.set()` — zero cache usage across all 18 Django apps. The Upstash dashboard correctly shows no database created because the dev settings don't configure Redis at all; production connects but only stores session keys.  
**Recommendation:**  
  - Add `UPSTASH_REDIS_KV_URL` to dev settings so Redis is exercised locally.  
  - Add caching for: leaderboard rankings (5 min TTL), subject lists (10 min TTL), course lists (10 min TTL), section lists (10 min TTL), dashboard stats (5 min TTL).  
  - Consider `cache_page()` decorator for read-heavy public endpoints.

### 2. No top-level `from django.conf import settings` in `livesessions/views.py`
**File:** `backend/apps/livesessions/views.py`  
**Impact:** Low — works with function-local imports, but inconsistent.  
**Recommendation:** Add single top-level import, remove function-local aliases.

### 3. R2 key has spaces in subject names (e.g. `Social 2`)
**File:** `backend/apps/livesessions/recording.py` → `build_r2_key()`  
**Impact:** Medium — R2 handles spaces via URL encoding but can confuse S3-compatible clients.  
**Recommendation:** Slugify subject names in `build_r2_key()`.

### 4. Recording duration never set after manual sync
**File:** `backend/apps/livesessions/views.py` → `sync_recording()`  
**Impact:** Low — duration shows as "—" for manually synced recordings.  
**Recommendation:** Accept as webhook-only metadata, or parse MP4 header via background task.

### 5. `recording_url` may have CORS issues
**File:** `backend/apps/livesessions/views.py`  
**Impact:** Medium — R2 public bucket needs CORS headers for `<video>` playback on `gyangrit.site`.  
**Recommendation:** Ensure R2 bucket CORS: `AllowedOrigins: ["https://www.gyangrit.site", "https://gyangrit.site"]`, `AllowedMethods: ["GET", "HEAD"]`.

### 6. No retry/fallback for failed recording webhooks
**File:** `backend/apps/livesessions/views.py` → `recording_webhook()`  
**Impact:** Medium — failed webhook = recording stuck in "processing" forever.  
**Recommendation:** Add periodic background task to auto-sync stale `processing` recordings after 10 min.

### 7. Single-device login uses Django sessions, not Redis-keyed sessions per BSRS spec
**File:** `backend/apps/accounts/models.py` → `DeviceSession`  
**Impact:** Low — current implementation works via middleware + session key comparison, but the BSRS specification (Section 5) describes a Redis-keyed `user:{user_id}:session` approach with WebSocket logout push.  
**Recommendation:** Post-capstone enhancement — migrate to explicit Redis session records for cross-device logout push.

---

## 🟡 Suggested Upgrades

### A. Auto-sync stale recordings (background task)
Periodic task: find all sessions with `recording_status=processing` older than 10 minutes → auto-run R2 `head_object` check.

### B. Recording thumbnails
Generate poster frame from first video second, upload alongside MP4, use as `poster` on `<video>`.

### C. Student recording analytics
Track which students watched which recordings and for how long.

### D. Recording search & filtering
Add full-text search across recording titles/subjects.

### E. Real-time notifications for recording readiness
Push notification when recording transitions `processing → ready`.

### F. R2 health in the health endpoint
Add R2 connectivity test to `/api/v1/health/`.

### G. Whiteboard persistence to backend
Persist Excalidraw JSON in a `TextField` on `LiveSession` for cross-device/cross-session recovery.

### H. Rate limiting on API endpoints
Add throttling on sync endpoint, OTP endpoint, and public health endpoint.

### I. Application-level Redis caching
Implement `cache.get()`/`cache.set()` for leaderboards, course lists, subject lists, dashboard stats.

---

## 📋 Environment Checklist

| Variable | Purpose | Prod? | Dev? |
|---|---|---|---|
| `CLOUDFLARE_R2_ACCOUNT_ID` | R2 account for boto3 | ✅ | ✅ |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 API token access key | ✅ | ✅ |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API token secret | ✅ | ✅ |
| `CLOUDFLARE_R2_BUCKET_NAME` | Bucket name | ✅ | ✅ |
| `CLOUDFLARE_R2_PUBLIC_URL` | CDN URL for videos | ✅ | ✅ |
| `LIVEKIT_API_KEY` | LiveKit Cloud API key | ✅ | ✅ |
| `LIVEKIT_API_SECRET` | LiveKit Cloud API secret | ✅ | ✅ |
| `LIVEKIT_URL` | LiveKit WebSocket URL | ✅ | ✅ |
| `UPSTASH_REDIS_KV_URL` | Redis sessions + cache | ✅ | ✅ |
| `SENTRY_DSN` | Error tracking | ✅ | ❌ |
