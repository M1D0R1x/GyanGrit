// components/OfflineStatusBar.tsx
/**
 * Offline status bar — handles offline/pending-sync states as a sticky top bar.
 * Slow connection state is delegated to a Sonner toast (centered in tab, dismissible).
 *
 * States rendered as bar:
 *   1. Offline         → glass with red accent border + icon (non-dismissible)
 *   2. Pending sync    → glass with amber accent + pending count
 *   3. Sync complete   → glass with green accent → auto-dismiss
 *
 * Slow connection → Sonner toast only (no top bar)
 */

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { useOnlineStatus, usePendingSync } from "../hooks/useOffline";

export default function OfflineStatusBar() {
  const { online, slow } = useOnlineStatus();
  const { pendingCount, lastSyncResult } = usePendingSync();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const slowToastId = useRef<string | number>("slow-conn");

  // Slow connection → Sonner toast (not a bar)
  useEffect(() => {
    if (slow && online) {
      toast.warning(
        "Slow connection — consider downloading content for offline use",
        {
          id: slowToastId.current,
          duration: Infinity,
          dismissible: true,
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

  // Bar visibility for offline / sync states
  useEffect(() => {
    if (!online || pendingCount > 0 || lastSyncResult) {
      setVisible(true);
      setDismissed(false);
    } else {
      const timer = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(timer);
    }
  }, [online, pendingCount, lastSyncResult]);

  // Slow-only state → no bar needed
  if (slow && online && !(!online || pendingCount > 0 || lastSyncResult)) return null;
  if (!visible || dismissed) return null;

  // Determine bar content based on priority (offline > sync > pending)
  let accentColor: string;
  let iconSvg: React.ReactNode;
  let message: string;
  let dismissible = true;

  if (!online) {
    accentColor = "var(--error, #ef4444)";
    dismissible = false;
    iconSvg = (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    );
    message = "You're offline — saved content is still available";
  } else if (lastSyncResult) {
    accentColor = "var(--success, #10b981)";
    iconSvg = (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
    message = `${lastSyncResult.synced} item${lastSyncResult.synced !== 1 ? "s" : ""} synced successfully${
      lastSyncResult.failed > 0 ? ` · ${lastSyncResult.failed} failed` : ""
    }`;
  } else if (pendingCount > 0) {
    accentColor = "var(--warning, #f59e0b)";
    iconSvg = (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
    );
    message = `${pendingCount} item${pendingCount !== 1 ? "s" : ""} waiting to sync`;
  } else {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position:             "fixed",
        top:                  0,
        left:                 0,
        right:                0,
        zIndex:               10000,
        background:           "var(--glass-fill)",
        borderBottom:         `1px solid ${accentColor}`,
        backdropFilter:       "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow:            "0 2px 16px rgba(0,0,0,0.08)",
        padding:              "8px 16px",
        display:              "flex",
        alignItems:           "center",
        justifyContent:       "center",
        gap:                  8,
        fontSize:             "var(--text-xs)",
        fontWeight:           600,
        fontFamily:           "var(--font-body)",
        color:                "var(--ink-primary)",
        letterSpacing:        "0.01em",
        animation:            "slideDown 200ms cubic-bezier(0.23, 1, 0.32, 1) both",
      }}
    >
      {/* Accent icon */}
      <div
        style={{
          width:          24,
          height:         24,
          borderRadius:   "var(--radius-sm)",
          background:     accentColor + "18",
          color:          accentColor,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          flexShrink:     0,
        }}
      >
        {iconSvg}
      </div>

      <span style={{ color: "var(--ink-secondary)" }}>{message}</span>

      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss notification"
          style={{
            background:   "transparent",
            border:       "1px solid var(--glass-stroke)",
            borderRadius: "var(--radius-sm)",
            color:        "var(--ink-muted)",
            width:        22,
            height:       22,
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            cursor:       "pointer",
            fontSize:     12,
            marginLeft:   4,
            transition:   "background var(--transition-fast)",
            flexShrink:   0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          ✕
        </button>
      )}

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}
