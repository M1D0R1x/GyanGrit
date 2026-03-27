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
import TopBar                    from "../components/TopBar";
import BottomNav                 from "../components/BottomNav";
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

// ── Constants & helpers ────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  info:         "var(--role-teacher)",
  success:      "var(--role-student)",
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

function getViewUrl(url: string, name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  }
  return url;
}

// ── Filter bar ────────────────────────────────────────────────────────────

type FilterState = {
  q:           string;
  type:        string;
  sent_after:  string;
  sent_before: string;
};

function FilterBar({
  filters, onChange, showUnreadToggle, unreadOnly, onUnreadToggle,
}: {
  filters:          FilterState;
  onChange:         (f: FilterState) => void;
  showUnreadToggle?: boolean;
  unreadOnly?:      boolean;
  onUnreadToggle?:  () => void;
}) {
  const set = (key: keyof FilterState, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
      <input
        className="obsidian-input"
        type="text"
        placeholder="Search subject or message…"
        value={filters.q}
        onChange={(e) => set("q", e.target.value)}
        style={{ flex: "2 1 180px", minWidth: 120 }}
      />
      <select
        className="obsidian-input"
        value={filters.type}
        onChange={(e) => set("type", e.target.value)}
        style={{ flex: "1 1 140px", minWidth: 120 }}
      >
        <option value="">All types</option>
        {Object.entries(NOTIFICATION_TYPE_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flex: "1 1 260px", minWidth: 200 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)" }}>FROM</label>
          <input className="obsidian-input" type="date" value={filters.sent_after} onChange={(e) => set("sent_after", e.target.value)} />
        </div>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", paddingTop: 18 }}>—</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)" }}>TO</label>
          <input className="obsidian-input" type="date" value={filters.sent_before} onChange={(e) => set("sent_before", e.target.value)} />
        </div>
      </div>
      {showUnreadToggle && (
        <button
          onClick={onUnreadToggle}
          style={{
            padding:      "0 var(--space-4)",
            background:   unreadOnly ? "rgba(61,214,140,0.15)" : "rgba(255,255,255,0.05)",
            border:       `1px solid ${unreadOnly ? "rgba(61,214,140,0.4)" : "var(--glass-border)"}`,
            borderRadius: "var(--radius-sm)",
            color:        unreadOnly ? "var(--role-student)" : "var(--text-secondary)",
            fontSize:     "var(--text-xs)",
            fontWeight:   700,
            cursor:       "pointer",
            whiteSpace:   "nowrap",
            letterSpacing: "0.04em",
          }}
        >
          {unreadOnly ? "✓ UNREAD ONLY" : "ALL"}
        </button>
      )}
      {(filters.q || filters.type || filters.sent_after || filters.sent_before) && (
        <button
          onClick={() => onChange({ q: "", type: "", sent_after: "", sent_before: "" })}
          className="btn--ghost"
          style={{ padding: "0 var(--space-3)", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ── Inbox notification row ─────────────────────────────────────────────────

function InboxRow({ n, onClick }: { n: AppNotification; onClick: (n: AppNotification) => void }) {
  const color = TYPE_COLORS[n.type] ?? "var(--role-teacher)";
  const icon  = TYPE_ICONS[n.type]  ?? "ℹ";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(n)}
      onKeyDown={(e) => e.key === "Enter" && onClick(n)}
      className="glass-card animate-fade-up"
      style={{
        display:    "flex",
        gap:        "var(--space-4)",
        padding:    "var(--space-4) var(--space-5)",
        borderLeft: `3px solid ${n.is_read ? "transparent" : color}`,
        cursor:     "pointer",
        background: n.is_read ? "var(--glass-bg)" : `${color}08`,
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = n.is_read ? "var(--glass-bg)" : `${color}08`)}
    >
      {/* Type icon */}
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: `${color}22`, color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, fontWeight: 700, flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
          <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize: "var(--text-sm)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {n.subject}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
            {!n.is_read && (
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
            )}
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{relativeDate(n.created_at)}</span>
          </div>
        </div>
        {n.message && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {n.message.replace(/[#*_`[\]()\>]/g, "").slice(0, 160)}
          </div>
        )}
        <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)", alignItems: "center" }}>
          {n.sender && n.sender !== "System" && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>From: {n.sender}</span>
          )}
          {n.attachment_name && (
            <span style={{ fontSize: "var(--text-xs)", color }}>{getFileIcon(n.attachment_name)} {n.attachment_name}</span>
          )}
          {(n.link || n.attachment_url) && (
            <span style={{ fontSize: "var(--text-xs)", color, opacity: 0.8 }}>Read more →</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sent card ─────────────────────────────────────────────────────────────

function SentCard({ b, onClick }: { b: Broadcast; onClick: (b: Broadcast) => void }) {
  const color = TYPE_COLORS[b.notification_type] ?? "var(--role-teacher)";
  return (
    <div
      className="glass-card animate-fade-up"
      style={{ cursor: "pointer" }}
      onClick={() => onClick(b)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(b)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {NOTIFICATION_TYPE_LABELS[b.notification_type] ?? b.notification_type}
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>·</span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{b.audience_label}</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "var(--space-1)" }}>
            {b.subject}
          </div>
          {b.message && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {b.message.replace(/[#*_`[\]()\>]/g, "").slice(0, 120)}
            </div>
          )}
          {b.attachment_name && (
            <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "center", marginTop: "var(--space-2)" }}>
              <span style={{ fontSize: 12 }}>{getFileIcon(b.attachment_name)}</span>
              <span style={{ fontSize: "var(--text-xs)", color }}>{b.attachment_name}</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{relativeDate(b.sent_at)}</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "var(--space-1)", letterSpacing: "-0.02em" }}>
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
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 10000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "5vh", overflowY: "auto" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-card" style={{ width: "min(560px, calc(100vw - 2rem))", maxHeight: "85vh", overflow: "auto", padding: "var(--space-6)", animation: "fadeInUp 0.2s ease both", boxShadow: "0 24px 80px rgba(0,0,0,0.6)", border: "1px solid var(--glass-border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>Broadcast Detail</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}>✕</button>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton-box" style={{ height: 20, borderRadius: 4 }} />)}
          </div>
        ) : !detail ? (
          <p style={{ color: "var(--text-muted)" }}>Could not load details.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div><div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 4 }}>SUBJECT</div><div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{detail.subject}</div></div>
            {detail.message && <div><div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 4 }}>MESSAGE</div><div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{detail.message}</div></div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <div><div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 4 }}>AUDIENCE</div><div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{detail.audience_label}</div></div>
              <div><div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 4 }}>SENT</div><div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{new Date(detail.sent_at).toLocaleString("en-IN")}</div></div>
            </div>
            {detail.attachment_name && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 }}>ATTACHMENT</div>
                <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
                  <span style={{ fontSize: 20 }}>{getFileIcon(detail.attachment_name)}</span>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", flex: 1 }}>{detail.attachment_name}</span>
                  <a href={getViewUrl(detail.attachment_url, detail.attachment_name)} target="_blank" rel="noopener noreferrer" style={{ fontSize: "var(--text-xs)", color: "var(--role-student)", fontWeight: 700, textDecoration: "none" }}>View</a>
                  <a href={detail.attachment_url} download={detail.attachment_name} style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textDecoration: "none" }}>Download</a>
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)", padding: "var(--space-4)", background: "rgba(255,255,255,0.03)", borderRadius: "var(--radius-md)", border: "1px solid var(--glass-border)" }}>
              {[
                { label: "Sent to", value: detail.recipient_count, color: "var(--text-primary)" },
                { label: "Read",    value: detail.read_count,      color: "var(--role-student)" },
                { label: "Unread",  value: detail.unread_count,    color: "var(--warning)"      },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color, letterSpacing: "-0.02em" }}>{value}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)" }}>{label.toUpperCase()}</div>
                </div>
              ))}
            </div>
            {detail.recipients.length > 0 && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 }}>RECIPIENTS (FIRST 50)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                  {detail.recipients.map((r) => (
                    <span key={r.user_id} className="role-tag" style={{ background: r.is_read ? "rgba(61,214,140,0.1)" : "rgba(245,158,11,0.1)", color: r.is_read ? "var(--role-student)" : "var(--warning)", border: `1px solid ${r.is_read ? "rgba(61,214,140,0.25)" : "rgba(245,158,11,0.25)"}`, fontSize: 9 }}>
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
    <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)" }}>
      <span style={{ fontSize: 22 }}>{getFileIcon(value.name)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.name}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--role-student)", marginTop: 2 }}>✓ Uploaded</div>
      </div>
      <button type="button" onClick={() => { abortRef.current?.abort(); onChange(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}>✕</button>
    </div>
  );

  if (progress !== null) return (
    <div className="glass-card" style={{ padding: "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>Uploading… {progress}%</div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, var(--role-teacher), var(--role-student))", transition: "width 0.1s", borderRadius: 99 }} />
      </div>
      <button type="button" onClick={() => { abortRef.current?.abort(); setProgress(null); }} style={{ marginTop: "var(--space-2)", background: "none", border: "none", fontSize: "var(--text-xs)", color: "var(--text-muted)", cursor: "pointer" }}>Cancel</button>
    </div>
  );

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) startUpload(f); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      className="glass-card"
      style={{ padding: "var(--space-5)", border: `2px dashed ${dragging ? "rgba(61,214,140,0.5)" : "var(--glass-border)"}`, textAlign: "center", cursor: "pointer", transition: "all 0.15s", background: dragging ? "rgba(61,214,140,0.05)" : "transparent" }}
      role="button" tabIndex={0} aria-label="Attach a file"
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
    >
      <div style={{ fontSize: 24, marginBottom: "var(--space-2)" }}>📎</div>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: dragging ? "var(--role-student)" : "var(--text-secondary)", letterSpacing: "0.02em" }}>
        {dragging ? "Drop file here" : "Click or drag to attach a file"}
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>PDF, Word, Excel, or image · Max 10 MB</div>
      <input ref={inputRef} type="file" accept={NOTIFICATION_ALLOWED_EXTENSIONS} onChange={(e) => { const f = e.target.files?.[0]; if (f) startUpload(f); e.target.value = ""; }} style={{ display: "none" }} aria-hidden="true" />
    </div>
  );
}

// ── Tab types ──────────────────────────────────────────────────────────────

type Tab = "inbox" | "send" | "history";

// ── Main page ──────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { user } = useAuth();
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

  useEffect(() => { loadInbox(); },                            [loadInbox]);
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
    <div className="page-shell">
      <TopBar title="Notifications" />
      <main className="page-content page-enter has-bottom-nav">

        {/* Tab bar */}
        <div className="studio-tabs animate-fade-up" style={{ marginBottom: "var(--space-6)" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`studio-tab-btn ${activeTab === t.key ? "active" : ""}`}
              onClick={() => setActiveTab(t.key)}
              style={{ position: "relative" }}
            >
              {t.label}
              {/* Unread badge on the inbox tab */}
              {t.key === "inbox" && inboxUnread > 0 && (
                <span style={{ position: "absolute", top: 2, right: 4, background: "var(--error)", color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 999, letterSpacing: "0" }}>
                  {inboxUnread > 99 ? "99+" : inboxUnread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── INBOX TAB ─────────────────────────────────────────────────── */}
        {activeTab === "inbox" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-base)", color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
                {inboxTotal > 0 ? `${inboxTotal} notification${inboxTotal !== 1 ? "s" : ""}` : "Notifications"}
                {inboxUnread > 0 && (
                  <span style={{ marginLeft: "var(--space-2)", fontSize: 9, background: "var(--error)", color: "#fff", padding: "1px 7px", borderRadius: 999, fontWeight: 800, verticalAlign: "middle" }}>
                    {inboxUnread} UNREAD
                  </span>
                )}
              </h2>
              {inboxUnread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="btn--ghost"
                  style={{ fontSize: "var(--text-xs)", color: "var(--role-student)", fontWeight: 700 }}
                >
                  Mark all read
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
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton-box" style={{ height: 88, borderRadius: "var(--radius-md)" }} />)}
              </div>
            ) : inbox.length === 0 ? (
              <div className="glass-card empty-well animate-fade-up">
                <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>🔔</span>
                <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>
                  {inboxFilters.q || inboxFilters.type || inboxFilters.sent_after || inboxFilters.sent_before || inboxUnreadOnly
                    ? "NO MATCHING NOTIFICATIONS"
                    : "NO NOTIFICATIONS YET"}
                </p>
                <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                  {inboxFilters.q || inboxFilters.type || inboxFilters.sent_after || inboxFilters.sent_before || inboxUnreadOnly
                    ? "Try clearing some filters to see more."
                    : "Important updates from your teachers and school will appear here."}
                </span>
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
                <button className="btn--secondary" disabled={inboxPage <= 1} onClick={() => setInboxPage((p) => p - 1)}>← Previous</button>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", fontWeight: 600 }}>{inboxPage} / {inboxPages}</span>
                <button className="btn--secondary" disabled={inboxPage >= inboxPages} onClick={() => setInboxPage((p) => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}

        {/* ── SEND TAB ──────────────────────────────────────────────────── */}
        {activeTab === "send" && isSender && (
          <div style={{ maxWidth: 640 }}>
            {sendSuccess && <div className="alert alert--success animate-fade-up" style={{ marginBottom: "var(--space-5)" }}>✓ {sendSuccess}</div>}
            {sendError   && <div className="alert alert--error   animate-fade-up" style={{ marginBottom: "var(--space-5)" }}>{sendError}</div>}

            <div className="glass-card animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
              <div>
                <label className="form-label">Subject <span style={{ color: "var(--error)" }}>*</span></label>
                <input className="obsidian-input" type="text" placeholder="e.g. Class test on Friday" value={form.subject ?? ""} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} maxLength={255} />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-2)" }}>
                  <label className="form-label" style={{ margin: 0 }}>Message</label>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Markdown: **bold**, _italic_, - lists</span>
                </div>
                <textarea className="obsidian-input" rows={5} placeholder={"Write your message…\n\n**Bold**, _italic_, and - bullet lists are supported."} value={form.message ?? ""} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} style={{ resize: "vertical", fontFamily: "monospace", fontSize: "var(--text-sm)" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <div>
                  <label className="form-label">Type</label>
                  <select className="obsidian-input" value={form.notification_type ?? "announcement"} onChange={(e) => setForm((f) => ({ ...f, notification_type: e.target.value as NotificationType }))}>
                    {Object.entries(NOTIFICATION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Send to <span style={{ color: "var(--error)" }}>*</span></label>
                  <select className="obsidian-input" value={form.audience_type ?? ""} onChange={(e) => setForm((f) => ({ ...f, audience_type: e.target.value as AudienceType, class_id: undefined, institution_id: undefined }))}>
                    <option value="">— Select audience —</option>
                    {options?.allowed_audience_types.map((a) => <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>)}
                  </select>
                </div>
              </div>

              {form.audience_type && needsClass(form.audience_type) && options && options.classrooms.length > 0 && (
                <div>
                  <label className="form-label">Select Class <span style={{ color: "var(--error)" }}>*</span></label>
                  <select className="obsidian-input" value={form.class_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, class_id: Number(e.target.value) || undefined }))}>
                    <option value="">— Select class —</option>
                    {options.classrooms.map((c) => <option key={c.id} value={c.id}>Class {c.name} · {c["institution__name"]}</option>)}
                  </select>
                </div>
              )}

              {form.audience_type && user && needsInstitution(form.audience_type, user.role) && options && options.institutions.length > 0 && (
                <div>
                  <label className="form-label">Select School <span style={{ color: "var(--error)" }}>*</span></label>
                  <select className="obsidian-input" value={form.institution_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, institution_id: Number(e.target.value) || undefined }))}>
                    <option value="">— Select school —</option>
                    {options.institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="form-label">Link (optional)</label>
                <input className="obsidian-input" type="text" placeholder="Internal: /assessments/12  or  External: https://example.com" value={form.link ?? ""} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>Must start with / (internal) or https://</div>
              </div>

              <div>
                <label className="form-label">Attachment (optional)</label>
                {uploadError && <div className="alert alert--error" style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-xs)" }}>{uploadError}</div>}
                <FileUploader value={attachment} onChange={setAttachment} onError={setUploadError} />
              </div>

              <button className="btn--primary" onClick={handleSend} disabled={sending} style={{ alignSelf: "flex-start", letterSpacing: "0.05em" }}>
                {sending ? "Sending…" : "SEND MESSAGE"}
              </button>
            </div>
          </div>
        )}

        {/* ── SENT HISTORY TAB ──────────────────────────────────────────── */}
        {activeTab === "history" && isSender && (
          <>
            <FilterBar filters={sentFilters} onChange={updateSentFilters} />

            {sentLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-box" style={{ height: 90, borderRadius: "var(--radius-lg)" }} />)}
              </div>
            ) : sentList.length === 0 ? (
              <div className="glass-card empty-well animate-fade-up">
                <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>📭</span>
                <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>NO MESSAGES SENT YET</p>
                <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Messages you send will appear here.</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-4)", fontWeight: 600 }}>
                  {sentTotal} message{sentTotal !== 1 ? "s" : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {sentList.map((b) => <SentCard key={b.id} b={b} onClick={(x) => setBroadcastDetailId(x.id)} />)}
                </div>
                {sentPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)", marginTop: "var(--space-8)", alignItems: "center" }}>
                    <button className="btn--secondary" disabled={sentPage <= 1} onClick={() => setSentPage((p) => p - 1)}>← Previous</button>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", fontWeight: 600 }}>{sentPage} / {sentPages}</span>
                    <button className="btn--secondary" disabled={sentPage >= sentPages} onClick={() => setSentPage((p) => p + 1)}>Next →</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

      </main>
      <BottomNav />

      {/* Portalled modals */}
      {detailNotif && createPortal(
        <NotificationDetailModal notification={detailNotif} onClose={() => setDetailNotif(null)} />,
        document.body
      )}

      {broadcastDetailId !== null && (
        <BroadcastDetailModal broadcast_id={broadcastDetailId} onClose={() => setBroadcastDetailId(null)} />
      )}
    </div>
  );
}
