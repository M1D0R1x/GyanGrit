# GyanGrit — Open Issues

> Last updated: 2026-04-09

No open issues.

---

## Resolved Issues

### 2026-04-09 — Offline Download: Case 1/2 vs Case 3 Mismatch (3 bugs)

**Root Cause:** `LessonsPage.tsx` individual and bulk download buttons saved lessons with hardcoded empty strings for `content`, `pdfUrl`, `videoUrl`. They used `LessonItem` data from the list endpoint which has no content — needed `getLessonDetail()` to fetch full data first.

**Bugs fixed:**

1. **Bug 1 — Lesson text blank after Case 1/2 download** — `handleSave` and `bulkDownloadAll` now call `getLessonDetail(lesson.id)` before saving. Content set from `detail.content`.

2. **Bug 2 — PDF/video blobs never downloaded in Case 1/2** — Now calls `savePdfOffline()` and `saveVideoOffline()` after saving metadata.

3. **Bug 3 — `hasTextContent` flag missing in Case 1/2** — Now included in `saveLessonOffline()` call.

**Files changed:** `frontend/src/pages/LessonsPage.tsx`

### 2026-04-09 — OfflineStatusBar blocking TopBar navigation

**Fix:** Converted from `position: fixed; top: 0; z-index: 10000` bar to Sonner toasts at `position: "top-center"`. Component now returns `null` — headless hook that fires toasts.

**File:** `frontend/src/components/OfflineStatusBar.tsx`

### 2026-04-09 — ESLint set-state-in-effect errors (3 occurrences)

- `LessonsPage.tsx` `LessonDownloadBtn` — split `useEffect` into init-from-prop + async IndexedDB check
- `LessonsPage.tsx` `LessonsPage` — wrapped early-return `setError`/`setLoading` in `queueMicrotask()`
- `hooks/useOffline.ts` `useStorageUsage` — wrapped `refresh()` in `requestAnimationFrame()`

### 2026-04-09 — Offline empty state shows wrong message

**Fix:** Added `hasTextContent` to `OfflineLesson` type. `LessonPage.tsx` offline fallback now distinguishes "no text content" (video/PDF-only lesson) from "text not downloaded" (incomplete save).

**Files:** `offline.ts`, `useOffline.ts`, `LessonPage.tsx`
