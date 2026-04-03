# GyanGrit — Future Tasks & Technical Roadmap

> **Living document.** Prioritized list of upcoming features, upgrades, and architectural improvements.
> Updated: 2026-04-03 | Backend: Oracle Cloud Mumbai | Frontend: Vercel
>
> Priority tiers: 🔴 P0 (critical) · 🟠 P1 (high) · 🟡 P2 (medium) · 🟢 P3 (nice to have)

---

## ⚡ NEXT SESSION — START HERE

> Do these **before** starting any feature work. They are small, impactful, and unblocking.

### 🔴 SECURITY — Fix Immediately

#### 1. Leaked GitHub PAT in `.env.example`
`backend/.env.example` line 39 contains a **live GitHub Personal Access Token** hardcoded as an example command:
```
git clone https://M1D0R1x:github_pat_11BOXMJBI0Ytxxxx...@github.com/...
```
**This PAT may still be valid and is publicly visible if the repo is ever shared.**

```bash
# Immediately:
# 1. Go to https://github.com/settings/tokens → Revoke the token shown in .env.example
# 2. Then fix the file:
```
Remove line 39 from `backend/.env.example` entirely — no token should ever appear in any committed file, even as a comment or example.

---

### 🟠 ACTUAL CODE CHANGES STILL PENDING (documented in FUTURE_TASKS but not yet applied)

These are changes we **planned** this session but only wrote docs for — the actual files still have old values:

#### 1. `backend/gunicorn.conf.py` — Worker count & timeout
```python
# CURRENT (still in file):    workers = 2,  timeout = 120
# NEEDS TO BECOME:            workers = 5,  timeout = 30
```
> Rule: `2 × OCPU + 1 = 5` for your 2-OCPU Oracle instance. Timeout was for Render cold starts (gone now).

#### 2. `backend/gyangrit/settings/prod.py` — DB connection pooling
```python
# CURRENT (still in file):    conn_max_age=0
# NEEDS TO BECOME:            conn_max_age=60
```
> Safe now that you're using gthread workers (not gevent) and DB is same-region.

#### 3. `backend/requirements/prod.txt` — Together AI SDK
```bash
# ADD this line to prod.txt:
together>=1.3      # Together AI Python SDK (for Llama-4-Maverick fallback)
```
> Also run on Oracle: `source /opt/gyangrit/backend/venv/bin/activate && pip install together`

#### 4. `backend/gyangrit/settings/base.py` — New env var settings
```python
# ADD these to base.py (below GEMINI_API_KEY):
GROQ_API_KEY    = os.environ.get("GROQ_API_KEY", "")
TOGETHER_API_KEY = os.environ.get("TOGETHER_API_KEY", "")
```

#### 5. GitHub Actions — `dev.txt` check
The new `deploy.yml` lint job does `pip install -r backend/requirements/dev.txt`.
Verify `dev.txt` includes at minimum: `django`, `dj-database-url`, and any other imports checked by Django's system check.
```bash
cat backend/requirements/dev.txt  # make sure it has all needed packages
```

---

### 🟡 ONE-TIME ORACLE CLOUD TASKS (SSH in once)

```bash
ssh ubuntu@161.118.168.247

# 1. Generate webhook secret for LiveKit recording callbacks
openssl rand -hex 32
# → copy output → set as LIVEKIT_RECORDING_WEBHOOK_SECRET in env

# 2. Install Together AI SDK in venv
source /opt/gyangrit/backend/venv/bin/activate
pip install together
pip freeze | grep together  # verify

# 3. Verify systemctl reload works (needed for new deploy.yml)
sudo systemctl reload gyangrit
# If this fails, add ExecReload to /etc/systemd/system/gyangrit.service:
# ExecReload=/bin/kill -HUP $MAINPID
# Then: sudo systemctl daemon-reload
```

---

### 🟢 SPRINT 1 FEATURE WORK (after above is done)

Start here for actual feature development — in this order:
1. **AI Chatbot fix** → create `apps/ai_assistant/providers.py` (Groq → Together → Gemini chain)
2. **AI Tools page** → flashcard generator + assessment generator (teacher flow)
3. **Recording model** → add fields to `LiveSession`, run migration, wire Egress

---

## CURRENT PRODUCTION STATE (as of 2026-04-03)

| Layer | Stack | Status |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript → Vercel | ✅ Live |
| Backend | Django 4.2 + Gunicorn (gthread) → Oracle Cloud Mumbai | ✅ Live |
| Database | PostgreSQL via Supabase (Mumbai region) | ✅ Live |
| Real-time | Ably (chat, notifications) + LiveKit (WebRTC live classes) | ✅ Live |
| Media / Recordings | Cloudflare R2 | ✅ Configured |
| Cache / Sessions | Upstash Redis | ✅ Session store only |
| AI Chatbot | Gemini 2.0 Flash | ⚠️ Rate-limited |
| Analytics | EngagementEvent heartbeat model | ✅ Basic |
| PWA | App shell cached, IndexedDB for offline lessons/flashcards | ⚠️ Partial |
| Background Jobs | QStash configured (keys obtained) | ⚠️ Partial |

### Oracle Cloud Instance Details

| Property | Value |
|---|---|
| Instance Name | Gyangrit |
| Region | ap-mumbai-1 (AD-1, FD-3) |
| Shape | VM.Standard.A1.Flex (ARM / aarch64) |
| OCPU | **2 OCPU** |
| RAM | **12 GB** |
| Network | 2 Gbps |
| OS | Ubuntu 24.04 LTS (aarch64) |
| Public IP | 161.118.168.247 |
| SSH User | ubuntu |
| App Path | /opt/gyangrit |
| Service | gyangrit (systemd) |
| Backend URL | https://api.gyangrit.site |

---

## SECTION 1 — 🎥 LIVE CLASS RECORDING + RECORDED SESSIONS PAGE

### 1.1 Overview
When a teacher ends a live class, the LiveKit session should be automatically recorded, uploaded to Cloudflare R2 under a structured naming convention, and made permanently available to students on a dedicated **Recorded Sessions** page.

### 1.2 R2 Naming Convention (MANDATORY)

```
recordings/{institution_id}/{grade}-{section}/{subject}/{YYYY-MM-DD}_{HH-MM}_{session_title_slug}.mp4
```

**Examples:**
```
recordings/101/10-A/Mathematics/2026-04-03_10-30_Trigonometry-Basics.mp4
recordings/101/9-B/Science/2026-04-03_14-00_Newton-Laws-Motion.mp4
```

- `session_title_slug` = title with spaces replaced by `-`, lowercased, max 60 chars
- `YYYY-MM-DD_HH-MM` = session `started_at` timestamp (IST)
- All metadata (title, date, grade, subject, teacher) stored in DB for sorting/filtering

### 1.3 Backend Work

#### Model Changes — `apps/livesessions/models.py`
Add fields to `LiveSession`:
```python
recording_r2_key   = models.CharField(max_length=500, blank=True)   # R2 object key
recording_url      = models.URLField(blank=True)                     # Public CDN URL
recording_status   = models.CharField(max_length=20, choices=[
    ('none','None'), ('processing','Processing'),
    ('ready','Ready'), ('failed','Failed')
], default='none')
recording_duration_seconds = models.PositiveIntegerField(null=True, blank=True)
recording_size_bytes       = models.BigIntegerField(null=True, blank=True)
```

#### LiveKit Egress API — `apps/livesessions/recording.py` [NEW FILE]
```python
# Use LiveKit Egress API to start room composite recording when session starts
# Triggered on session_start → POST to LiveKit Egress endpoint
# LiveKit will push the MP4 to a pre-signed R2 URL

def start_recording(session: LiveSession) -> str:
    """Start LiveKit Egress for room composite → S3-compatible R2."""
    # POST https://<livekit_host>/twirp/livekit.Egress/StartRoomCompositeEgress
    # Output: R2 key from naming convention

def handle_recording_webhook(payload: dict):
    """
    LiveKit sends webhook when egress completes.
    POST /api/v1/live/recording-webhook/
    Updates LiveSession.recording_status = 'ready' and recording_url
    """
```

#### New API Endpoints — `apps/livesessions/views.py`
```
POST /api/v1/live/recording-webhook/     — LiveKit → Egress completion callback
GET  /api/v1/live/recordings/            — list all recordings (students: own section)
GET  /api/v1/live/recordings/<id>/       — get single recording detail
```

#### 🔑 How to Get the Keys — LiveKit Egress

**If using LiveKit Cloud (recommended — easiest):**
1. Go to [cloud.livekit.io](https://cloud.livekit.io) → your project → **Settings → Keys**
2. Your existing `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` already cover Egress — no new key needed
3. Egress is enabled by default on all LiveKit Cloud plans (free tier included)
4. The Egress endpoint is your project's LiveKit host URL

**⚠️ Self-hosted LiveKit note:** Egress requires deploying the `livekit-egress` Docker container on Oracle Cloud.
But since you're on **LiveKit Cloud** — skip this entirely. Egress is built in.

**Cloudflare R2 — Using existing `gyangrit-media` bucket:**
- ✅ Bucket `gyangrit-media` already exists and is configured
- ✅ No new bucket needed — recordings go into `gyangrit-media/recordings/`
- ✅ Same `CLOUDFLARE_R2_ACCESS_KEY_ID` / `CLOUDFLARE_R2_SECRET_ACCESS_KEY` credentials work
- The recording object key will look like:
  `recordings/101/10-A/Mathematics/2026-04-03_10-30_Trigonometry-Basics.mp4`
  → full R2 path: `gyangrit-media/recordings/101/...`

#### env vars needed:
```
# LiveKit Cloud (existing keys already cover Egress — only new var is the webhook secret)
LIVEKIT_RECORDING_WEBHOOK_SECRET=your-webhook-secret  # generate: openssl rand -hex 32

# Cloudflare R2 — reuse existing bucket, just set the recordings prefix
CLOUDFLARE_R2_BUCKET_NAME=gyangrit-media              # already set ✅
CLOUDFLARE_R2_RECORDINGS_PREFIX=recordings/           # new — used to namespace recordings
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxx.r2.dev       # already set ✅
```

### 1.4 Frontend Work

#### New Page: `RecordedSessionsPage.tsx`
- Route: `/recordings`
- Accessible by: Students (own section only), Teachers (own sessions), Admin/Principal (all)
- Features:
  - Filter by: Subject, Date range, Grade/Section
  - Sort by: Date (newest first), Subject, Duration
  - Cards showing: Session title, Teacher, Subject, Date, Duration, Recording status badge
  - Click → video player modal or dedicated player page
  - Search by session title

#### New Page: `RecordingPlayerPage.tsx`
- Route: `/recordings/:sessionId`
- HLS-compatible video player (use `hls.js` already used for lessons)
- Show: session title, teacher, date, subject, attendance count
- Chapter markers if available
- Download option (for offline viewing — teachers/admins only)

#### Session Detail enhancement
- On `LiveSessionPage.tsx` after session ends → show "Recording processing…" banner
- Once ready → "Watch Recording" button appears

### 1.5 LiveKit Egress Setup
LiveKit Cloud has built-in Egress. For self-hosted LiveKit:
```bash
# Install LiveKit Egress service alongside LiveKit server
# Configure S3-compatible output pointing to Cloudflare R2
# R2 S3 endpoint: https://<account_id>.r2.cloudflarestorage.com
```

### 1.6 Implementation Order
1. Add DB fields + migration
2. Wire `session_start` to trigger Egress via LiveKit API
3. Add recording webhook endpoint
4. Upload handler with naming convention
5. List/detail API endpoints
6. `RecordedSessionsPage.tsx` + `RecordingPlayerPage.tsx`
7. Add "Recordings" link to sidebar nav for all roles

---

## SECTION 2 — 🤖 AI FEATURES

### 2.1 Fix AI Chatbot — Replace Gemini (Rate Limit Issue)

**Current problem:** `apps/ai_assistant/views.py` uses `gemini-2.0-flash` which hits 429 rate limits constantly on the free tier (15 req/min, shared across all users).

**Solution: Multi-provider fallback chain**

#### Option A — Groq (Primary, ✅ Already Added)
- **Free tier**: 30 req/min, 14,400 req/day
- **Model**: `llama-3.3-70b-versatile` (latest, best quality on Groq)
- **API**: OpenAI-compatible REST — no SDK needed
- **Cost**: Free, `GROQ_API_KEY` already in env ✅

**API call pattern (Python, used in `providers.py`):**
```python
import requests

def _call_groq(messages: list, system_prompt: str) -> str:
    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "max_tokens": 512,
            "temperature": 0.7,
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]
```

**🔑 Key already in env** — `GROQ_API_KEY=gsk_...` ✅

#### Option B — Together AI (Fallback, ✅ Already Added)
- **Model**: `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8` (Llama 4, latest)
- **SDK**: `together` Python package
- **Cost**: $25 free credit on signup, `TOGETHER_API_KEY` already in env ✅

**API call pattern (Python, using Together SDK):**
```python
# pip install together
from together import Together

def _call_together(messages: list, system_prompt: str) -> str:
    client = Together()  # reads TOGETHER_API_KEY from env automatically
    response = client.chat.completions.create(
        model="meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
        messages=[{"role": "system", "content": system_prompt}] + messages,
        max_tokens=512,
        temperature=0.7,
    )
    return response.choices[0].message.content
```

**🔑 Key already in env** — `TOGETHER_API_KEY=...` ✅

**⚠️ Install SDK on Oracle Cloud:**
```bash
source /opt/gyangrit/backend/venv/bin/activate
pip install together
```

**Recommended Implementation: Groq → Together AI → Gemini fallback chain**

```python
# apps/ai_assistant/providers.py [NEW]
# Priority: Groq (fastest, free) → Together AI (Llama 4) → Gemini (last resort)

PROVIDER_CHAIN = [
    {"name": "groq",    "key_env": "GROQ_API_KEY",    "model": "llama-3.3-70b-versatile"},
    {"name": "together","key_env": "TOGETHER_API_KEY", "model": "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8"},
    {"name": "gemini",  "key_env": "GEMINI_API_KEY",   "model": "gemini-2.0-flash"},
]

def call_ai(messages: list, context: str) -> str:
    for provider in PROVIDER_CHAIN:
        key = os.environ.get(provider["key_env"], "") if provider["key_env"] else ""
        if not key:
            continue  # skip if key not configured
        try:
            return _call_provider(provider, messages, context)
        except RateLimitError:
            logger.warning("Provider %s rate-limited, trying next", provider["name"])
            continue
        except Exception as exc:
            logger.error("Provider %s error: %s", provider["name"], exc)
            continue
    return "All AI providers are busy right now. Please try again in a minute."
```

**env vars (all already set ✅):**
```
# ✅ Already in Oracle Cloud env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
TOGETHER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxx
```

**pip install needed on Oracle Cloud:**
```bash
source /opt/gyangrit/backend/venv/bin/activate
pip install together   # Together AI SDK
# groq and gemini use raw requests — no extra package needed
```

**Files to change:**
- `backend/apps/ai_assistant/views.py` — replace `_call_gemini()` with `call_ai()`
- `backend/gyangrit/settings/base.py` — add new env var references

### 2.2 AI Flashcard Generator

**Concept:** Teacher opens a lesson or uploads a PDF/text → AI generates a flashcard deck → Teacher can edit cards → Publishes to students.

#### Backend — `apps/flashcards/views.py` (add endpoint)
```
POST /api/v1/flashcards/ai-generate/
Body: { lesson_id: int } OR { text: string, subject_id: int }
Response: { deck_id: int (draft), cards: [{front, back, hint}] }
```

**Implementation:**
```python
def ai_generate_flashcards(request):
    # 1. Extract text from lesson content OR uploaded doc
    # 2. Build prompt: "Generate 10 flashcard pairs from this content..."
    # 3. Call Groq/Gemini with JSON output mode
    # 4. Parse response into FlashcardDeck (status='draft', visible=False)
    # 5. Return draft deck_id + cards for teacher to edit
    # 6. Teacher edits → POST /flashcards/ai-generate/<deck_id>/publish/
    #    → sets visible=True, notifies students
```

**Model change needed — `apps/flashcards/models.py`:**
```python
class FlashcardDeck(models.Model):
    # ... existing fields ...
    status = models.CharField(choices=[('draft','Draft'),('published','Published')], default='published')
    ai_generated = models.BooleanField(default=False)
    source_lesson = models.ForeignKey('content.Lesson', null=True, blank=True, on_delete=models.SET_NULL)
```

#### Frontend — Teacher Flow
- **Route:** `/teacher/ai-tools` or button inside `AdminContentPage`
- Source selector: "From Lesson" | "Paste Text" | "Upload PDF"
- Loading state while AI generates
- Editable card list (teacher can edit front/back/hint, delete cards, add cards)
- "Publish to Students" button → calls publish endpoint
- Student notifications sent on publish

### 2.3 AI Assessment Generator

**Concept:** Teacher selects a lesson/topic → AI generates MCQ/short-answer questions → Teacher edits → Publishes as an assessment.

#### Backend — `apps/assessments/views.py` (add endpoint)
```
POST /api/v1/assessments/ai-generate/
Body: {
  lesson_id: int (optional),
  text: string (optional),
  subject_id: int,
  question_count: int (5–20),
  difficulty: "easy"|"medium"|"hard",
  question_types: ["mcq", "true_false", "short_answer"]
}
Response: { assessment_id: int (draft), questions: [...] }
```

**AI Prompt template:**
```
Generate {count} {difficulty} questions about the following content.
Return JSON array: [{type, question, options (for MCQ), correct_answer, explanation}]
Content: {content}
```

**Model change needed — `apps/assessments/models.py`:**
```python
class Assessment(models.Model):
    # ... existing fields ...
    status = models.CharField(choices=[('draft','Draft'),('published','Published')], default='published')
    ai_generated = models.BooleanField(default=False)
    source_lesson = models.ForeignKey('content.Lesson', null=True, blank=True, on_delete=models.SET_NULL)
```

#### Frontend — Teacher Flow
- Route: `/teacher/ai-tools` (shared with flashcard generator, tabbed)
- Options: lesson picker, difficulty, question type, number of questions
- Review screen: question cards with correct answer highlighted
- Edit in place (change question text, options, correct answer)
- "Publish Assessment" → saves + notifies students

### 2.4 AI Teacher Tools — Shared Page

**Route:** `/admin/ai-tools` (available to TEACHER, PRINCIPAL, ADMIN)

**Tabs:**
1. **Generate Flashcards** — from lesson or text
2. **Generate Assessment** — from lesson or text
3. **Drafts** — unpublished AI-generated content

---

## SECTION 3 — 📊 ANALYTICS & PREDICTIVE AI DASHBOARD

### 3.1 Click & Activity Telemetry (Behavioural Tracking)

Everything a user does should be tracked and analyzed. Currently we only track lesson views, live session watch time, assessments, AI chat, and flashcard study.

**Expand `EngagementEvent` types:**

```python
class EventType(models.TextChoices):
    # Existing
    LESSON_VIEW      = "lesson_view"
    LIVE_SESSION     = "live_session"
    ASSESSMENT       = "assessment"
    AI_CHAT          = "ai_chat"
    FLASHCARD_STUDY  = "flashcard_study"
    # New
    LESSON_COMPLETE  = "lesson_complete"       # student marks lesson done
    ASSESSMENT_PASS  = "assessment_pass"       # score >= pass threshold
    ASSESSMENT_FAIL  = "assessment_fail"       # score < pass threshold
    LOGIN            = "login"                  # session start
    RECORDING_VIEW   = "recording_view"         # watched a recording
    CHATROOM_MSG     = "chatroom_msg"           # sent a chat message
    COMPETITION      = "competition"            # joined a competition
    STREAK_BREAK     = "streak_break"           # missed a day
    NOTIFICATION_CLICK = "notification_click"  # clicked a notification
    PAGE_VISIT       = "page_visit"             # generic page visit with path
```

**Frontend analytics middleware — `src/utils/telemetry.ts` [NEW]:**
```typescript
// Wrap router navigation → log every page visit
// Use React error boundary → log JS errors
// Track click events on key UI elements
// sendHeartbeat() already handles lesson/session time
```

### 3.2 Predictive AI — Risk Assessment

**Goal:** Identify students at risk of falling behind BEFORE it happens, using behavioural signals.

#### Risk Score Model — `apps/analytics/risk.py` [NEW FILE]

```python
"""
Risk Score = weighted sum of:
  - Days since last login (weight: 0.25)
  - Avg assessment score trend (last 5 vs prev 5) (weight: 0.30)
  - Lesson completion rate (weight: 0.20)
  - Live session attendance rate (weight: 0.15)
  - AI chat usage (engagement proxy) (weight: 0.10)

Score: 0–100 (0 = very high risk, 100 = very healthy)
Risk Tiers:
  80–100: 🟢 On Track
  60–79:  🟡 Needs Attention
  40–59:  🟠 At Risk
  0–39:   🔴 Critical
"""

def compute_student_risk(student, window_days=14) -> dict:
    return {
        "score": int,
        "tier": "on_track" | "needs_attention" | "at_risk" | "critical",
        "factors": {
            "login_recency": float,      # days since last login
            "assessment_trend": float,   # improving/declining
            "completion_rate": float,    # % lessons completed
            "attendance_rate": float,    # % live sessions attended
            "ai_engagement": float,      # AI messages sent
        },
        "recommendation": str,           # human-readable suggestion
    }
```

**Backend schedule:** Recompute risk scores nightly via QStash cron.
Store in `StudentRiskScore` model: `user, date, score, tier, factors_json`.

#### New Model — `apps/analytics/models.py`
```python
class StudentRiskScore(models.Model):
    user          = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date          = models.DateField(auto_now_add=True)
    score         = models.SmallIntegerField()   # 0–100
    tier          = models.CharField(max_length=20)
    factors_json  = models.JSONField(default=dict)
    recommendation = models.TextField(blank=True)
    class Meta:
        unique_together = ('user', 'date')
        ordering = ['-date']
```

#### Automatic Notifications for Risk Alerts
- If student drops to "At Risk" → notify **student** + **teacher** + **principal**
- If student is "Critical" for 3+ consecutive days → notify **all of the above** + flag for special care
- Notifications include: what's dipping, specific recommendation ("You haven't logged in for 5 days. Try the Algebra flashcards!")

### 3.3 Dashboard Upgrades

#### Student Dashboard (`DashboardPage.tsx`)
Add:
- My Risk Score card (🟢/🟡/🟠/🔴 with label)
- Weekly activity heatmap (GitHub-style calendar)
- Streak indicator (consecutive days active)
- AI-generated study suggestion ("You're falling behind in Chapter 3 — spend 20 min reviewing")
- Upcoming live sessions widget

#### Teacher Dashboard (`TeacherDashboardPage.tsx`)
Add:
- Class Risk Overview — pie chart: how many students in each tier
- Students needing attention — sorted list with risk score
- Per-student drill-down: engagement trend charts, assessment history
- "Assign Special Task" button → sends targeted notification to at-risk students
- Attendance rate heatmap by session

#### Principal Dashboard (`PrincipalDashboardPage.tsx`)
Add:
- School-wide risk distribution by grade/class
- Subject-level performance comparison
- Teacher activity summary (classes conducted, assessments set)
- Trend charts: enrollment, assessment pass rates, live session usage
- Export report as PDF/CSV

#### Official/Admin Dashboard (`OfficialDashboardPage.tsx` / `AdminDashboardPage.tsx`)
Add:
- Multi-school overview (for district officials)
- Comparative analytics: institution performance ranking
- AI-generated district report summary
- Alert feed: schools/students flagged as high risk

### 3.4 Analytics API Endpoints

```
GET  /api/v1/analytics/student/<id>/risk/         — student's risk details
GET  /api/v1/analytics/class/<section_id>/risk/   — all students risk in section
GET  /api/v1/analytics/teacher/overview/           — teacher's class summary
GET  /api/v1/analytics/school/overview/            — principal's school summary
GET  /api/v1/analytics/district/overview/          — official's district summary
POST /api/v1/analytics/recompute-risk/             — trigger risk recomputation (admin)
```

---

## SECTION 4 — 📶 PWA — OFFLINE DOWNLOADS & BACKGROUND SYNC

### 4.1 Current State
- ✅ App shell cached (HTML/CSS/JS)
- ✅ Text lessons saved to IndexedDB via `offline.ts`
- ✅ Flashcard decks saved to IndexedDB
- ❌ **NO offline assessment queuing**
- ❌ **NO background sync for progress**
- ❌ **NO offline video downloads**
- ❌ **NO offline quiz submission queue**

### 4.2 Offline Assessment Queue — `sw.js` upgrade

```javascript
// In sw.js — Background Sync for queued assessment submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-assessment-submissions') {
    event.waitUntil(flushAssessmentQueue());
  }
  if (event.tag === 'sync-progress') {
    event.waitUntil(flushProgressQueue());
  }
});

async function flushAssessmentQueue() {
  const db = await openOfflineDB();
  const queued = await db.getAll('assessment_queue');
  for (const submission of queued) {
    try {
      await fetch('/api/v1/assessments/submit/', {
        method: 'POST',
        body: JSON.stringify(submission),
        headers: { 'Content-Type': 'application/json' },
      });
      await db.delete('assessment_queue', submission.id);
    } catch { /* stay in queue, retry next sync */ }
  }
}
```

**IndexedDB stores to add (in `offline.ts`):**
```typescript
const ASSESSMENT_QUEUE_STORE  = 'assessment_queue';   // pending submissions
const PROGRESS_QUEUE_STORE    = 'progress_queue';     // pending heartbeats
const ASSESSMENT_CACHE_STORE  = 'assessments';        // downloaded assessment questions
```

**Flow:**
1. Student opens assessment → cached in `assessments` store
2. Student answers offline → answers stored in `assessment_queue`
3. Service Worker Background Sync fires when network returns
4. Submission is POSTed to backend
5. Show "Submitted ✓" notification

### 4.3 Offline Video Downloads (Lessons)
- Videos are stored on Cloudflare R2. Mobile browsers cannot download R2 URLs directly to cache.
- **Strategy**: Use the `Cache Storage API` + a custom download manager
- Teacher marks a lesson as "downloadable"
- Student taps "Download for offline" → SW fetches the HLS playlist + segments
- Segments cached under `gyangrit-videos-v1`
- On LessonPage: if video segments are cached → serve from cache (no network needed)

**Note:** This will use 100–500 MB per video. Add clear storage UI in Profile page.

### 4.4 Offline Mode Indicator
- Persistent banner when `navigator.onLine === false`
- Show which lessons/decks are available offline (green dot)
- Auto-sync notification when back online ("3 progress events synced ✓")

---

## SECTION 5 — 🔴 REDIS — CURRENT USAGE & EXPANSION

### 5.1 What Redis Is Currently Used For
Redis (Upstash) is currently wired in `prod.py` for:
1. **Session store** — `SESSION_ENGINE = 'django.contrib.sessions.backends.cache'`
2. **Django cache backend** — `CACHES['default']`

That's it. It is severely underutilized.

### 5.2 Redis Expansion Plan

#### 5.2.1 API Response Caching (Quick Win — 2–3x speedup)
Cache expensive queries that don't change often:
```python
from django.core.cache import cache

def get_leaderboard(section_id):
    key = f"leaderboard:{section_id}"
    cached = cache.get(key)
    if cached: return cached
    data = compute_leaderboard(section_id)
    cache.set(key, data, timeout=300)  # 5 min TTL
    return data
```

**Caching targets (TTL):**
| Data | TTL | Invalidated on |
|---|---|---|
| Leaderboard | 5 min | PointEvent created |
| Section subject list | 1 hour | TeachingAssignment change |
| Course/lesson list | 30 min | Content update |
| Student risk score | 6 hours | Nightly recompute |
| Analytics summaries | 15 min | New heartbeat |
| Notification count | 30 sec | New Notification created |

#### 5.2.2 Rate Limiting (Replace manual sleep())
Current code `time.sleep()` blocks Gunicorn workers. Replace with Redis-based sliding window:
```python
# apps/ai_assistant/ratelimit.py [NEW]
def check_ai_rate_limit(user_id: int, max_per_minute=10) -> bool:
    key = f"ai_rate:{user_id}:{int(time.time() // 60)}"
    count = cache.incr(key)
    if count == 1:
        cache.expire(key, 90)  # 90s TTL  
    return count <= max_per_minute
```

#### 5.2.3 Deduplication & Idempotency
```python
# Prevent double-submission of assessments
def submit_assessment(user_id, submission_id, ...):
    key = f"submitted:{user_id}:{submission_id}"
    if cache.get(key):
        return JsonResponse({"error": "Already submitted"}, status=409)
    cache.set(key, True, timeout=3600)
    # ... process submission
```

#### 5.2.4 Pub/Sub for Real-time Events
Use Redis Pub/Sub as a secondary real-time channel alongside Ably:
- Risk score updates → push to teacher dashboard without page reload
- New recording ready → notify students in section

#### 5.2.5 Celery Task Queue (Replacing QStash for local tasks)
QStash is great for remote delay, but for local background tasks (AI generation, risk score computation), use Celery + Redis:
```python
# celery.py + tasks.py
@shared_task
def generate_flashcards_task(lesson_id, teacher_id):
    """Long-running AI task — don't block the HTTP response."""
    ...

@shared_task
def recompute_risk_scores():
    """Nightly cron via Celery beat."""
    ...
```

---

## SECTION 6 — ⚡ ORACLE CLOUD PERFORMANCE OPTIMIZATION

### 6.1 Current Configuration

| Property | Current | Notes |
|---|---|---|
| Shape | VM.Standard.A1.Flex | ARM64/aarch64 |
| OCPU | 2 | Can scale to 4 on free tier |
| RAM | 12 GB | Generous headroom |
| Workers | 2 gthread × 4 threads = 8 concurrent | Underutilizing RAM |
| Timeout | 120s | Was for Render cold starts, no longer needed |
| conn_max_age | 0 | Should be raised now DB is same-region |

> ⚠️ **ARM64 note:** All pip packages must have ARM64 wheels. Confirmed working: gunicorn, psycopg2-binary, redis, boto3, sentry-sdk. If adding new packages, check [piwheels.org](https://piwheels.org) for ARM compatibility.

### 6.2 Immediate Wins

#### Gunicorn Tuning — `backend/gunicorn.conf.py`
```python
# Current: VM.Standard.A1.Flex — 2 OCPU, 12GB RAM, ARM64
# Rule of thumb: workers = 2 × OCPU + 1
workers   = 5          # was 2 — 2×2+1=5 workers for 2 OCPU
threads   = 4          # keep 4 threads per worker = 20 concurrent requests
timeout   = 30         # was 120 — DB is same-region, no cold starts
keepalive = 75         # keep-alive for Nginx → Gunicorn upstream reuse

# Memory budget per worker: ~150MB Django + 50MB buffer = ~200MB
# 5 workers × 200MB = 1GB used, leaving 11GB for OS, DB cache, Redis
# (Upstash Redis is cloud, but local Redis can be added later)
```

#### Database Connection Pooling — `settings/prod.py`
```python
# Now that DB and backend are in the same region, we can use persistent connections
DATABASES = {
    "default": dj_database_url.config(
        default=_db_url,
        conn_max_age=60,    # was 0 — persist connections for 60s NOW that we use gthread (not gevent)
        conn_health_checks=True,
    )
}
```
> ⚠️ Only safe with `gthread` workers (not `gevent`). Currently using gthread ✅

#### Nginx Tuning — `/etc/nginx/nginx.conf`
```nginx
# Add to http {} block:
gzip on;
gzip_types application/json text/css application/javascript;
gzip_min_length 500;

# Increase upstream keepalive
upstream django {
    server localhost:8000;
    keepalive 16;    # persistent connections to Gunicorn
}

# Add caching headers for static files (WhiteNoise handles this but Nginx is faster)
location /static/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

#### Add DB Indexes for Slow Queries
Based on common usage patterns, add composite indexes:
```python
# apps/analytics/models.py
class Meta:
    indexes = [
        # For teacher class summary queries (most frequent)
        models.Index(fields=['user', 'event_date', 'event_type']),
        # For daily aggregation job
        models.Index(fields=['event_date', 'event_type']),
    ]

# apps/livesessions/models.py
# Add for student "my recordings" query:
models.Index(fields=['section', 'recording_status', '-scheduled_at'])
```

### 6.3 Monitoring on Oracle Cloud

```bash
# Add these to Oracle Cloud setup:
# 1. htop — real-time CPU/RAM monitoring
sudo apt install htop

# 2. pgbadger — PostgreSQL query analysis
pip install pgbadger

# 3. Enable Django query logging in prod for slow queries (>100ms)
# backend/gyangrit/settings/prod.py
LOGGING['loggers']['django.db.backends'] = {
    'handlers': ['console'],
    'level': 'WARNING',  # set to DEBUG temporarily to find slow queries
}
```

### 6.4 Response Time Targets

| Endpoint | Current | Target |
|---|---|---|
| `/api/v1/auth/csrf/` | ~50ms | <20ms |
| `/api/v1/auth/login/` | ~200ms | <100ms |
| `/api/v1/live/sessions/` (list) | ~150ms | <50ms (with Redis cache) |
| `/api/v1/analytics/class-summary/` | ~500ms | <100ms (with Redis cache) |
| `/api/v1/ai/chat/` | ~2–3s | <1s (Groq is faster than Gemini) |

---

## SECTION 7 — 🧠 BEHAVIOURAL ANALYTICS — EVERY CLICK TRACKED

### 7.1 What to Track

| Event | Who | Where to send |
|---|---|---|
| Page visits (every route change) | All | `analytics/event/` → `page_visit` |
| Lesson opened | Student | `analytics/heartbeat/` every 30s |
| Lesson "save offline" clicked | Student | `analytics/event/` → `lesson_download` |
| Video play/pause | Student | `analytics/event/` → `video_interaction` |
| Assessment started | Student | Record timestamp |
| Assessment question answered | Student | Track per-question timing |
| Assessment submitted | Student | Duration + score |
| AI chat opened | Student | `analytics/event/` → `ai_chat` |
| Flashcard flipped | Student | Count interactions |
| Flashcard "I know this" / "Review again" | Student | SM-2 signals |
| Live session joined | Student | `analytics/event/` → `live_session` |
| Live session left | Student | Duration |
| Recording watched | Student | Playback % completed |
| Chat message sent | All | `analytics/event/` → `chatroom_msg` |
| Competition joined | Student | `analytics/event/` |
| Login | All | `analytics/event/` → `login` |
| Notification clicked | All | Track which notification type |

### 7.2 AI Suggestion Engine

Based on behavioural data, generate contextual suggestions:

```python
# apps/analytics/suggestions.py [NEW]

def generate_student_suggestions(student) -> list[dict]:
    """Return 2-3 actionable suggestions for the student dashboard."""
    suggestions = []
    
    # If student hasn't studied in 2+ days
    if days_since_last_login(student) >= 2:
        suggestions.append({
            "type": "engagement",
            "icon": "⚠️",
            "text": f"You haven't studied in {days} days. Your streak is at risk!",
            "action": "Go to Lessons",
            "link": "/courses",
        })
    
    # If assessment score is declining
    if assessment_score_trend(student) < -10:
        subject = weakest_subject(student)
        suggestions.append({
            "type": "academic",
            "icon": "📉",
            "text": f"Your {subject} scores are dropping. Try the flashcards!",
            "link": f"/flashcards?subject={subject}",
        })
    
    # If a live recording they missed is available
    missed = missed_sessions_with_recording(student)
    if missed:
        suggestions.append({
            "type": "recording",
            "icon": "🎥",
            "text": f"You missed '{missed[0].title}'. Watch the recording now.",
            "link": f"/recordings/{missed[0].public_id}",
        })
    
    return suggestions
```

**Suggestions are shown on:**
- Student Dashboard (sidebar card)
- Push notification (daily 6 PM summary)
- Teacher Dashboard (per-student recommendations)

---

## SECTION 8 — 🗂️ WHERE RECORDED SESSIONS ARE SERVED

### 8.1 Dedicated Recordings Page
**URL:** `/recordings`
**Navigation:** Added to sidebar for all roles

**Layout:**
```
Recorded Sessions
├── Search bar (search by title, teacher, subject)
├── Filter chips: [All] [Mathematics] [Science] [Hindi] ...
├── Sort: [Newest ↓] [Oldest] [Subject]
├── Grid of Recording Cards:
│   ┌──────────────────────────────┐
│   │  🎥 Thumbnail (or placeholder)│
│   │  Trigonometry Basics          │
│   │  📚 Mathematics · Class 10-A  │
│   │  👤 Mrs. Priya Sharma         │
│   │  📅 April 3, 2026 · 10:30 AM  │
│   │  ⏱ 45 min · ✅ Ready          │
│   └──────────────────────────────┘
```

**Access rules:**
- Students: see only recordings from their section
- Teachers: see recordings from their classes
- Admin/Principal: see all recordings, filterable by school

### 8.2 Player Page
**URL:** `/recordings/:sessionId`
- HTML5 video player with HLS fallback (`hls.js`)
- Playback speed control (0.75×, 1×, 1.25×, 1.5×, 2×)
- Progress auto-saved → `recording_view` analytics event
- Related upcoming sessions sidebar
- "Report an issue" button (for corruption/quality issues)

---

## SECTION 9 — 🎓 TEACHER AI TOOLS — FULL FLOW

### Workflow Summary
```
Teacher opens /admin/ai-tools
  │
  ├── Tab 1: Generate Flashcards
  │     └── Select lesson OR paste text
  │           └── "Generate" button → AI call (Groq)
  │                 └── Editable deck preview
  │                       └── "Publish to Students" → notifies section
  │
  └── Tab 2: Generate Assessment  
        └── Select lesson + options (count, difficulty, type)
              └── "Generate" button → AI call (Groq)
                    └── Editable question list
                          └── Review: set time limit, pass score
                                └── "Publish Assessment" → students see it
```

**Key rules:**
- All AI-generated content starts as `status='draft'`
- Teacher MUST review before publishing (no auto-publish)
- Teacher can edit every field (question, options, answer, hint)
- Draft content doesn't appear in student views
- Published content goes through normal notification flow
- AI-generated badge shown on published content for transparency

---

## SECTION 10 — 💡 MY SUGGESTED UPGRADES

### 10.1 Smart Homework Reminder System
- Student sets preferred study time (e.g., "7 PM daily")
- QStash sends personalized push notification at that time
- Notification shows: "3 lessons due this week · 1 assessment tomorrow"

### 10.2 Parental Access Portal
- Read-only parent account linked to student
- Parents can see: attendance, risk score, assessment results, teacher comments
- SMS/WhatsApp summary report weekly (via Fast2SMS)
- Parent gets alert when student is marked "Critical Risk"

### 10.3 Voice-to-Text for AI Chatbot
- Students with low literacy can speak their question
- Web Speech API (free, browser-native)
- Audio transcript → sent to AI chatbot
- Works offline for input (recognizes speech offline on Android/iOS)

### 10.4 Study Groups / Peer Learning
- Students can form study groups (max 5) within their section
- Group chat room (reuse ChatRoom model)
- Shared flashcard decks within the group
- Weekly group engagement leaderboard

### 10.5 Teacher Live Annotation (Whiteboard Enhancement)
- Current whiteboard exists — add shape tools, sticky notes
- Save whiteboard state to R2 as PNG after session ends
- Attach screenshot to session recording page

### 10.6 Multi-Language AI Responses
- Current system responds in same language as query (Gemini does this)
- Add explicit language selector: [English] [Hindi] [Punjabi]
- Persist preference per student in their profile
- Groq models (Llama 3.1) support Hindi reasonably well

### 10.7 Content Recommendations (Collaborative Filtering)
- "Students who struggled with Chapter 3 also benefited from…"
- Simple implementation: if assessment score < 50% on topic X → recommend lesson Y
- No ML needed — rule-based recommendations from analytics data

### 10.8 Exam Countdown & Study Planner
- Admin enters exam schedule (dates per subject)
- System auto-generates a study plan (3 lessons/day until exam)
- Daily push notification: "12 days to Math exam · Study: Chapter 7 today"
- Countdown widget on student dashboard

### 10.9 PDF Lesson Annotations
- Students can highlight/annotate PDF lessons (using PDF.js annotation layer)
- Annotations saved to IndexedDB → sync to backend when online
- Teachers can see aggregated "most highlighted" sections

### 10.10 QStash-Powered Weekly Digest
- Every Sunday 8 AM → send all students a weekly summary email
- HTML template: lessons viewed, top scores, attendance, this week's goal
- Teachers get: class engagement summary, at-risk students
- Zero cost (Zoho SMTP free tier)

---

## SECTION 11 — 🛠️ TOOLS & SERVICES NEEDED

| Feature | Tool/Service | Cost | Setup Effort |
|---|---|---|---|
| AI Flashcard/Assessment Gen | **Groq API** (`llama-3.3-70b-versatile`) | Free (30 req/min) | 1–2 hours |
| AI Chatbot fallback | Groq (primary) → Gemini (fallback) | Free | 2 hours |
| Live Recording | **LiveKit Egress** (built-in to LiveKit Cloud) | Included | 3–4 hours |
| Recordings Storage | Cloudflare R2 (separate bucket) | ~$0.015/GB | 1 hour |
| Recordings CDN delivery | Cloudflare R2 public URL + HLS.js | Free | 1 hour |
| Background tasks | **Celery** + Redis | Free (self-hosted) | 2–3 hours |
| Risk score computation | Custom Python (no ML lib needed) | Free | 4 hours |
| Offline assessment sync | SW Background Sync API | Free (browser native) | 3 hours |
| Email digests | QStash cron + Zoho SMTP | Free | 2 hours |
| Rate limiting AI | Redis sorted sets | Already have Redis | 1 hour |
| Behavioural telemetry | Custom analytics middleware | Free | 2 hours |

---

## SECTION 12 — 📋 IMPLEMENTATION ORDER (SPRINT PLAN)

### Sprint 1 — Recording + AI Chatbot Fix (Week 1)
```
Day 1-2: Fix AI chatbot — integrate Groq, fallback chain
Day 3-4: LiveKit Egress setup + R2 naming convention + DB migration
Day 5:   Recording webhook + list/detail API
Day 6-7: RecordedSessionsPage.tsx + RecordingPlayerPage.tsx
```

### Sprint 2 — AI Teacher Tools (Week 2)
```
Day 1-2: AI flashcard generator (backend + Groq prompt)
Day 3-4: AI assessment generator (backend + Groq prompt)
Day 5:   AI Tools page frontend (tabbed, editable, publish flow)
Day 6-7: Test + QA all AI generation flows
```

### Sprint 3 — Analytics & Risk AI (Week 3)
```
Day 1:   Expand EventType choices + frontend telemetry middleware
Day 2-3: Risk score model + compute_student_risk() function
Day 4:   Risk API endpoints
Day 5-6: Dashboard upgrades (Student + Teacher + Principal)
Day 7:   Notification hook for At Risk → Critical alerts
```

### Sprint 4 — PWA Offline + Performance (Week 4)
```
Day 1-2: Offline assessment queue (sw.js + offline.ts)
Day 3:   Background sync for progress events
Day 4:   Gunicorn/Nginx Oracle Cloud tuning
Day 5:   Redis caching for top 6 expensive endpoints
Day 6:   DB connection pooling + index additions
Day 7:   Performance testing + latency validation
```

---

## SECTION 13 — ENV VARS TO ADD

```bash
# ✅ AI Providers (all already added to Oracle Cloud env)
GROQ_API_KEY=gsk_xxx                # Groq — llama-3.3-70b-versatile
TOGETHER_API_KEY=xxx                # Together AI — Llama-4-Maverick-17B
GEMINI_API_KEY=AIzaxxxx             # Gemini 2.0 Flash — already set, now fallback only

# ✅ LiveKit Egress (LiveKit Cloud — existing keys cover Egress)
# Only new var needed:
LIVEKIT_RECORDING_WEBHOOK_SECRET=xxxx  # generate: openssl rand -hex 32

# ✅ Cloudflare R2 — use EXISTING gyangrit-media bucket, recordings/ prefix
CLOUDFLARE_R2_BUCKET_NAME=gyangrit-media           # already set ✅
CLOUDFLARE_R2_RECORDINGS_PREFIX=recordings/        # NEW — prefix for recordings in existing bucket
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxx.r2.dev    # already set ✅

# Backend base URL (for webhooks)
BACKEND_BASE_URL=https://api.gyangrit.site          # already set ✅

# Oracle Cloud Gunicorn tuning
WEB_CONCURRENCY=5   # 2×OCPU+1=5 workers (was 2)
```

---

## SECTION 14 — ARCHITECTURE DECISION RECORDS

### ADR-001: Groq over Gemini for AI Chatbot
**Decision:** Use Groq (Llama 3.1 8B) as primary AI provider, Gemini as fallback.
**Rationale:** Gemini free tier = 15 req/min shared. Groq free tier = 30 req/min with 14,400/day. Groq is also 3–5× faster (response in ~200ms vs 2s).
**Trade-off:** Less brand recognition. Llama 3.1 quality is equivalent for educational Q&A.

### ADR-002: LiveKit Egress for Recording
**Decision:** Use LiveKit's built-in Egress API for recording rather than server-side FFmpeg.
**Rationale:** No additional VM load. LiveKit Cloud handles encoding. Output is ready-to-serve MP4.
**Trade-off:** Requires LiveKit Cloud plan or self-hosted Egress service.

### ADR-003: Redis Rate Limiting over sleep()
**Decision:** Replace `time.sleep()` in AI views with Redis sliding window rate limiter.
**Rationale:** `time.sleep()` blocks Gunicorn gthread threads, reducing concurrency from 16 to 1 per retry.
**Trade-off:** Slightly more complex code; Redis dependency (already present).

### ADR-004: conn_max_age=60 Now That DB is Same Region
**Decision:** Enable persistent DB connections (60s) since backend and DB are now both in Mumbai.
**Rationale:** Previously 0 (zero) because Supabase Singapore → Render Oregon was cross-region and gevent required connection reset. Now gthread workers + same-region DB = safe to persist.
**Trade-off:** Connections held open consume Supabase connection slots. 60s is conservative.

### ADR-005: Dedicated Recorded Sessions Page
**Decision:** Serve recordings on a dedicated `/recordings` page, not embedded in LiveSessionPage.
**Rationale:** Recordings accumulate over time and need their own search/filter/sort UI. Mixing with "upcoming sessions" would create UX confusion.
**Trade-off:** One more route to maintain.

### ADR-006: ARM64 pip packages only
**Decision:** All Python dependencies for Oracle Cloud must have ARM64 (aarch64) wheels.
**Rationale:** Oracle A1.Flex is ARM architecture. x86 wheels will fail to install or run with SIGILL.
**Trade-off:** A few bleeding-edge packages may not have ARM wheels yet — check piwheels.org first.

### ADR-007: Admin role has full access to all features
**Decision:** The ADMIN role has unrestricted access to every endpoint, page, and feature including recordings, AI tools, analytics, student risk data, and all dashboards.
**Rationale:** Admin is the super-user for the institution. PRINCIPAL sees institution-level data. OFFICIAL sees district-level data. Hierarchy: ADMIN > PRINCIPAL > OFFICIAL > TEACHER > STUDENT.
**Trade-off:** Admin credentials must be protected fiercely (2FA recommended).

---

## SECTION 15 — 🔄 CI/CD — GITHUB ACTIONS IMPROVEMENTS

### 15.1 What the Old Workflow Did (Problems)
```yaml
# OLD — 6 lines, no checks, no health validation:
git pull origin master
source backend/venv/bin/activate
pip install -r backend/requirements/prod.txt
python backend/manage.py migrate
sudo systemctl restart gyangrit
# Problems:
# ❌ No lint step — broken code gets deployed
# ❌ Hard restart (kills in-flight requests)
# ❌ No health check — can't tell if deploy broke the API
# ❌ appleboy/ssh-action@master — unstable floating tag
```

### 15.2 New Workflow (Already Updated) — `.github/workflows/deploy.yml`
The workflow now has **5 steps** split across **2 jobs**:

```
Job 1: lint (runs on GitHub, free)
  └── Python 3.12 setup
  └── pip install dev requirements
  └── python manage.py check --fail-level WARNING
      (catches missing migrations, config errors BEFORE deploy)

Job 2: deploy (only if lint passes)
  └── Step 1: git fetch + reset --hard (clean pull)
  └── Step 2: pip install (with upgrade)
  └── Step 3: migrate + collectstatic
  └── Step 4: systemctl RELOAD (graceful, no request drops)
  └── Step 5: curl health check → FAIL + auto-rollback if 200 not returned
```

### 15.3 Key Improvements
| Old | New |
|---|---|
| `@master` floating tag | `@v1.2.0` pinned tag |
| `systemctl restart` (hard kill) | `systemctl reload` (graceful — workers finish in-flight requests) |
| No health check | `curl` hits `/api/v1/auth/csrf/` — exits 1 if not 200 |
| No lint | `manage.py check` catches broken code before SSH |
| Silent failures | `set -euo pipefail` — any error stops deploy immediately |
| No concurrency control | `concurrency: production-deploy` — no parallel deploys |
| Manual trigger only | `workflow_dispatch` added for manual re-deploy from GitHub UI |

### 15.4 GitHub Secrets Required
Set these in: **GitHub → Settings → Secrets and variables → Actions**

| Secret Name | Value |
|---|---|
| `ORACLE_HOST` | `161.118.168.247` |
| `ORACLE_USERNAME` | `ubuntu` |
| `ORACLE_KEY` | Contents of your SSH private key (`~/.ssh/id_rsa`) |

### 15.5 Future CI/CD Additions (P2)
```yaml
# Add after lint job:
test:
  name: Run Tests
  runs-on: ubuntu-latest
  needs: lint
  steps:
    - uses: actions/checkout@v4
    - name: Run pytest
      run: |
        pip install -r backend/requirements/dev.txt
        cd backend && pytest --tb=short -q

# Notify on Slack/email if deploy fails:
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: "⚠️ GyanGrit deploy FAILED on master"
```

---

## QUICK REFERENCE — FILES TO CREATE / MODIFY

### Backend — New Files
| File | Purpose |
|---|---|
| `apps/ai_assistant/providers.py` | Multi-provider AI fallback chain (Groq + Gemini) |
| `apps/livesessions/recording.py` | LiveKit Egress integration + R2 upload |
| `apps/analytics/risk.py` | Predictive risk score computation |
| `apps/analytics/suggestions.py` | AI suggestion engine |
| `apps/ai_assistant/ratelimit.py` | Redis-based rate limiting |

### Backend — Modified Files
| File | Changes |
|---|---|
| `apps/ai_assistant/views.py` | Replace `_call_gemini()` with `call_ai()` from providers |
| `apps/livesessions/models.py` | Add recording fields |
| `apps/livesessions/views.py` | Add recording webhook + list endpoints |
| `apps/analytics/models.py` | Add `StudentRiskScore`, expand `EventType` |
| `apps/assessments/models.py` | Add `status`, `ai_generated`, `source_lesson` |
| `apps/flashcards/models.py` | Add `status`, `ai_generated`, `source_lesson` |
| `apps/assessments/views.py` | Add AI generation endpoint |
| `apps/flashcards/views.py` | Add AI generation endpoint |
| `backend/gunicorn.conf.py` | Increase workers, reduce timeout |
| `backend/gyangrit/settings/prod.py` | Enable conn_max_age=60, add Groq key |

### Frontend — New Files
| File | Purpose |
|---|---|
| `src/pages/RecordedSessionsPage.tsx` | Browse all recordings |
| `src/pages/RecordingPlayerPage.tsx` | Watch a single recording |
| `src/pages/AIToolsPage.tsx` | Teacher AI flashcard + assessment generator |
| `src/utils/telemetry.ts` | Click/page tracking middleware |
| `src/services/recordings.ts` | API calls for recordings |
| `src/services/aiTools.ts` | API calls for AI generation |

### Frontend — Modified Files
| File | Changes |
|---|---|
| `public/sw.js` | Add assessment queue sync, progress sync |
| `src/services/offline.ts` | Add assessment + progress queue stores |
| `src/pages/DashboardPage.tsx` | Risk score card, suggestions, heatmap |
| `src/pages/TeacherDashboardPage.tsx` | Risk overview, at-risk students list |
| `src/pages/PrincipalDashboardPage.tsx` | School-wide risk, trend charts |
| `src/pages/LiveSessionPage.tsx` | "Recording processing…" banner |
| `src/app/router.tsx` | Add `/recordings`, `/recordings/:id`, `/admin/ai-tools` |

---

*End of FUTURE_TASKS.md — Next revision after Sprint 1 completion.*
