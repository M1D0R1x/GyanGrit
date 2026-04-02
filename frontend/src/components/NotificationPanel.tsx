// components.NotificationPanel
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  fetchNotifications,
  markRead,
  markAllRead,
  type AppNotification,
} from "../services/notifications";
import NotificationDetailModal from "./NotificationDetailModal";

const TYPE_COLORS: Record<string, string> = {
  info:         "#3b82f6",
  success:      "#10b981",
  warning:      "#f59e0b",
  error:        "#ef4444",
  announcement: "#8b5cf6",
  assessment:   "#10b981",
  lesson:       "#3b82f6",
};

const TYPE_ICONS: Record<string, string> = {
  info:         "ℹ",
  success:      "✓",
  warning:      "⚠",
  error:        "✕",
  announcement: "📢",
  assessment:   "📝",
  lesson:       "📖",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Bell icon with badge ───────────────────────────────────────────────────

export function NotificationBell({
  unread,
  onClick,
  active,
}: {
  unread:  number;
  onClick: () => void;
  active:  boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      style={{
        position:       "relative",
        background:     active ? "var(--bg-elevated)" : "none",
        border:         "1px solid",
        borderColor:    active ? "var(--saffron)" : "transparent",
        borderRadius:   "var(--radius-md)",
        width:          36,
        height:         36,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        cursor:         "pointer",
        transition:     "all 0.15s",
        color:          active ? "var(--ink-primary)" : "var(--ink-muted)",
        flexShrink:     0,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
          (e.currentTarget as HTMLButtonElement).style.color      = "var(--ink-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = "none";
          (e.currentTarget as HTMLButtonElement).style.color      = "var(--ink-muted)";
        }
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>

      {unread > 0 && (
        <span
          aria-hidden="true"
          style={{
            position:    "absolute",
            top: -4, right: -4,
            minWidth:    18,
            height:      18,
            borderRadius: 999,
            background:  "#ef4444",
            color:       "#fff",
            fontSize:    10,
            fontWeight:  700,
            display:     "flex",
            alignItems:  "center",
            justifyContent: "center",
            padding:     "0 4px",
            lineHeight:  1,
            border:      "2px solid var(--bg-surface)",
            animation:   "fadeInUp 0.2s ease",
          }}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────

type Props = {
  onClose:        () => void;
  onUnreadChange: (count: number) => void;
  onViewAll?:     () => void;
};

export function NotificationPanel({ onClose, onUnreadChange, onViewAll }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [markingAll, setMarkingAll]       = useState(false);
  const [detailNotif, setDetailNotif]     = useState<AppNotification | null>(null);

  const load = useCallback(() => {
    fetchNotifications()
      .then((data) => {
        if (!data) return;
        setNotifications(data.notifications);
        onUnreadChange(data.unread);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [onUnreadChange]);

  useEffect(() => { load(); }, [load]);

  // Close on outside click — suppressed while detail modal is open
  useEffect(() => {
    if (detailNotif) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, detailNotif]);

  // Close on Escape — suppressed while detail modal is open
  useEffect(() => {
    if (detailNotif) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, detailNotif]);

  const handleItemClick = async (n: AppNotification) => {
    if (!n.is_read) {
      markRead(n.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
      );
      onUnreadChange(
        Math.max(0, notifications.filter((x) => !x.is_read).length - 1)
      );
    }
    setDetailNotif(n);
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    await markAllRead().catch(() => {});
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
    onUnreadChange(0);
    setMarkingAll(false);
  };

  const handleViewAllClick = () => {
    onClose();
    onViewAll?.();
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notifications"
        style={{
          position:             "absolute",
          top:                  "calc(100% + 8px)",
          right:                0,
          width:                380,
          maxWidth:             "calc(100vw - 32px)",
          maxHeight:            560,
          background:           "var(--glass-fill)",
          border:               "1px solid var(--glass-stroke)",
          borderRadius:         "var(--radius-lg)",
          boxShadow:            "var(--shadow-xl)",
          zIndex:               9999,
          display:              "flex",
          flexDirection:        "column",
          overflow:             "hidden",
          animation:            "fadeInUp 0.15s ease both",
          backdropFilter:       "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "12px 16px",
          borderBottom:   "1px solid var(--border-light)",
          background:     "transparent",
          flexShrink:     0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize:   "var(--text-sm)",
              color:      "var(--ink-primary)",
            }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={{
                background:   "#ef4444",
                color:        "#fff",
                fontSize:     10,
                fontWeight:   700,
                padding:      "1px 6px",
                borderRadius: 999,
              }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                style={{
                  background: "none",
                  border:     "none",
                  fontSize:   "var(--text-xs)",
                  color:      "var(--saffron)",
                  cursor:     "pointer",
                  fontWeight: 600,
                  padding:    "2px 4px",
                }}
              >
                {markingAll ? "Marking…" : "Mark all read"}
              </button>
            )}
          </div>
        </div>

        {/* ── Notification list ─────────────────────────────────────────── */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 72, borderRadius: "var(--radius-md)" }} />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div style={{
              padding:   "40px 16px",
              textAlign: "center",
              color:     "var(--ink-muted)",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>No notifications yet</div>
              <div style={{ fontSize: "var(--text-xs)", marginTop: 4, opacity: 0.7 }}>
                Important updates will appear here
              </div>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleItemClick(n)}
                style={{
                  display:      "flex",
                  gap:          12,
                  width:        "100%",
                  padding:      "12px 16px",
                  background:   n.is_read ? "transparent" : "var(--bg-elevated)",
                  border:       "none",
                  borderBottom: "1px solid var(--border-light)",
                  cursor:       "pointer",
                  textAlign:    "left",
                  transition:   "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    n.is_read ? "transparent" : "var(--bg-elevated)";
                }}
              >
                {/* Type icon */}
                <div style={{
                  width:          32,
                  height:         32,
                  borderRadius:   "50%",
                  background:     (TYPE_COLORS[n.type] ?? "#3b82f6") + "22",
                  color:          TYPE_COLORS[n.type] ?? "#3b82f6",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  fontSize:       14,
                  fontWeight:     700,
                  flexShrink:     0,
                }}>
                  {TYPE_ICONS[n.type] ?? "ℹ"}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize:     "var(--text-sm)",
                    fontWeight:   n.is_read ? 500 : 700,
                    color:        "var(--ink-primary)",
                    marginBottom: 1,
                    overflow:     "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace:   "nowrap",
                  }}>
                    {n.subject}
                  </div>
                  {n.message && (
                    <div style={{
                      fontSize:          "var(--text-xs)",
                      color:             "var(--ink-muted)",
                      lineHeight:        1.4,
                      overflow:          "hidden",
                      display:           "-webkit-box",
                      WebkitLineClamp:   2,
                      WebkitBoxOrient:   "vertical",
                    }}>
                      {n.message}
                    </div>
                  )}
                  {n.attachment_name && (
                    <div style={{ fontSize: 11, color: "var(--saffron)", marginTop: 2 }}>
                      📎 {n.attachment_name}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                    {n.sender && n.sender !== "System" && (
                      <>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontWeight: 500 }}>
                          {n.sender}
                        </span>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", opacity: 0.5 }}>·</span>
                      </>
                    )}
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", opacity: 0.7 }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                </div>

                {/* Unread dot */}
                {!n.is_read && (
                  <div style={{
                    width:        8,
                    height:       8,
                    borderRadius: "50%",
                    background:   "#3b82f6",
                    flexShrink:   0,
                    marginTop:    6,
                  }} />
                )}
              </button>
            ))
          )}
        </div>

        {/* ── Footer — View all (always visible, not conditional) ───────── */}
        <div style={{
          flexShrink:   0,
          borderTop:    "1px solid var(--border-light)",
          background:   "transparent",
        }}>
          <button
            onClick={handleViewAllClick}
            style={{
              width:          "100%",
              padding:        "12px 16px",
              background:     "none",
              border:         "none",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              gap:            6,
              fontSize:       "var(--text-sm)",
              fontWeight:     600,
              color:          "var(--saffron)",
              cursor:         "pointer",
              transition:     "background 0.1s",
              fontFamily:     "inherit",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "none";
            }}
          >
            View all notifications
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Detail modal rendered into document.body to escape TopBar stacking context */}
      {detailNotif && createPortal(
        <NotificationDetailModal
          notification={detailNotif}
          onClose={() => setDetailNotif(null)}
        />,
        document.body
      )}
    </>
  );
}
