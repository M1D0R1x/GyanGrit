// hooks/useOffline.ts
/**
 * React hooks for offline state and download management.
 *
 * useOnlineStatus()     — track online/offline with UI
 * useOfflineDownload()  — download lesson content (text + PDF + video) with progress
 * usePendingSync()      — track pending offline queue items
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "../services/api";
import {
  isOnline,
  onNetworkChange,
  isSlowConnection,
  getConnectionType,
  isLessonSavedOffline,
  saveLessonOffline,
  removeOfflineLesson,
  savePdfOffline,
  isPdfSavedOffline,
  saveVideoOffline,
  isVideoSavedOffline,
  getPendingQueue,
  getOfflineStorageUsage,
  getStorageEstimate,
  type OfflineLesson,
  type StorageUsage,
} from "../services/offline";
import type { LessonDetail } from "../services/content";

// ── useOnlineStatus ──────────────────────────────────────────────────────────

export function useOnlineStatus() {
  const [online, setOnline] = useState(isOnline());
  const [connectionType, setConnectionType] = useState(getConnectionType());
  const [slow, setSlow] = useState(isSlowConnection());

  useEffect(() => {
    const cleanup = onNetworkChange((status) => {
      setOnline(status);
      setConnectionType(getConnectionType());
      setSlow(isSlowConnection());
    });

    // Also listen for connection type changes
    const nav = navigator as Navigator & {
      connection?: EventTarget & { effectiveType?: string };
    };
    const handleConnectionChange = () => {
      setConnectionType(getConnectionType());
      setSlow(isSlowConnection());
    };
    nav.connection?.addEventListener?.("change", handleConnectionChange);

    return () => {
      cleanup();
      nav.connection?.removeEventListener?.("change", handleConnectionChange);
    };
  }, []);

  return { online, connectionType, slow };
}

// ── useOfflineDownload ───────────────────────────────────────────────────────

export type DownloadState = {
  textSaved: boolean;
  pdfSaved: boolean;
  videoSaved: boolean;
  downloading: boolean;
  downloadType: "text" | "pdf" | "video" | null;
  progress: number; // 0-100 for video downloads
  error: string | null;
};

export function useOfflineDownload(lesson: LessonDetail | null) {
  const [state, setState] = useState<DownloadState>({
    textSaved: false,
    pdfSaved: false,
    videoSaved: false,
    downloading: false,
    downloadType: null,
    progress: 0,
    error: null,
  });

  // Check saved state on mount
  useEffect(() => {
    if (!lesson) return;
    const checkSaved = async () => {
      const [textSaved, pdfSaved, videoSaved] = await Promise.all([
        isLessonSavedOffline(lesson.id),
        lesson.pdf_url ? isPdfSavedOffline(lesson.id) : Promise.resolve(false),
        lesson.video_url ? isVideoSavedOffline(lesson.id) : Promise.resolve(false),
      ]);
      setState((s) => ({ ...s, textSaved, pdfSaved, videoSaved }));
    };
    checkSaved();
  }, [lesson?.id]);

  // Save lesson text content to IndexedDB
  const saveText = useCallback(async () => {
    if (!lesson) return;
    if (!isOnline()) { toast.error("You're offline — connect to download"); return; }
    const existing = await isLessonSavedOffline(lesson.id).catch(() => false);
    if (existing) { toast.warning("Lesson already downloaded"); setState((s) => ({ ...s, textSaved: true })); return; }
    setState((s) => ({ ...s, downloading: true, downloadType: "text", error: null }));
    try {
      const offlineData: OfflineLesson = {
        id: lesson.id,
        courseId: lesson.course?.id ?? 0,
        courseTitle: lesson.course?.title ?? "",
        subjectName: lesson.course?.subject ?? "",
        grade: lesson.course?.grade ?? 0,
        title: lesson.title,
        content: lesson.content ?? "",
        pdfUrl: lesson.pdf_url ?? "",
        videoUrl: lesson.video_url ?? "",
        order: 0,
        savedAt: new Date().toISOString(),
      };
      await saveLessonOffline(offlineData);
      setState((s) => ({ ...s, textSaved: true, downloading: false, downloadType: null }));
      toast.success("Lesson saved offline");
    } catch (err) {
      toast.error("Download failed");
      setState((s) => ({
        ...s,
        downloading: false,
        downloadType: null,
        error: err instanceof Error ? err.message : "Failed to save lesson",
      }));
    }
  }, [lesson]);

  // Save PDF blob to IndexedDB — uses Background Fetch when available
  const savePdf = useCallback(async () => {
    if (!lesson?.pdf_url) return;
    if (!isOnline()) { toast.error("You're offline — connect to download"); return; }
    const existing = await isPdfSavedOffline(lesson.id).catch(() => false);
    if (existing) { toast.warning("PDF already downloaded"); setState((s) => ({ ...s, pdfSaved: true })); return; }

    const proxyUrl = `${API_BASE_URL}/media-proxy/?url=${encodeURIComponent(lesson.pdf_url)}`;
    const bgFetchId = `gyangrit-pdf-${lesson.id}`;

    // Try Background Fetch API (Chrome — survives navigation)
    const swReg = navigator.serviceWorker?.controller
      ? await navigator.serviceWorker.ready.catch(() => null)
      : null;
    const supportsBgFetch = swReg && "backgroundFetch" in swReg;

    if (supportsBgFetch) {
      try {
        const bf = await (swReg as any).backgroundFetch.fetch(
          bgFetchId,
          [proxyUrl],
          { title: `Downloading PDF — ${lesson.title}`, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }], downloadTotal: 0 },
        );
        toast.success("Downloading in background — you can navigate away");
        setState((s) => ({ ...s, downloading: true, downloadType: "pdf", progress: 0 }));
        // Poll progress
        const poll = setInterval(async () => {
          const pct = bf.downloadTotal > 0 ? Math.round((bf.downloaded / bf.downloadTotal) * 100) : 0;
          setState((s) => ({ ...s, progress: pct }));
          if (bf.result !== "") clearInterval(poll);
        }, 800);
        return;
      } catch { /* fall through to regular fetch */ }
    }

    // Fallback: streaming proxy fetch
    setState((s) => ({ ...s, downloading: true, downloadType: "pdf", error: null }));
    try {
      await savePdfOffline(lesson.id, lesson.pdf_url);
      setState((s) => ({ ...s, pdfSaved: true, downloading: false, downloadType: null }));
      toast.success("PDF saved offline");
    } catch (err) {
      toast.error("Download failed");
      setState((s) => ({ ...s, downloading: false, downloadType: null, error: err instanceof Error ? err.message : "Failed" }));
    }
  }, [lesson]);

  // Save video — uses Background Fetch API (survives navigation) with streaming proxy fallback
  const saveVideo = useCallback(async () => {
    if (!lesson?.video_url) return;
    if (!isOnline()) { toast.error("You're offline — connect to download"); return; }
    const existing = await isVideoSavedOffline(lesson.id).catch(() => false);
    if (existing) { toast.warning("Video already downloaded"); setState((s) => ({ ...s, videoSaved: true })); return; }

    const proxyUrl = `${API_BASE_URL}/media-proxy/?url=${encodeURIComponent(lesson.video_url)}`;
    const bgFetchId = `gyangrit-video-${lesson.id}`;

    // Try Background Fetch API
    const swReg = navigator.serviceWorker?.controller
      ? await navigator.serviceWorker.ready.catch(() => null)
      : null;
    const supportsBgFetch = swReg && "backgroundFetch" in swReg;

    if (supportsBgFetch) {
      try {
        // Cancel any existing fetch for this lesson
        const existing = await (swReg as any).backgroundFetch.get(bgFetchId);
        if (existing) await existing.abort();

        const bf = await (swReg as any).backgroundFetch.fetch(
          bgFetchId,
          [proxyUrl],
          { title: `Downloading video — ${lesson.title}`, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }], downloadTotal: 0 },
        );

        toast.success("Downloading in background — you can navigate away");
        setState((s) => ({ ...s, downloading: true, downloadType: "video", progress: 0 }));

        // Poll progress every second
        const poll = setInterval(() => {
          const pct = bf.downloadTotal > 0 ? Math.round((bf.downloaded / bf.downloadTotal) * 100) : 0;
          setState((s) => ({ ...s, progress: pct }));
          if (bf.result !== "") {
            clearInterval(poll);
            if (bf.result === "success") {
              setState((s) => ({ ...s, videoSaved: true, downloading: false, downloadType: null, progress: 100 }));
            } else {
              setState((s) => ({ ...s, downloading: false, downloadType: null }));
              toast.error("Background download failed — try again");
            }
          }
        }, 1000);

        // Listen for SW message
        const handler = (e: MessageEvent) => {
          if (e.data?.type === "BG_FETCH_SUCCESS" && e.data.lessonId === lesson.id && e.data.mediaType === "video") {
            clearInterval(poll);
            setState((s) => ({ ...s, videoSaved: true, downloading: false, downloadType: null, progress: 100 }));
            navigator.serviceWorker.removeEventListener("message", handler);
          }
          if ((e.data?.type === "BG_FETCH_FAIL" || e.data?.type === "BG_FETCH_ABORT") && e.data.fetchId === bgFetchId) {
            clearInterval(poll);
            setState((s) => ({ ...s, downloading: false, downloadType: null }));
            toast.error("Download failed — try again");
            navigator.serviceWorker.removeEventListener("message", handler);
          }
        };
        navigator.serviceWorker.addEventListener("message", handler);
        return;
      } catch { /* fall through to regular fetch */ }
    }

    // Fallback: streaming proxy with in-page progress
    setState((s) => ({ ...s, downloading: true, downloadType: "video", progress: 0, error: null }));
    try {
      await saveVideoOffline(lesson.id, lesson.video_url, (downloaded, total) => {
        const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
        setState((s) => ({ ...s, progress: pct }));
      });
      setState((s) => ({ ...s, videoSaved: true, downloading: false, downloadType: null, progress: 100 }));
      toast.success("Video saved offline");
    } catch (err) {
      toast.error("Download failed");
      setState((s) => ({ ...s, downloading: false, downloadType: null, progress: 0, error: err instanceof Error ? err.message : "Failed" }));
    }
  }, [lesson]);

  // Save all available content at once
  const saveAll = useCallback(async () => {
    if (!lesson) return;
    // Text first (always), then PDF, then video
    if (!state.textSaved) await saveText();
    if (lesson.pdf_url && !state.pdfSaved) await savePdf();
    if (lesson.video_url && !state.videoSaved) await saveVideo();
  }, [lesson, state.textSaved, state.pdfSaved, state.videoSaved, saveText, savePdf, saveVideo]);

  // Remove all offline data for this lesson
  const removeAll = useCallback(async () => {
    if (!lesson) return;
    await removeOfflineLesson(lesson.id); // also removes PDF + video
    setState((s) => ({
      ...s,
      textSaved: false,
      pdfSaved: false,
      videoSaved: false,
      progress: 0,
    }));
  }, [lesson]);

  const anySaved = state.textSaved || state.pdfSaved || state.videoSaved;

  return {
    ...state,
    anySaved,
    saveText,
    savePdf,
    saveVideo,
    saveAll,
    removeAll,
  };
}

// ── usePendingSync ───────────────────────────────────────────────────────────

export function usePendingSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<{
    synced: number;
    failed: number;
  } | null>(null);

  useEffect(() => {
    // Check pending count
    const checkPending = async () => {
      const pending = await getPendingQueue();
      setPendingCount(pending.length);
    };
    checkPending();

    // Listen for sync complete events
    const handleSyncComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setLastSyncResult({ synced: detail.synced, failed: detail.failed });
      setPendingCount(detail.remaining);
      // Clear the result after 5 seconds
      setTimeout(() => setLastSyncResult(null), 5000);
    };
    window.addEventListener("offline:sync-complete", handleSyncComplete);

    // Re-check when going online
    const cleanupNet = onNetworkChange(() => checkPending());

    return () => {
      window.removeEventListener("offline:sync-complete", handleSyncComplete);
      cleanupNet();
    };
  }, []);

  return { pendingCount, lastSyncResult };
}

// ── useStorageUsage ──────────────────────────────────────────────────────────

export function useStorageUsage() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [quota, setQuota] = useState<{ usedMB: number; quotaMB: number; percentUsed: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [u, q] = await Promise.all([
      getOfflineStorageUsage(),
      getStorageEstimate(),
    ]);
    setUsage(u);
    setQuota(q);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { usage, quota, loading, refresh };
}

// ── useStorageCleaned ────────────────────────────────────────────────────────
// Listens for auto-cleanup events (fired when storage >80%) and provides
// the count of removed items for toast notifications.

export function useStorageCleaned(onCleaned?: (removed: number) => void): void {
  useEffect(() => {
    if (!onCleaned) return;
    const handler = (e: Event) => {
      const { removed } = (e as CustomEvent).detail as { removed: number };
      onCleaned(removed);
    };
    window.addEventListener("offline:storage-cleaned", handler);
    return () => window.removeEventListener("offline:storage-cleaned", handler);
  }, [onCleaned]);
}
