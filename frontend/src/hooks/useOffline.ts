// hooks/useOffline.ts
/**
 * React hooks for offline state and download management.
 *
 * useOnlineStatus()     — track online/offline with UI
 * useOfflineDownload()  — download lesson content (text + PDF + video) with progress
 * usePendingSync()      — track pending offline queue items
 */

import { useState, useEffect, useCallback } from "react";
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
    } catch (err) {
      setState((s) => ({
        ...s,
        downloading: false,
        downloadType: null,
        error: err instanceof Error ? err.message : "Failed to save lesson",
      }));
    }
  }, [lesson]);

  // Save PDF blob to IndexedDB
  const savePdf = useCallback(async () => {
    if (!lesson?.pdf_url) return;
    setState((s) => ({ ...s, downloading: true, downloadType: "pdf", error: null }));
    try {
      await savePdfOffline(lesson.id, lesson.pdf_url);
      setState((s) => ({ ...s, pdfSaved: true, downloading: false, downloadType: null }));
    } catch (err) {
      setState((s) => ({
        ...s,
        downloading: false,
        downloadType: null,
        error: err instanceof Error ? err.message : "Failed to save PDF",
      }));
    }
  }, [lesson]);

  // Save video blob to IndexedDB with progress tracking
  const saveVideo = useCallback(async () => {
    if (!lesson?.video_url) return;
    setState((s) => ({ ...s, downloading: true, downloadType: "video", progress: 0, error: null }));
    try {
      await saveVideoOffline(lesson.id, lesson.video_url, (downloaded, total) => {
        const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
        setState((s) => ({ ...s, progress: pct }));
      });
      setState((s) => ({ ...s, videoSaved: true, downloading: false, downloadType: null, progress: 100 }));
    } catch (err) {
      setState((s) => ({
        ...s,
        downloading: false,
        downloadType: null,
        progress: 0,
        error: err instanceof Error ? err.message : "Failed to save video",
      }));
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
