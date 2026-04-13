# GyanGrit — Open Issues

> Last updated: 2026-04-13

No open issues.

---

## Resolved Issues

### 2026-04-13 — Performance P0 fixes

- **CORS_PREFLIGHT_MAX_AGE=86400** → browser caches OPTIONS 24h, kills sequential chains
- **Ably lazy-loaded** → moved from AuthContext to AppLayout hook w/ dynamic import. No boot-time /realtime/token/ call
- **Vercel Analytics+SpeedInsights removed** → 3-4 reqs/lesson eliminated
- **Telemetry batched** → trackEvent fires flush every 5s w/ dedup, 4x→1x analytics/event
- **Dead offlineBanner code removed** from AppLayout
- **AIToolsPage rewritten** → cascading Subject→Course→Lesson dropdowns, no manual IDs
- **ChatRoomPage sidebar upgraded** → glassmorphic, room icons, hover states, active glow
- **AdminChatManagementPage sidebar upgraded** → same treatment
- **generate_lesson_content management command** → AI-fills empty lessons via Groq/Together/Gemini

### 2026-04-13 — Sentry fixes (5 issues)

- **SENTRY-1H** NameError cache → added `from django.core.cache import cache` to accounts/views.py
- **SENTRY-9** N+1 login signal → enroll_admin_in_room bulk_create
- **SENTRY-1E** N+1 batch_course_progress → bulk Course.objects.filter(id__in=)
- **SENTRY-1G** N+1 teacher_course_analytics → single annotated queryset
- **SENTRY-1F** LiveKit Egress 404 → not a code bug, Egress not on plan

### 2026-04-09 — Offline download + OfflineStatusBar + ESLint

(See previous entries in git history)
