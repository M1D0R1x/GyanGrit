// pages.NotificationsPage
/**
 * Tab layout:
 *
 * All roles see:
 *   📥 My Notifications  — personal inbox history, searchable, paginated
 *
 * Staff roles (TEACHER, PRINCIPAL, OFFICIAL, ADMIN) additionally see:
 *   📤 Send Message      — compose + send broadcast with file attachment
 *   📋 Sent History      — all broadcasts sent by this user, searchable
 */
import { createPortal }          from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth }               from "../auth/AuthContext";
import NotificationDetailModal   from "../components/NotificationDetailModal";
import {
  getAudienceOptions,
  getNotificationHistory,
  getSentHistory,
  getBroadcastDetail,
  sendNotification,
  markRead,
  markAllRead,
  type AudienceOptions,
  type AudienceType,
  type AppNotification,
  type Broadcast,
  type BroadcastDetail,
  type NotificationType,
  type NotificationFilterParams,
  type SendPayload,
  AUDIENCE_LABELS,
  NOTIFICATION_TYPE_LABELS,
} from "../services/notifications";
import {
  uploadNotificationFile,
  NOTIFICATION_ALLOWED_EXTENSIONS,
} from "../services/media";
import { usePageTitle } from "../hooks/usePageTitle";

// ── Constants & helpers ────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  info:         "var(--saffron)",
  success:      "var(--success)",
  warning:      "var(--warning)",
  error:        "var(--error)",
  announcement: "var(--role-principal)",
  assessment:   "var(--role-teacher)",
  lesson:       "var(--role-student)",
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

function relativeDate(iso: string) {
  const d    = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const needsClass = (a: AudienceType) =>
  (["class_all", "class_students", "class_teachers"] as AudienceType[]).includes(a);

const needsInstitution = (a: AudienceType, role: string) =>
  (["school_all", "school_students", "school_teachers"] as AudienceType[]).includes(a) &&
  (role === "OFFICIAL" || role === "ADMIN");

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf")                                  return "📄";
  if (["doc", "docx"].includes(ext))                  return "📝";
  if (["xls", "xlsx"].includes(ext))                  return "📊";
  if (["jpg", "jpeg", "png", "webp"].includes(ext))   return "🖼️";
  return "📎";
}

/** Returns a URL that opens the file for viewing (not downloading).
 *  PDFs use Google Docs viewer; images open directly; others download. */
function getViewUrl(url: string, name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  }
  // Images and other browser-renderable types open directly
  return url;
}

// ── Glassmorphic Date Picker ───────────────────────────────────────────────

function GlassDatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  label,
}: {
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  label?:       string;
}) {
  const [open, setOpen]       = useState(false);
  const [viewYear, setVY]     = useState(() => value ? new Date(value).getFullYear() : new Date().getFullYear());
  const [viewMonth, setVM]    = useState(() => value ? new Date(value).getMonth() : new Date().getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  const firstDay  = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const selectedDate = value ? new Date(value + "T00:00:00") : null;
  const isSelected = (d: number) => selectedDate?.getFullYear() === viewYear && selectedDate?.getMonth() === viewMonth && selectedDate?.getDate() === d;
  const isToday    = (d: number) => { const t = new Date(); return t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === d; };

  const pickDay = (d: number) => {
    const m = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    onChange(`${viewYear}-${m}-${dd}`);
    setOpen(false);
  };

  const prevMonth = () => { if (viewMonth === 0) { setVM(11); setVY(y => y - 1); } else setVM(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setVM(0); setVY(y => y + 1); } else setVM(m => m + 1); };

  const displayValue = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {label && <label className="form-label">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", padding: "10px var(--space-4)",
          background: "var(--bg-sunken)", border: `1.5px solid ${open || value ? "var(--saffron)" : "var(--border-medium)"}`,
          borderRadius: "var(--radius-md)", color: value ? "var(--ink-primary)" : "var(--ink-muted)",
          fontSize: "var(--text-sm)", fontFamily: "var(--font-body)", textAlign: "left",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: open ? "0 0 0 3px rgba(245,158,11,0.15)" : "none",
          transition: "all var(--duration-press) var(--ease-out-strong)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--saffron)", flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {displayValue || placeholder}
        </span>
        {value ? (
          <span onClick={(e) => { e.stopPropagation(); onChange(""); }} style={{ color: "var(--ink-muted)", fontSize: 14, lineHeight: 1, padding: "2px 4px", borderRadius: "var(--radius-sm)" }}>✕</span>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "#FFFDF7",
          border: "1.5px solid rgba(245,158,11,0.35)", borderRadius: "var(--radius-xl)",
          boxShadow: "0 20px 60px rgba(26,18,8,0.22), 0 4px 16px rgba(26,18,8,0.1)",
          padding: "var(--space-4)", minWidth: 280,
          animation: "scaleIn 0.15s var(--ease-out-strong) both",
          transformOrigin: "top left",
        }}>
          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
            <button type="button" onClick={prevMonth} style={{ background: "rgba(245,158,11,0.12)", border: "none", borderRadius: "var(--radius-md)", width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#92400e" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-sm)", color: "#1A1208" }}>
              {MONTHS[viewMonth]} {viewYear}
            </div>
            <button type="button" onClick={nextMonth} style={{ background: "rgba(245,158,11,0.12)", border: "none", borderRadius: "var(--radius-md)", width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#92400e" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "var(--space-2)" }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9B8E7E", textTransform: "uppercase", letterSpacing: "0.05em", padding: "var(--space-1) 0" }}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const sel = isSelected(d);
              const tod = isToday(d);
              return (
                <button key={d} type="button" onClick={() => pickDay(d)} style={{
                  width: "100%", aspectRatio: "1", border: "none",
                  borderRadius: "var(--radius-md)",
                  background: sel ? "#F59E0B" : tod ? "rgba(245,158,11,0.15)" : "transparent",
                  color: sel ? "#fff" : tod ? "#92400e" : "#1A1208",
                  fontFamily: "var(--font-display)", fontWeight: sel ? 800 : tod ? 700 : 500,
                  fontSize: "var(--text-xs)", cursor: "pointer",
                  transition: "all var(--duration-press) var(--ease-out-strong)",
                  outline: "none",
                  boxShadow: sel ? "0 2px 8px rgba(245,158,11,0.4)" : "none",
                }}
                  onMouseEnter={e => { if (!sel) { e.currentTarget.style.background = "rgba(245,158,11,0.15)"; e.currentTarget.style.color = "#92400e"; } }}
                  onMouseLeave={e => { if (!sel) { e.currentTarget.style.background = tod ? "rgba(245,158,11,0.15)" : "transparent"; e.currentTarget.style.color = tod ? "#92400e" : "#1A1208"; } }}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid rgba(245,158,11,0.2)" }}>
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} style={{ background: "none", border: "none", color: "#9B8E7E", fontSize: "var(--text-xs)", cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-body)" }}>Clear</button>
            <button type="button" onClick={() => { const t = new Date(); const m = String(t.getMonth()+1).padStart(2,"0"); const d = String(t.getDate()).padStart(2,"0"); onChange(`${t.getFullYear()}-${m}-${d}`); setOpen(false); }}
              style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: "var(--radius-full)", color: "#92400e", fontSize: "var(--text-xs)", cursor: "pointer", fontWeight: 700, padding: "3px 12px", fontFamily: "var(--font-body)" }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter bar — shared by inbox + sent history ────────────────────────────

type FilterState = {
  q:           string;
  type:        string;
  sent_after:  string;
  sent_before: string;
};

function FilterBar({
  filters,
  onChange,
  showUnreadToggle,
  unreadOnly,
  onUnreadToggle,
}: {
  filters:          FilterState;
  onChange:         (f: FilterState) => void;
  showUnreadToggle?: boolean;
  unreadOnly?:      boolean;
  onUnreadToggle?:  () => void;
}) {
  const set = (key: keyof FilterState, value: string) =>
    onChange({ ...filters, [key]: value });

  const hasFilters = !!(filters.q || filters.type || filters.sent_after || filters.sent_before);

  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      {/* Row 1: Search + Type */}
      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "2 1 200px", minWidth: 160 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="form-input"
            type="text"
            placeholder="Search subject or message…"
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select
          className="form-input"
          value={filters.type}
          onChange={(e) => set("type", e.target.value)}
          style={{ flex: "1 1 140px", minWidth: 130 }}
        >
          <option value="">All types</option>
          {Object.entries(NOTIFICATION_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {showUnreadToggle && (
          <button
            onClick={onUnreadToggle}
            style={{
              padding:      "0 var(--space-4)",
              background:   unreadOnly ? "var(--saffron)" : "var(--bg-elevated)",
              border:       "1.5px solid var(--border-medium)",
              borderRadius: "var(--radius-md)",
              color:        unreadOnly ? "#fff" : "var(--ink-secondary)",
              fontSize:     "var(--text-sm)",
              fontWeight:   600,
              cursor:       "pointer",
              whiteSpace:   "nowrap",
              flexShrink:   0,
            }}
          >
            {unreadOnly ? "✓ Unread" : "All"}
          </button>
        )}
      </div>

      {/* Row 2: Date range + Clear */}
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 160px", minWidth: 140 }}>
          <GlassDatePicker
            label="From date"
            value={filters.sent_after}
            onChange={(v) => set("sent_after", v)}
            placeholder="From date"
          />
        </div>
        <div style={{ flex: "1 1 160px", minWidth: 140 }}>
          <GlassDatePicker
            label="To date"
            value={filters.sent_before}
            onChange={(v) => set("sent_before", v)}
            placeholder="To date"
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => onChange({ q: "", type: "", sent_after: "", sent_before: "" })}
            style={{
              padding: "10px var(--space-4)", background: "none",
              border: "1.5px solid var(--border-medium)", borderRadius: "var(--radius-md)",
              color: "var(--ink-muted)", fontSize: "var(--text-sm)", cursor: "pointer",
              fontFamily: "var(--font-body)", whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ── Inbox notification row ─────────────────────────────────────────────────

function InboxRow({
  n,
  onClick,
}: {
  n:       AppNotification;
  onClick: (n: AppNotification) => void;
}) {
  const color = TYPE_COLORS[n.type] ?? "var(--saffron)";
  const icon  = TYPE_ICONS[n.type]  ?? "ℹ";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(n)}
      onKeyDown={(e) => e.key === "Enter" && onClick(n)}
      style={{
        display:      "flex",
        gap:          "var(--space-4)",
        padding:      "var(--space-4) var(--space-5)",
        background:   n.is_read ? "var(--bg-elevated)" : "var(--bg-surface)",
        border:       "1px solid var(--border-light)",
        borderLeft:   `3px solid ${n.is_read ? "transparent" : color}`,
        borderRadius: "var(--radius-md)",
        cursor:       "pointer",
        transition:   "background 0.1s",
        animation:    "fadeInUp 0.15s ease both",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = n.is_read ? "var(--bg-elevated)" : "var(--bg-surface)")}
    >
      {/* Type icon */}
      <div style={{
        width:          36, height: 36, borderRadius: "50%",
        background:     color + "22",
        color,
        display:        "flex", alignItems: "center", justifyContent: "center",
        fontSize:       16, fontWeight: 700, flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
          <div style={{
            fontWeight:   n.is_read ? 500 : 700,
            fontSize:     "var(--text-sm)",
            color:        "var(--ink-primary)",
            overflow:     "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {n.subject}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
            {!n.is_read && (
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
            )}
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
              {relativeDate(n.created_at)}
            </span>
          </div>
        </div>
        {n.message && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {n.message.replace(/[#*_`[\]()>]/g, "").slice(0, 160)}
          </div>
        )}
        <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)", alignItems: "center" }}>
          {n.sender && n.sender !== "System" && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontWeight: 500 }}>
              From: {n.sender}
            </span>
          )}
          {n.attachment_name && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--saffron)" }}>
              {getFileIcon(n.attachment_name)} {n.attachment_name}
            </span>
          )}
          {(n.link || n.attachment_url) && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--saffron)", opacity: 0.8 }}>
              Read more →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sent card ─────────────────────────────────────────────────────────────

function SentCard({ b, onClick }: { b: Broadcast; onClick: (b: Broadcast) => void }) {
  const color = TYPE_COLORS[b.notification_type] ?? "var(--saffron)";
  return (
    <div
      className="card card--clickable"
      onClick={() => onClick(b)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(b)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {NOTIFICATION_TYPE_LABELS[b.notification_type] ?? b.notification_type}
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>·</span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{b.audience_label}</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--ink-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "var(--space-1)" }}>
            {b.subject}
          </div>
          {b.message && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {b.message.replace(/[#*_`[\]()>]/g, "").slice(0, 120)}
            </div>
          )}
          {b.attachment_name && (
            <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "center", marginTop: "var(--space-2)" }}>
              <span style={{ fontSize: 12 }}>{getFileIcon(b.attachment_name)}</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--saffron)" }}>{b.attachment_name}</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{relativeDate(b.sent_at)}</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--ink-secondary)", marginTop: "var(--space-1)" }}>
            {b.recipient_count} recipient{b.recipient_count !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Broadcast detail modal ─────────────────────────────────────────────────

function BroadcastDetailModal({ broadcast_id, onClose }: { broadcast_id: number; onClose: () => void }) {
  const [detail, setDetail]   = useState<BroadcastDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBroadcastDetail(broadcast_id).then(setDetail).finally(() => setLoading(false));
  }, [broadcast_id]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const modal = (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 10000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "5vh", overflowY: "auto" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-lg)", width: "min(560px, calc(100vw - 2rem))", maxHeight: "85vh", overflow: "auto", padding: "var(--space-6)", animation: "fadeInUp 0.15s ease both", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--ink-primary)", margin: 0 }}>Broadcast Detail</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", fontSize: 18 }}>✕</button>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 20, borderRadius: 4 }} />)}
          </div>
        ) : !detail ? (
          <p style={{ color: "var(--ink-muted)" }}>Could not load details.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div><div className="card__label">Subject</div><div style={{ fontWeight: 600, color: "var(--ink-primary)" }}>{detail.subject}</div></div>
            {detail.message && <div><div className="card__label">Message</div><div style={{ fontSize: "var(--text-sm)", color: "var(--ink-secondary)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{detail.message}</div></div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <div><div className="card__label">Audience</div><div style={{ fontSize: "var(--text-sm)", color: "var(--ink-primary)" }}>{detail.audience_label}</div></div>
              <div><div className="card__label">Sent</div><div style={{ fontSize: "var(--text-sm)", color: "var(--ink-primary)" }}>{new Date(detail.sent_at).toLocaleString("en-IN")}</div></div>
            </div>
            {detail.attachment_name && (
              <div>
                <div className="card__label">Attachment</div>
                <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)", alignItems: "center" }}>
                  <span style={{ fontSize: 20 }}>{getFileIcon(detail.attachment_name)}</span>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-primary)", flex: 1 }}>{detail.attachment_name}</span>
                  <a href={getViewUrl(detail.attachment_url, detail.attachment_name)} target="_blank" rel="noopener noreferrer" style={{ fontSize: "var(--text-xs)", color: "var(--saffron)", fontWeight: 600, textDecoration: "none" }}>View</a>
                  <a href={detail.attachment_url} download={detail.attachment_name} style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", textDecoration: "none" }}>Download</a>
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)", padding: "var(--space-4)", background: "var(--bg-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
              {[
                { label: "Sent to", value: detail.recipient_count, color: "var(--ink-primary)" },
                { label: "Read",    value: detail.read_count,      color: "var(--success)"      },
                { label: "Unread",  value: detail.unread_count,    color: "var(--warning)"      },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color }}>{value}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{label}</div>
                </div>
              ))}
            </div>
            {detail.recipients.length > 0 && (
              <div>
                <div className="card__label" style={{ marginBottom: "var(--space-3)" }}>Recipients (first 50)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                  {detail.recipients.map((r) => (
                    <span key={r.user_id} className="badge" style={{ background: r.is_read ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", color: r.is_read ? "var(--success)" : "var(--warning)", border: `1px solid ${r.is_read ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)"}` }}>
                      {r.username}{r.is_read ? " ✓" : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── File uploader widget ───────────────────────────────────────────────────

type AttachmentState = { url: string; name: string };

function FileUploader({ value, onChange, onError }: {
  value:    AttachmentState | null;
  onChange: (a: AttachmentState | null) => void;
  onError:  (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const startUpload = async (file: File) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProgress(0);
    onError("");
    try {
      const result = await uploadNotificationFile(file, (p) => setProgress(p), ctrl.signal);
      onChange({ url: result.url, name: result.display_name });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      onError((err as Error).message ?? "Upload failed");
    } finally {
      setProgress(null);
    }
  };

  if (value) return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", background: "var(--bg-elevated)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)" }}>
      <span style={{ fontSize: 22 }}>{getFileIcon(value.name)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.name}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--success)", marginTop: 2 }}>✓ Uploaded</div>
      </div>
      <button type="button" onClick={() => { abortRef.current?.abort(); onChange(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", fontSize: 18 }}>✕</button>
    </div>
  );

  if (progress !== null) return (
    <div style={{ padding: "var(--space-4)", background: "var(--bg-elevated)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)" }}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)", marginBottom: "var(--space-2)" }}>Uploading… {progress}%</div>
      <div style={{ height: 4, background: "var(--border-light)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "var(--saffron)", transition: "width 0.1s", borderRadius: 2 }} />
      </div>
      <button type="button" onClick={() => { abortRef.current?.abort(); setProgress(null); }} style={{ marginTop: "var(--space-2)", background: "none", border: "none", fontSize: "var(--text-xs)", color: "var(--ink-muted)", cursor: "pointer" }}>Cancel</button>
    </div>
  );

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) startUpload(f); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      style={{ padding: "var(--space-5)", background: dragging ? "rgba(59,130,246,0.06)" : "var(--bg-elevated)", border: `2px dashed ${dragging ? "var(--saffron)" : "var(--border-medium)"}`, borderRadius: "var(--radius-md)", textAlign: "center", cursor: "pointer", transition: "all 0.15s" }}
      role="button" tabIndex={0} aria-label="Attach a file"
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
    >
      <div style={{ fontSize: 24, marginBottom: "var(--space-2)" }}>📎</div>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: dragging ? "var(--saffron)" : "var(--ink-secondary)" }}>
        {dragging ? "Drop file here" : "Click or drag to attach a file"}
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>PDF, Word, Excel, or image · Max 10 MB</div>
      <input ref={inputRef} type="file" accept={NOTIFICATION_ALLOWED_EXTENSIONS} onChange={(e) => { const f = e.target.files?.[0]; if (f) startUpload(f); e.target.value = ""; }} style={{ display: "none" }} aria-hidden="true" />
    </div>
  );
}

// ── Tab types ──────────────────────────────────────────────────────────────

type Tab = "inbox" | "send" | "history";

// ── Main page ──────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { user } = useAuth();
  usePageTitle("Notifications");
  const isSender = !!user?.role && ["TEACHER", "PRINCIPAL", "OFFICIAL", "ADMIN"].includes(user.role);

  const [activeTab, setActiveTab] = useState<Tab>("inbox");

  // ── Inbox state ──────────────────────────────────────────────────────────
  const [inbox, setInbox]           = useState<AppNotification[]>([]);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [inboxPages, setInboxPages] = useState(1);
  const [inboxPage, setInboxPage]   = useState(1);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxFilters, setInboxFilters] = useState<FilterState>({ q: "", type: "", sent_after: "", sent_before: "" });
  const [inboxUnreadOnly, setInboxUnreadOnly] = useState(false);
  const [detailNotif, setDetailNotif] = useState<AppNotification | null>(null);

  // ── Send form state ──────────────────────────────────────────────────────
  const [options, setOptions]         = useState<AudienceOptions | null>(null);
  const [form, setForm]               = useState<Partial<SendPayload>>({ notification_type: "announcement" });
  const [attachment, setAttachment]   = useState<AttachmentState | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [sending, setSending]         = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError]     = useState<string | null>(null);

  // ── Sent history state ───────────────────────────────────────────────────
  const [sentList, setSentList]       = useState<Broadcast[]>([]);
  const [sentTotal, setSentTotal]     = useState(0);
  const [sentPage, setSentPage]       = useState(1);
  const [sentPages, setSentPages]     = useState(1);
  const [sentLoading, setSentLoading] = useState(false);
  const [sentFilters, setSentFilters] = useState<FilterState>({ q: "", type: "", sent_after: "", sent_before: "" });
  const [broadcastDetailId, setBroadcastDetailId] = useState<number | null>(null);

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadInbox = useCallback(() => {
    setInboxLoading(true);
    const params: NotificationFilterParams = {
      q:           inboxFilters.q    || undefined,
      type:        (inboxFilters.type as NotificationType) || undefined,
      sent_after:  inboxFilters.sent_after  || undefined,
      sent_before: inboxFilters.sent_before || undefined,
      unread_only: inboxUnreadOnly || undefined,
      page:        inboxPage,
      page_size:   20,
    };
    getNotificationHistory(params)
      .then((d) => {
        if (!d) return;
        setInbox(d.results);
        setInboxTotal(d.count);
        setInboxPages(d.total_pages);
        setInboxUnread(d.unread);
      })
      .finally(() => setInboxLoading(false));
  }, [inboxFilters, inboxUnreadOnly, inboxPage]);

  const loadSent = useCallback(() => {
    if (!isSender) return;
    setSentLoading(true);
    getSentHistory({
      q:           sentFilters.q    || undefined,
      type:        (sentFilters.type as NotificationType) || undefined,
      sent_after:  sentFilters.sent_after  || undefined,
      sent_before: sentFilters.sent_before || undefined,
      page:        sentPage,
    })
      .then((d) => {
        if (!d) return;
        setSentList(d.results);
        setSentTotal(d.count);
        setSentPages(d.total_pages);
      })
      .finally(() => setSentLoading(false));
  }, [isSender, sentFilters, sentPage]);

  useEffect(() => { loadInbox(); },                        [loadInbox]);
  useEffect(() => { if (activeTab === "history") loadSent(); }, [activeTab, loadSent]);
  useEffect(() => { if (isSender) getAudienceOptions().then(setOptions).catch(() => {}); }, [isSender]);

  // Reset page when filters change
  const updateInboxFilters = (f: FilterState) => { setInboxFilters(f); setInboxPage(1); };
  const updateSentFilters  = (f: FilterState) => { setSentFilters(f);  setSentPage(1);  };

  // ── Inbox actions ─────────────────────────────────────────────────────────

  const handleInboxItemClick = async (n: AppNotification) => {
    if (!n.is_read) {
      markRead(n.id).catch(() => {});
      setInbox((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
      setInboxUnread((c) => Math.max(0, c - 1));
    }
    setDetailNotif(n);
  };

  const handleMarkAllRead = async () => {
    await markAllRead().catch(() => {});
    setInbox((prev) => prev.map((x) => ({ ...x, is_read: true })));
    setInboxUnread(0);
  };

  // ── Send ─────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!form.subject?.trim())   { setSendError("Subject is required"); return; }
    if (!form.audience_type)     { setSendError("Please select an audience"); return; }
    if (form.audience_type && needsClass(form.audience_type) && !form.class_id) {
      setSendError("Please select a class"); return;
    }
    if (user && form.audience_type && needsInstitution(form.audience_type, user.role) && !form.institution_id) {
      setSendError("Please select a school"); return;
    }
    if (uploadError) { setSendError("Fix the attachment error first"); return; }

    setSending(true);
    setSendError(null);
    setSendSuccess(null);

    const payload: SendPayload = {
      ...(form as SendPayload),
      attachment_url:  attachment?.url  ?? "",
      attachment_name: attachment?.name ?? "",
    };

    try {
      const result = await sendNotification(payload);
      if (result) {
        setSendSuccess(`Sent to ${result.recipient_count} recipient${result.recipient_count !== 1 ? "s" : ""} — ${result.audience_label}`);
        setForm({ notification_type: "announcement" });
        setAttachment(null);
      }
    } catch {
      setSendError("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // ── Tabs config ───────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string }[] = [
    { key: "inbox",   label: "📥 My Notifications" },
    ...(isSender ? [
      { key: "send"    as Tab, label: "📤 Send Message"  },
      { key: "history" as Tab, label: "📋 Sent History"  },
    ] : []),
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Page header ── */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "var(--text-2xl)", color: "var(--ink-primary)", letterSpacing: "-0.03em", marginBottom: "var(--space-1)" }}>
          Notifications
        </h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
          {isSender ? "Manage your inbox and send messages to students." : "Stay updated with announcements from your school."}
        </p>
      </div>

      {/* ── Tab bar — 3 big centered blocks ── */}
      <div style={{ display: "flex", marginBottom: "var(--space-6)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              flex:         1,
              padding:      "var(--space-4) var(--space-3)",
              background:   activeTab === t.key ? "var(--saffron)" : "var(--bg-elevated)",
              border:       "none",
              color:        activeTab === t.key ? "#fff" : "var(--ink-secondary)",
              fontSize:     "var(--text-sm)",
              fontWeight:   activeTab === t.key ? 700 : 500,
              cursor:       "pointer",
              transition:   "all var(--duration-press) var(--ease-out-strong)",
              fontFamily:   "var(--font-body)",
              position:     "relative",
              textAlign:    "center",
            }}
          >
            {t.label}
            {t.key === "inbox" && inboxUnread > 0 && (
              <span style={{ position: "absolute", top: 6, right: 8, background: activeTab === "inbox" ? "rgba(255,255,255,0.9)" : "var(--error)", color: activeTab === "inbox" ? "var(--error)" : "#fff", fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: "var(--radius-full)", fontFamily: "var(--font-display)" }}>
                {inboxUnread > 99 ? "99+" : inboxUnread}
              </span>
            )}
          </button>
        ))}
      </div>

        {/* ── INBOX TAB ─────────────────────────────────────────────────── */}
        {activeTab === "inbox" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--ink-primary)", letterSpacing: "-0.02em", margin: 0 }}>
                  My Notifications
                </h2>
                {inboxTotal > 0 && (
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
                    {inboxTotal} total{inboxUnread > 0 && <span style={{ color: "var(--error)", fontWeight: 600 }}> · {inboxUnread} unread</span>}
                  </p>
                )}
              </div>
              {inboxUnread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="btn btn--ghost"
                  style={{ fontSize: "var(--text-xs)", color: "var(--saffron)", fontWeight: 700 }}
                >
                  ✓ Mark all read
                </button>
              )}
            </div>

            <FilterBar
              filters={inboxFilters}
              onChange={updateInboxFilters}
              showUnreadToggle
              unreadOnly={inboxUnreadOnly}
              onUnreadToggle={() => { setInboxUnreadOnly((v) => !v); setInboxPage(1); }}
            />

            {inboxLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 88, borderRadius: "var(--radius-md)" }} />)}
              </div>
            ) : inbox.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">🔔</div>
                <h3 className="empty-state__title">
                  {inboxFilters.q || inboxFilters.type || inboxFilters.sent_after || inboxFilters.sent_before || inboxUnreadOnly
                    ? "No notifications match your filters"
                    : "No notifications yet"}
                </h3>
                <p className="empty-state__message">
                  {inboxFilters.q || inboxFilters.type || inboxFilters.sent_after || inboxFilters.sent_before || inboxUnreadOnly
                    ? "Try clearing some filters to see more."
                    : "Important updates from your teachers and school will appear here."}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {inbox.map((n) => (
                  <InboxRow key={n.id} n={n} onClick={handleInboxItemClick} />
                ))}
              </div>
            )}

            {inboxPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)", marginTop: "var(--space-8)", alignItems: "center" }}>
                <button className="btn btn--secondary" disabled={inboxPage <= 1} onClick={() => setInboxPage((p) => p - 1)}>← Previous</button>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{inboxPage} / {inboxPages}</span>
                <button className="btn btn--secondary" disabled={inboxPage >= inboxPages} onClick={() => setInboxPage((p) => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}

        {/* ── SEND TAB ──────────────────────────────────────────────────── */}
        {activeTab === "send" && isSender && (
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <div style={{ marginBottom: "var(--space-5)" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--ink-primary)", letterSpacing: "-0.02em", margin: 0 }}>
                Send Message
              </h2>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
                Broadcast announcements or updates to your students.
              </p>
            </div>

            {sendSuccess && <div className="alert alert--success" style={{ marginBottom: "var(--space-5)" }}>✓ {sendSuccess}</div>}
            {sendError   && <div className="alert alert--error"   style={{ marginBottom: "var(--space-5)" }}>{sendError}</div>}

            <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
              <div>
                <label className="form-label">Subject <span style={{ color: "var(--error)" }}>*</span></label>
                <input className="form-input" type="text" placeholder="e.g. Class test on Friday" value={form.subject ?? ""} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} maxLength={255} />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-2)" }}>
                  <label className="form-label" style={{ margin: 0 }}>Message</label>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Markdown: **bold**, _italic_, - lists</span>
                </div>
                <textarea className="form-input" rows={5} placeholder={"Write your message…\n\n**Bold**, _italic_, and - bullet lists are supported."} value={form.message ?? ""} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} style={{ resize: "vertical", fontFamily: "monospace", fontSize: "var(--text-sm)" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <div>
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.notification_type ?? "announcement"} onChange={(e) => setForm((f) => ({ ...f, notification_type: e.target.value as NotificationType }))}>
                    {Object.entries(NOTIFICATION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Send to <span style={{ color: "var(--error)" }}>*</span></label>
                  <select className="form-input" value={form.audience_type ?? ""} onChange={(e) => setForm((f) => ({ ...f, audience_type: e.target.value as AudienceType, class_id: undefined, institution_id: undefined }))}>
                    <option value="">— Select audience —</option>
                    {options?.allowed_audience_types.map((a) => <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>)}
                  </select>
                </div>
              </div>

              {form.audience_type && needsClass(form.audience_type) && options && options.classrooms.length > 0 && (
                <div>
                  <label className="form-label">Select Class <span style={{ color: "var(--error)" }}>*</span></label>
                  <select className="form-input" value={form.class_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, class_id: Number(e.target.value) || undefined }))}>
                    <option value="">— Select class —</option>
                    {options.classrooms.map((c) => <option key={c.id} value={c.id}>Class {c.name} · {c["institution__name"]}</option>)}
                  </select>
                </div>
              )}

              {form.audience_type && user && needsInstitution(form.audience_type, user.role) && options && options.institutions.length > 0 && (
                <div>
                  <label className="form-label">Select School <span style={{ color: "var(--error)" }}>*</span></label>
                  <select className="form-input" value={form.institution_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, institution_id: Number(e.target.value) || undefined }))}>
                    <option value="">— Select school —</option>
                    {options.institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="form-label">Link (optional)</label>
                <input className="form-input" type="text" placeholder="Internal: /assessments/12  or  External: https://example.com" value={form.link ?? ""} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>Must start with / (internal) or https://</div>
              </div>

              <div>
                <label className="form-label">Attachment (optional)</label>
                {uploadError && <div className="alert alert--error" style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-xs)" }}>{uploadError}</div>}
                <FileUploader value={attachment} onChange={setAttachment} onError={setUploadError} />
              </div>

              <button className="btn btn--primary" onClick={handleSend} disabled={sending} style={{ alignSelf: "flex-start" }}>
                {sending ? "Sending…" : "Send Message"}
              </button>
            </div>
          </div>
        )}

        {/* ── SENT HISTORY TAB ──────────────────────────────────────────── */}
        {activeTab === "history" && isSender && (
          <>
            <div style={{ marginBottom: "var(--space-5)" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--ink-primary)", letterSpacing: "-0.02em", margin: 0 }}>
                Sent History
              </h2>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
                All broadcasts sent by you — click any to see read receipts.
              </p>
            </div>

            <FilterBar filters={sentFilters} onChange={updateSentFilters} />

            {sentLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 90, borderRadius: "var(--radius-lg)" }} />)}
              </div>
            ) : sentList.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">📭</div>
                <h3 className="empty-state__title">No messages sent yet</h3>
                <p className="empty-state__message">Messages you send will appear here.</p>
              </div>
            ) : (
              <>
                {sentTotal > 0 && (
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: "var(--space-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {sentTotal} message{sentTotal !== 1 ? "s" : ""}
                  </p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {sentList.map((b) => <SentCard key={b.id} b={b} onClick={(x) => setBroadcastDetailId(x.id)} />)}
                </div>
                {sentPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)", marginTop: "var(--space-8)", alignItems: "center" }}>
                    <button className="btn btn--secondary" disabled={sentPage <= 1} onClick={() => setSentPage((p) => p - 1)}>← Previous</button>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{sentPage} / {sentPages}</span>
                    <button className="btn btn--secondary" disabled={sentPage >= sentPages} onClick={() => setSentPage((p) => p + 1)}>Next →</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

      {/* Portalled modals */}
      {detailNotif && createPortal(
        <NotificationDetailModal notification={detailNotif} onClose={() => setDetailNotif(null)} />,
        document.body
      )}
      {broadcastDetailId !== null && (
        <BroadcastDetailModal broadcast_id={broadcastDetailId} onClose={() => setBroadcastDetailId(null)} />
      )}
    </>
  );
}