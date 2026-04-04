// services/offlineSync.ts
/**
 * Offline sync engine — processes queued offline actions when connectivity returns.
 *
 * Responsibilities:
 *   1. Listen for online events → process pending queue
 *   2. Process each item in FIFO order
 *   3. Retry failed items (up to 3 attempts)
 *   4. Dispatch events for UI feedback ("X items synced")
 *   5. Clean up synced items periodically
 *
 * Queue item types:
 *   - lesson_complete   → PATCH /lessons/{id}/progress/  { completed: true }
 *   - flashcard_review  → POST /flashcards/review/       { card_id, quality }
 *   - assessment_submit → POST /assessments/{id}/submit/ { answers: [...] }
 *   - lesson_progress   → PATCH /lessons/{id}/progress/  { last_position }
 */

import { apiPatch, apiPost } from "./api";
import {
  getPendingQueue,
  markQueueItemSynced,
  incrementRetry,
  clearSyncedQueue,
  onNetworkChange,
  isOnline,
  type OfflineQueueItem,
  getStorageEstimate,
  getAllOfflineLessons,
  removeOfflineLesson,
  getAllOfflineDecks,
  removeOfflineFlashcardDeck,
} from "./offline";

const MAX_RETRIES = 3;

// ── Sync processor ───────────────────────────────────────────────────────────

async function processQueueItem(item: OfflineQueueItem): Promise<boolean> {
  try {
    switch (item.type) {
      case "lesson_complete":
        await apiPatch(
          `/lessons/${item.payload.lessonId}/progress/`,
          { completed: true },
        );
        break;

      case "lesson_progress":
        await apiPatch(
          `/lessons/${item.payload.lessonId}/progress/`,
          { last_position: item.payload.lastPosition },
        );
        break;

      case "flashcard_review":
        await apiPost(`/flashcards/study/${item.payload.deckId}/review/`, {
          card_id: item.payload.cardId,
          quality: item.payload.quality,
        });
        break;

      case "assessment_submit": {
        // Offline assessment was submitted without a backend attempt_id.
        // Start a fresh attempt, then submit with the queued answers.
        let attemptId = item.payload.attemptId as number | undefined;
        if (!attemptId) {
          const startResp = await apiPost<{ attempt_id: number }>(
            `/assessments/${item.payload.assessmentId}/start/`,
            {},
          );
          attemptId = startResp.attempt_id;
        }
        await apiPost(
          `/assessments/${item.payload.assessmentId}/submit/`,
          {
            attempt_id:       attemptId,
            selected_options: item.payload.selectedOptions as Record<number, number>,
          },
        );
        break;
      }

      default:
        console.warn(`[OfflineSync] Unknown queue item type: ${item.type}`);
        return false;
    }

    return true;
  } catch (err) {
    console.warn(`[OfflineSync] Failed to sync item ${item.queueId}:`, err);
    return false;
  }
}

// ── Main sync loop ───────────────────────────────────────────────────────────

let syncing = false;

export async function processOfflineQueue(): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  if (syncing) return { synced: 0, failed: 0, remaining: 0 };
  if (!isOnline()) return { synced: 0, failed: 0, remaining: 0 };

  syncing = true;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const pending = await getPendingQueue();
    if (pending.length === 0) {
      syncing = false;
      return { synced: 0, failed: 0, remaining: 0 };
    }

    console.log(`[OfflineSync] Processing ${pending.length} queued items...`);

    for (const item of pending) {
      if (!isOnline()) break; // stop if we lose connection again

      if (item.retryCount >= MAX_RETRIES) {
        // Mark as synced (give up) to avoid infinite retry
        if (item.queueId != null) {
          await markQueueItemSynced(item.queueId);
        }
        failedCount++;
        continue;
      }

      const success = await processQueueItem(item);
      if (success && item.queueId != null) {
        await markQueueItemSynced(item.queueId);
        syncedCount++;
      } else if (item.queueId != null) {
        await incrementRetry(item.queueId);
        failedCount++;
      }
    }

    // Clean up synced items
    await clearSyncedQueue();

    // Dispatch sync complete event for UI
    const remaining = (await getPendingQueue()).length;
    window.dispatchEvent(
      new CustomEvent("offline:sync-complete", {
        detail: { synced: syncedCount, failed: failedCount, remaining },
      }),
    );

    console.log(
      `[OfflineSync] Done: ${syncedCount} synced, ${failedCount} failed, ${remaining} remaining`,
    );

    return { synced: syncedCount, failed: failedCount, remaining };
  } catch (err) {
    console.error("[OfflineSync] Queue processing error:", err);
    return { synced: syncedCount, failed: failedCount, remaining: -1 };
  } finally {
    syncing = false;
  }
}

// ── Storage auto-cleanup ─────────────────────────────────────────────────────

const CLEANUP_THRESHOLD = 80;  // trigger cleanup above 80%
const CLEANUP_TARGET    = 75;  // stop cleanup when usage drops below 75%

/**
 * Checks storage quota and removes oldest offline content when >80% full.
 * Removes oldest lessons first, then oldest decks, until usage < 75%.
 * Dispatches "offline:storage-cleaned" event so UI can show a toast.
 */
export async function checkStorageAndCleanup(): Promise<void> {
  try {
    const { percentUsed } = await getStorageEstimate();
    if (percentUsed < CLEANUP_THRESHOLD) return;

    console.warn(`[OfflineSync] Storage ${percentUsed}% full — running auto-cleanup...`);
    let removed = 0;

    // Phase 1: Remove oldest lessons
    const lessons = await getAllOfflineLessons();
    const sortedLessons = [...lessons].sort(
      (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
    );
    for (const lesson of sortedLessons) {
      const { percentUsed: pct } = await getStorageEstimate();
      if (pct < CLEANUP_TARGET) break;
      await removeOfflineLesson(lesson.id);
      removed++;
      console.log(`[OfflineSync] Removed lesson "${lesson.title}" (${lesson.id})`);
    }

    // Phase 2: Remove oldest flashcard decks if still over target
    const decks = await getAllOfflineDecks();
    const sortedDecks = [...decks].sort(
      (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
    );
    for (const deck of sortedDecks) {
      const { percentUsed: pct } = await getStorageEstimate();
      if (pct < CLEANUP_TARGET) break;
      await removeOfflineFlashcardDeck(deck.deckId);
      removed++;
      console.log(`[OfflineSync] Removed deck "${deck.title}" (${deck.deckId})`);
    }

    if (removed > 0) {
      window.dispatchEvent(
        new CustomEvent("offline:storage-cleaned", { detail: { removed } })
      );
      console.log(`[OfflineSync] Auto-cleanup complete: ${removed} items removed`);
    }
  } catch (err) {
    console.warn("[OfflineSync] Storage cleanup error:", err);
  }
}


// ── Auto-sync on reconnect ───────────────────────────────────────────────────

let cleanupNetworkListener: (() => void) | null = null;
let storageCheckInterval:   ReturnType<typeof setInterval> | null = null;

export function startOfflineSync(): void {
  if (cleanupNetworkListener) return; // already started

  // Process immediately if online
  if (isOnline()) {
    processOfflineQueue();
  }

  // Check storage quota on startup and clean up if >80%
  checkStorageAndCleanup();

  // Periodic storage check every 30 minutes
  storageCheckInterval = setInterval(() => {
    checkStorageAndCleanup();
  }, 30 * 60 * 1000);

  // Listen for reconnection
  cleanupNetworkListener = onNetworkChange((online) => {
    if (online) {
      // Small delay to ensure connection is stable
      setTimeout(() => {
        if (isOnline()) processOfflineQueue();
      }, 2000);
    }
  });

  // Also process on page visibility change (tab becomes active)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && isOnline()) {
      processOfflineQueue();
    }
  });

  // Listen for SW background sync messages
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SYNC_OFFLINE_QUEUE") {
        processOfflineQueue();
      }
    });

    // Register for background sync if supported
    navigator.serviceWorker.ready.then((registration) => {
      if ("sync" in registration) {
        (registration as unknown as { sync: { register: (tag: string) => Promise<void> } })
          .sync.register("sync-offline-queue").catch(() => {
            // Background Sync API not supported — that's fine, we use onNetworkChange
          });
      }
    });
  }

  console.log("[OfflineSync] Background sync started");
}

export function stopOfflineSync(): void {
  cleanupNetworkListener?.();
  cleanupNetworkListener = null;
  if (storageCheckInterval != null) {
    clearInterval(storageCheckInterval);
    storageCheckInterval = null;
  }
}
