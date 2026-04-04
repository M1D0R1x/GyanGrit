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

      case "assessment_submit":
        await apiPost(
          `/assessments/${item.payload.assessmentId}/submit/`,
          { answers: item.payload.answers },
        );
        break;

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

// ── Auto-sync on reconnect ───────────────────────────────────────────────────

let cleanupNetworkListener: (() => void) | null = null;

export function startOfflineSync(): void {
  if (cleanupNetworkListener) return; // already started

  // Process immediately if online
  if (isOnline()) {
    processOfflineQueue();
  }

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
}
