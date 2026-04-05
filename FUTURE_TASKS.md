# GyanGrit — Future Tasks & Roadmap

> **Last updated:** April 2026  
> **Current state:** Production stable on Oracle Cloud Mumbai. All 42 Sentry errors resolved.  
> **Backend:** https://api.gyangrit.site · **Frontend:** https://www.gyangrit.site

---

## Current Production Status

| Area | Status |
|---|---|
| Oracle Cloud deployment | ✅ Stable |
| Vercel frontend | ✅ Deployed |
| GitHub Actions CI/CD | ✅ Auto-deploy + rollback |
| Supabase DB | ✅ Running |
| Upstash Redis | ✅ Sessions + rate limiting |
| QStash cron jobs | ✅ Health + nightly analytics |
| Sentry | ✅ 42/42 errors resolved |
| AI tutor (Groq → Together → Gemini) | ✅ Fallback chain working |
| LiveKit live classes | ✅ Working |
| Cloudflare R2 media | ✅ Upload/download working |
| Analytics & risk scoring | ✅ Nightly recompute deployed |
| PWA app shell | ✅ Service worker + manifest |
| Push notifications | ✅ VAPID/pywebpush |

---

## Sprint 1 — Live Session Recordings Activation 🎬

**Complexity:** 2–3 hours  
**Value:** High — recordings are built but not triggered

### What's done:
- ✅ LiveKit Egress library installed
- ✅ `recording.py` module with `start_recording()` + R2 upload
- ✅ `/live/recordings/` backend endpoint
- ✅ Recordings frontend page

### What's missing:
**1. Wire `start_recording()` into `session_start` view**

In `backend/apps/livesessions/views.py`, the `session_start` view sets `session.status = "live"`. After that line, add:

```python
import threading
from .recording import start_recording
threading.Thread(target=start_recording, args=(session,), daemon=True).start()
```

Use `threading.Thread` (fire-and-forget) so the HTTP response is not blocked.

**2. Set env vars on Oracle:**
```bash
LIVEKIT_RECORDING_WEBHOOK_SECRET=<openssl rand -hex 32>
CLOUDFLARE_R2_PUBLIC_URL=https://pub-<hash>.r2.dev
```

**3. Test:**
1. Start a live session
2. End the session
3. Check `GET /api/v1/live/recordings/` — recording should appear within ~30s

---

## Sprint 2 — Redis API Response Caching ⚡

**Complexity:** 2–3 hours  
**Value:** High — reduces DB load on high-traffic endpoints

### Target endpoints

| Endpoint | TTL | Cache key |
|---|---|---|
| Leaderboard | 5 min | `leaderboard:{section_id}` |
| Course list | 30 min | `courses:{role}:{user_id}` |
| Subject list | 1 hour | `subjects:{section_id}` |
| Analytics summary | 15 min | `analytics:class:{section_id}` |
| Notification unread count | 30 sec | `notif_count:{user_id}` |

### Pattern

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

Cache invalidation: clear on write operations (new point event, new notification, etc.).

---

## Sprint 3 — PWA Offline Assessment Queue 📱

**Complexity:** 3–4 hours  
**Value:** High — allows rural students to complete assessments without internet

### Current offline state:
- ✅ App shell cached (HTML/CSS/JS)
- ✅ Text lessons saved to IndexedDB (`offline.ts`)
- ✅ Flashcard decks saved to IndexedDB
- ❌ Assessment submissions not queued when offline
- ❌ Video/PDF not downloadable for offline playback

### Assessment queue implementation:

**`public/sw.js` — Background sync handler:**
```javascript
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-assessment-submissions') {
    event.waitUntil(flushAssessmentQueue());
  }
});
```

**`src/services/offline.ts` — Queue store:**
```typescript
const ASSESSMENT_QUEUE_STORE = 'assessment_queue';

export async function queueAssessmentSubmission(assessmentId: number, answers: Answer[]) {
  const db = await openDB();
  await db.add(ASSESSMENT_QUEUE_STORE, { assessmentId, answers, queuedAt: Date.now() });
  await navigator.serviceWorker.ready;
  await (navigator.serviceWorker as any).sync?.register('sync-assessment-submissions');
}
```

**`src/pages/AssessmentPage.tsx` — Use queue when offline:**
```typescript
if (!navigator.onLine) {
  await queueAssessmentSubmission(assessmentId, selectedAnswers);
  showToast("Saved offline — will submit when you're back online");
} else {
  await submitAttempt(assessmentId, selectedAnswers);
}
```

---

## Sprint 4 — Video & PDF Offline Downloads 📥

**Complexity:** 3–4 hours  
**Value:** Critical for rural areas with poor connectivity

### Architecture:

1. **Download manager** — `src/services/offlineSync.ts` already has stubs
2. **Cache API for videos** — Store HLS segments or MP4 in Cache Storage (separate from service worker cache)
3. **IndexedDB for PDFs** — Store as ArrayBuffer
4. **Downloads page** — `/downloads` already exists, needs real download functionality
5. **Background download** — Use Service Worker + Fetch API for large files

### Key challenge: Storage quota
- Request storage persistence: `navigator.storage.persist()`
- Show storage usage to user
- Warn when quota is low

---

## Sprint 5 — Enhanced Analytics Dashboard 📊

**Complexity:** 2–3 hours  
**Value:** Medium — improves admin visibility

### What to add:

**District Official dashboard** — Currently shows basic stats. Add:
- Student risk tier distribution per institution (bar chart)
- Engagement trend over last 30 days
- Top/bottom performing schools

**Teacher dashboard** — Add:
- "At risk" student alert panel (feeds from nightly recompute)
- Weekly engagement heatmap per student

**Principal dashboard** — Add:
- Teacher activity summary (lessons created, assessments graded)
- Cross-class comparison of assessment pass rates

---

## Sprint 6 — Gradebook Enhancements 📝

**Complexity:** 2–3 hours  
**Value:** Medium — teacher workflow

### What's missing:
- **Term totals** — Auto-sum oral + practical + test per student per term
- **Pass/Fail threshold** — Configurable per subject
- **Export to Excel** — `openpyxl` to generate marks sheets
- **Bulk entry** — Table-based UI for faster mark entry (like a spreadsheet)

---

## Sprint 7 — Competition Improvements 🏆

**Complexity:** 2–3 hours  
**Value:** Medium — student engagement

### What to add:
- **Countdown timer** — Per-question timer (currently no enforced time limit)
- **Spectator mode** — Let teachers watch without participating
- **Competition history** — Past competition results per student
- **Scheduled competitions** — Create competition with future start time

---

## Sprint 8 — Admin Panel Improvements 🛠️

**Complexity:** 1–2 hours  
**Value:** Medium — operational

### What to add:
- **Bulk join code generation** — Generate 30 student codes in one click
- **User search** — Search by username/name/public_id in admin panel
- **Section reassignment** — Move a student between sections
- **Content import** — Bulk lesson import from JSON/CSV

---

## Infrastructure Improvements

### 1. Supabase Upgrade Consideration
Free tier pauses after 1 week of inactivity. If the platform is used by real schools:
- Upgrade to **Pro ($25/mo)** — no pausing, daily backups, 8GB storage
- OR migrate to **Neon** (serverless PostgreSQL, free, no pausing)

### 2. Horizontal Scaling (future)
Oracle A1.Flex can be expanded to 4 OCPUs + 24GB RAM (still Always Free).
If load exceeds single-VM capacity:
- Move to **OCI Load Balancer** + 2 VMs
- Move static files to Cloudflare R2 with CDN URL (WhiteNoise bypass)

### 3. Monitoring
- Add **Uptime Kuma** or **BetterStack** for uptime monitoring beyond QStash health pings
- Set up Sentry performance tracing for slow API endpoints

### 4. Database Connection Pooling
- Consider **PgBouncer** or Supabase's built-in Supavisor for connection pooling
- Current `CONN_MAX_AGE=60` works but can cause long-held connections under load

---

## Research Paper Focus Areas

For the capstone research paper, the following can be highlighted:

1. **Predictive risk analytics** — ML-inspired weighted signal system for at-risk student identification
2. **Zero-cost infrastructure stack** — $2.67/mo total for a full-featured ed-tech platform
3. **Rural-optimised PWA** — Offline-first architecture for intermittent connectivity
4. **Multi-provider AI fallback** — Reliability engineering for free-tier AI services
5. **Gamification design** — Ledger-based points + SM-2 spaced repetition for retention
6. **Single-device enforcement** — Server-side session architecture for shared-device households

---

## Architecture Decision Queue (Pending)

| Decision | Options | When Needed |
|---|---|---|
| Video CDN | Cloudflare R2 (current) vs Cloudflare Stream | If video playback becomes slow |
| DB upgrade | Supabase Free → Pro vs Neon | If DB pauses become a problem |
| Auth upgrade | Sessions (current) vs next-auth with JWT | If multi-device becomes a feature requirement |
| Background tasks | QStash (current) vs Celery | If task complexity grows beyond cron |
