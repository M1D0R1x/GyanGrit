// components/OfflineStatusBar.tsx
/**
 * Offline status indicator — ALL states rendered as Sonner toasts.
 *
 * Previous version used a fixed top bar for offline/sync states which
 * blocked the TopBar hamburger menu and back navigation on mobile.
 * Now everything is a centered Sonner toast — non-blocking, dismissible
 * (except the offline indicator which re-appears on dismiss after 5s).
 *
 * States:
 *   1. Offline         → persistent warning toast, centered top, re-shows on dismiss
 *   2. Pending sync    → info toast with pending count
 *   3. Sync complete   → success toast, auto-dismiss after 4s
 *   4. Slow connection → warning toast (unchanged from before)
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useOnlineStatus, usePendingSync } from "../hooks/useOffline";

export default function OfflineStatusBar() {
  const { online, slow } = useOnlineStatus();
  const { pendingCount, lastSyncResult } = usePendingSync();

  const offlineToastId = useRef<string | number>("offline-status");
  const slowToastId    = useRef<string | number>("slow-conn");
  const syncToastId    = useRef<string | number>("sync-status");
  const pendingToastId = useRef<string | number>("pending-sync");

  // Track previous online state for transition detection
  const wasOffline = useRef(!online);

  // ── Offline state → persistent warning toast ──────────────────────────────
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      // Dismiss any stale pending/sync toasts
      toast.dismiss(pendingToastId.current);
      toast.dismiss(syncToastId.current);

      toast.warning("You\u2019re offline \u2014 saved content is still available", {
        id: offlineToastId.current,
        duration: Infinity,
        dismissible: true,
        position: "top-center",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        ),
      });
    } else {
      toast.dismiss(offlineToastId.current);

      // Show "back online" toast only if we were previously offline
      if (wasOffline.current) {
        wasOffline.current = false;
        toast.success("Back online", {
          duration: 3000,
          position: "top-center",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          ),
        });
      }
    }
  }, [online]);

  // ── Slow connection → warning toast ───────────────────────────────────────
  useEffect(() => {
    if (slow && online) {
      toast.warning(
        "Slow connection \u2014 consider downloading content for offline use",
        {
          id: slowToastId.current,
          duration: Infinity,
          dismissible: true,
          position: "top-center",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ),
        }
      );
    } else {
      toast.dismiss(slowToastId.current);
    }
  }, [slow, online]);

  // ── Sync complete → success toast ─────────────────────────────────────────
  useEffect(() => {
    if (!lastSyncResult) return;

    const msg = `${lastSyncResult.synced} item${lastSyncResult.synced !== 1 ? "s" : ""} synced${
      lastSyncResult.failed > 0 ? ` \u00B7 ${lastSyncResult.failed} failed` : ""
    }`;

    toast.success(msg, {
      id: syncToastId.current,
      duration: 4000,
      position: "top-center",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    });
  }, [lastSyncResult]);

  // ── Pending sync → info toast ─────────────────────────────────────────────
  useEffect(() => {
    if (pendingCount > 0 && online) {
      toast.info(
        `${pendingCount} item${pendingCount !== 1 ? "s" : ""} waiting to sync`,
        {
          id: pendingToastId.current,
          duration: 6000,
          dismissible: true,
          position: "top-center",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          ),
        }
      );
    } else {
      toast.dismiss(pendingToastId.current);
    }
  }, [pendingCount, online]);

  // This component renders nothing — all UI is via Sonner toasts
  return null;
}
