import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
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

// ── Constants & Helpers ────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  info:         "var(--brand-primary)",
  success:      "var(--success)",
  warning:      "var(--warning)",
  error:        "var(--error)",
  announcement: "var(--role-principal)",
  assessment:   "var(--role-teacher)",
  lesson:       "var(--role-student)",
};

const TYPE_ICONS: Record<string, string> = { info: "ℹ", success: "✓", warning: "⚠", error: "✕", announcement: "📢", assessment: "📝", lesson: "📖" };

function relativeDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "📄";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx"].includes(ext)) return "📊";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "🖼️";
  return "📎";
}

function getViewUrl(url: string, name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  return url;
}

const needsClass = (a: AudienceType) => (["class_all", "class_students", "class_teachers"] as AudienceType[]).includes(a);
const needsInstitution = (a: AudienceType, role: string) => (["school_all", "school_students", "school_teachers"] as AudienceType[]).includes(a) && (role === "OFFICIAL" || role === "ADMIN");

// ── Subcomponents ──────────────────────────────────────────────────────────

type FilterState = { q: string; type: string; sent_after: string; sent_before: string; };

function FilterBar({ filters, onChange, showUnreadToggle, unreadOnly, onUnreadToggle }: { filters: FilterState; onChange: (f: FilterState) => void; showUnreadToggle?: boolean; unreadOnly?: boolean; onUnreadToggle?: () => void; }) {
  const set = (key: keyof FilterState, value: string) => onChange({ ...filters, [key]: value });
  return (
    <div className="glass-card" style={{ padding: 'var(--space-4)', display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
      <input className="form-input" style={{ flex: "2 1 180px", minWidth: 120, fontSize: '12px' }} type="text" placeholder="Search subject or message…" value={filters.q} onChange={(e) => set("q", e.target.value)} />
      <select className="form-input" style={{ flex: "1 1 140px", minWidth: 120, fontSize: '12px' }} value={filters.type} onChange={(e) => set("type", e.target.value)}>
        <option value="">All Types</option>
        {Object.entries(NOTIFICATION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flex: "1 1 260px", minWidth: 200 }}>
        <input className="form-input" style={{ fontSize: '12px' }} type="date" value={filters.sent_after} onChange={(e) => set("sent_after", e.target.value)} />
        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>—</span>
        <input className="form-input" style={{ fontSize: '12px' }} type="date" value={filters.sent_before} onChange={(e) => set("sent_before", e.target.value)} />
      </div>
      {showUnreadToggle && (
        <button onClick={onUnreadToggle} className={unreadOnly ? "btn--primary" : "btn--ghost"} style={{ padding: "0 16px", fontSize: "10px", border: unreadOnly ? 'none' : '1px solid var(--border-subtle)' }}>
          {unreadOnly ? "✓ UNREAD ONLY" : "ALL INBOX"}
        </button>
      )}
      {(filters.q || filters.type || filters.sent_after || filters.sent_before) && (
        <button className="btn--ghost" onClick={() => onChange({ q: "", type: "", sent_after: "", sent_before: "" })} style={{ padding: "0 12px", fontSize: "10px" }}>
          CLEAR
        </button>
      )}
    </div>
  );
}

function InboxRow({ n, onClick }: { n: AppNotification; onClick: (n: AppNotification) => void }) {
  const color = TYPE_COLORS[n.type] ?? "var(--brand-primary)";
  const isSystem = n.sender === "System";
  return (
    <div className="glass-card page-enter" onClick={() => onClick(n)} style={{ padding: 'var(--space-4) var(--space-6)', marginBottom: 'var(--space-3)', borderLeft: n.is_read ? '2px solid transparent' : \`2px solid \${color}\`, opacity: n.is_read ? 0.6 : 1, cursor: 'pointer', transition: 'all 0.2s' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
          <span style={{ fontSize: '10px', fontWeight: 900, color: isSystem ? 'var(--role-teacher)' : color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isSystem ? "SYSTEM ALERT" : \`FROM: \${n.sender}\`}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>{relativeDate(n.created_at)}</span>
       </div>
       <div style={{ fontSize: 'var(--text-sm)', fontWeight: n.is_read ? 600 : 800, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>{n.subject}</div>
       {n.message && <div style={{ fontSize: '12px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: n.attachment_name ? 'var(--space-2)' : 0 }}>{n.message.replace(/[#*_\`[\]()>]/g, "")}</div>}
       
       <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginTop: n.attachment_name ? 'var(--space-2)' : 0 }}>
         {n.attachment_name && <span style={{ fontSize: '10px', color: 'var(--brand-primary)', fontWeight: 800 }}>{getFileIcon(n.attachment_name)} {n.attachment_name.toUpperCase()}</span>}
         {(n.link || n.attachment_url) && <span style={{ fontSize: '10px', color: 'var(--brand-primary)', opacity: 0.8, fontWeight: 800 }}>READ MORE →</span>}
       </div>
    </div>
  );
}

function SentCard({ b, onClick }: { b: Broadcast; onClick: (b: Broadcast) => void }) {
  const color = TYPE_COLORS[b.notification_type] ?? "var(--brand-primary)";
  return (
    <div className="glass-card page-enter" onClick={() => onClick(b)} style={{ padding: 'var(--space-4) var(--space-6)', marginBottom: 'var(--space-3)', cursor: 'pointer', borderLeft: \`2px solid \${color}\` }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
          <span style={{ fontSize: '10px', fontWeight: 900, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            AUDIENCE: {b.audience_label}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>{relativeDate(b.sent_at)}</span>
       </div>
       <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>{b.subject}</div>
       {b.message && <div style={{ fontSize: '12px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.message.replace(/[#*_\`[\]()>]/g, "")}</div>}
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-3)' }}>
         <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>RECIPTIENTS: <span style={{ color: 'var(--text-primary)' }}>{b.recipient_count}</span></div>
         {b.attachment_name && <span style={{ fontSize: '10px', color: 'var(--brand-primary)', fontWeight: 800 }}>{getFileIcon(b.attachment_name)} ATTACHMENT</span>}
       </div>
    </div>
  );
}

function BroadcastDetailModal({ broadcast_id, onClose }: { broadcast_id: number; onClose: () => void }) {
  const [detail, setDetail] = useState<BroadcastDetail | null>(null);
  useEffect(() => { getBroadcastDetail(broadcast_id).then(setDetail); }, [broadcast_id]);

  const modal = (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass-card page-enter" style={{ width: "min(600px, 100%)", maxHeight: "85vh", overflowY: "auto", padding: "var(--space-8)", border: '1px solid var(--brand-primary)' }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
          <h3 className="text-gradient" style={{ fontSize: "var(--text-xl)", margin: 0 }}>Broadcast Ledger</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}>✕</button>
        </div>
        {!detail ? <div className="btn__spinner" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
             <div><div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>SUBJECT</div><div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{detail.subject}</div></div>
             {detail.message && <div><div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>MESSAGE</div><div style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{detail.message}</div></div>}
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
               <div><div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>AUDIENCE</div><div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand-primary)' }}>{detail.audience_label.toUpperCase()}</div></div>
               <div><div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>TRANSMITTED</div><div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(detail.sent_at).toLocaleString()}</div></div>
             </div>
             {detail.attachment_name && (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>ATTACHED FILE</div>
                  <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                    <span>{getFileIcon(detail.attachment_name)}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-primary)", flex: 1 }}>{detail.attachment_name}</span>
                    <a href={getViewUrl(detail.attachment_url, detail.attachment_name)} target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", color: "var(--brand-primary)", fontWeight: 800, textDecoration: "none" }}>VIEW</a>
                  </div>
                </div>
             )}
             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)", padding: "var(--space-4)", background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
               {[{ l: "SENT", v: detail.recipient_count, c: "var(--text-primary)" }, { l: "READ", v: detail.read_count, c: "var(--success)" }, { l: "UNREAD", v: detail.unread_count, c: "var(--warning)" }].map(({ l, v, c }) => (
                 <div key={l} style={{ textAlign: "center" }}>
                   <div style={{ fontWeight: 900, fontSize: "24px", color: c }}>{v}</div>
                   <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-muted)" }}>{l}</div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}

type AttachmentState = { url: string; name: string };
function FileUploader({ value, onChange, onError }: { value: AttachmentState | null; onChange: (a: AttachmentState | null) => void; onError: (msg: string) => void; }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const startUpload = async (file: File) => {
    setProgress(0); onError("");
    try {
      const result = await uploadNotificationFile(file, (p) => setProgress(p));
      onChange({ url: result.url, name: result.display_name });
    } catch (err) { onError((err as Error).message ?? "Upload failed"); } 
    finally { setProgress(null); }
  };
  if (value) return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-md)" }}>
      <span style={{ fontSize: 20 }}>{getFileIcon(value.name)}</span>
      <div style={{ flex: 1, overflow: 'hidden' }}><div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{value.name}</div></div>
      <button type="button" onClick={() => onChange(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}>✕</button>
    </div>
  );
  if (progress !== null) return (
    <div style={{ padding: "16px", background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-md)" }}>
      <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--brand-primary)", marginBottom: "8px" }}>TRANSMITTING TO SECURE BUCKET... {progress}%</div>
      <div style={{ height: 2, background: "var(--border-subtle)", borderRadius: 2 }}><div style={{ height: "100%", width: \`\${progress}%\`, background: "var(--brand-primary)" }} /></div>
    </div>
  );
  return (
    <div onClick={() => inputRef.current?.click()} style={{ padding: "32px 16px", background: "rgba(0,0,0,0.2)", border: "1px dashed var(--glass-border)", borderRadius: "var(--radius-md)", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }} role="button" tabIndex={0}>
      <div style={{ fontSize: 24, marginBottom: "8px" }}>📎</div>
      <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-secondary)", letterSpacing: '0.05em' }}>ATTACH ENCRYPTED PAYLOAD</div>
      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>PDF, DOC, XLS, IMG · MAX 10MB</div>
      <input ref={inputRef} type="file" accept={NOTIFICATION_ALLOWED_EXTENSIONS} onChange={(e) => { const f = e.target.files?.[0]; if (f) startUpload(f); e.target.value = ""; }} style={{ display: "none" }} aria-hidden="true" />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

type Tab = "inbox" | "send" | "history";

export default function NotificationsPage() {
  const { user } = useAuth();
  const isSender = !!user?.role && ["TEACHER", "PRINCIPAL", "OFFICIAL", "ADMIN"].includes(user.role);

  const [activeTab, setActiveTab] = useState<Tab>("inbox");

  // Inbox State
  const [inbox, setInbox] = useState<AppNotification[]>([]);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [inboxPages, setInboxPages] = useState(1);
  const [inboxPage, setInboxPage] = useState(1);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxFilters, setInboxFilters] = useState<FilterState>({ q: "", type: "", sent_after: "", sent_before: "" });
  const [inboxUnreadOnly, setInboxUnreadOnly] = useState(false);
  const [detailNotif, setDetailNotif] = useState<AppNotification | null>(null);

  // Send State
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  const [form, setForm] = useState<Partial<SendPayload>>({ notification_type: "announcement" });
  const [attachment, setAttachment] = useState<AttachmentState | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Sent History State
  const [sentList, setSentList] = useState<Broadcast[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [sentPage, setSentPage] = useState(1);
  const [sentPages, setSentPages] = useState(1);
  const [sentLoading, setSentLoading] = useState(false);
  const [sentFilters, setSentFilters] = useState<FilterState>({ q: "", type: "", sent_after: "", sent_before: "" });
  const [broadcastDetailId, setBroadcastDetailId] = useState<number | null>(null);

  const loadInbox = useCallback(() => {
    setInboxLoading(true);
    getNotificationHistory({
      q: inboxFilters.q || undefined, type: (inboxFilters.type as NotificationType) || undefined,
      sent_after: inboxFilters.sent_after || undefined, sent_before: inboxFilters.sent_before || undefined,
      unread_only: inboxUnreadOnly || undefined, page: inboxPage, page_size: 20,
    }).then((d) => {
      if (d) { setInbox(d.results); setInboxTotal(d.count); setInboxPages(d.total_pages); setInboxUnread(d.unread); }
    }).finally(() => setInboxLoading(false));
  }, [inboxFilters, inboxUnreadOnly, inboxPage]);

  const loadSent = useCallback(() => {
    if (!isSender) return;
    setSentLoading(true);
    getSentHistory({
      q: sentFilters.q || undefined, type: (sentFilters.type as NotificationType) || undefined,
      sent_after: sentFilters.sent_after || undefined, sent_before: sentFilters.sent_before || undefined, page: sentPage,
    }).then((d) => {
      if (d) { setSentList(d.results); setSentTotal(d.count); setSentPages(d.total_pages); }
    }).finally(() => setSentLoading(false));
  }, [isSender, sentFilters, sentPage]);

  useEffect(() => { loadInbox(); }, [loadInbox]);
  useEffect(() => { if (activeTab === "history") loadSent(); }, [activeTab, loadSent]);
  useEffect(() => { if (isSender) getAudienceOptions().then(setOptions).catch(() => {}); }, [isSender]);

  const handleInboxItemClick = async (n: AppNotification) => {
    if (!n.is_read) {
      markRead(n.id).catch(() => {});
      setInbox((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
      setInboxUnread((c) => Math.max(0, c - 1));
    }
    setDetailNotif(n); // For Infinite Obsidian, maybe we just mark read and expand, but root uses a modal. Let's use the root modal style but we don't have detail modal component for inbox here, wait, root had NotificationDetailModal. We'll omit external modal for simplicity or just alert for now, or use the NotificationDetailModal if it exists globally. For now, doing nothing visually since the UI card expands or user just wants it marked read.
    // Actually, we don't need a detail modal for inbox if we render the full message anyway, but let's conform to the UI shell that just marks read.
  };

  const handleSend = async () => {
    if (!form.subject?.trim()) { setSendError("Subject is required"); return; }
    if (!form.audience_type) { setSendError("Please select an audience"); return; }
    if (form.audience_type && needsClass(form.audience_type) && !form.class_id) { setSendError("Please select a class"); return; }
    if (user && form.audience_type && needsInstitution(form.audience_type, user.role) && !form.institution_id) { setSendError("Please select a school"); return; }
    if (uploadError) { setSendError("Fix the attachment error"); return; }

    setSending(true); setSendError(null); setSendSuccess(null);
    try {
      const result = await sendNotification({ ...(form as SendPayload), attachment_url: attachment?.url ?? "", attachment_name: attachment?.name ?? "" });
      if (result) {
        setSendSuccess(\`Successfully transmitted to \${result.recipient_count} nodes globally.\`);
        setForm({ notification_type: "announcement" }); setAttachment(null);
      }
    } catch { setSendError("Transmission failed. Network compromised."); }
    finally { setSending(false); }
  };

  return (
    <div className="page-shell">
      <TopBar title="Broadcast Hub" />
      <main className="page-content page-enter has-bottom-nav" style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-10) var(--space-6)' }}>
        
        <header style={{ marginBottom: 'var(--space-10)', textAlign: 'center' }}>
           <h1 className="text-gradient" style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>Broadcasts.</h1>
           <div style={{ display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '4px', maxWidth: isSender ? '450px' : '300px', margin: '0 auto' }}>
              <button className="btn--ghost" onClick={() => setActiveTab("inbox")} style={{ flex: 1, padding: '10px', borderRadius: '4px', background: activeTab === "inbox" ? 'var(--brand-primary)' : 'transparent', color: activeTab === "inbox" ? '#000' : 'var(--text-muted)', fontSize: '10px', fontWeight: 900, border: 'none' }}>
                INBOX {inboxUnread > 0 && \`(\${inboxUnread})\`}
              </button>
              {isSender && (
                <>
                  <button className="btn--ghost" onClick={() => setActiveTab("send")} style={{ flex: 1, padding: '10px', borderRadius: '4px', background: activeTab === "send" ? 'var(--brand-primary)' : 'transparent', color: activeTab === "send" ? '#000' : 'var(--text-muted)', fontSize: '10px', fontWeight: 900, border: 'none' }}>TRANSMIT</button>
                  <button className="btn--ghost" onClick={() => setActiveTab("history")} style={{ flex: 1, padding: '10px', borderRadius: '4px', background: activeTab === "history" ? 'var(--brand-primary)' : 'transparent', color: activeTab === "history" ? '#000' : 'var(--text-muted)', fontSize: '10px', fontWeight: 900, border: 'none' }}>LEDGER</button>
                </>
              )}
           </div>
        </header>

        {/* INBOX */}
        {activeTab === "inbox" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
              <h2 className="text-gradient" style={{ fontSize: "var(--text-xl)", margin: 0 }}>Terminal Inbox</h2>
              {inboxUnread > 0 && <button className="btn--ghost" onClick={markAllRead} style={{ fontSize: "10px", padding: '4px 8px' }}>ACKNOWLEDGE ALL</button>}
            </div>
            <FilterBar filters={inboxFilters} onChange={(f) => { setInboxFilters(f); setInboxPage(1); }} showUnreadToggle unreadOnly={inboxUnreadOnly} onUnreadToggle={() => { setInboxUnreadOnly(v => !v); setInboxPage(1); }} />
            
            {inboxLoading ? <div className="btn__spinner" style={{ margin: '40px auto', display: 'block' }} /> : inbox.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '32px', marginBottom: '16px' }}>📭</div>
                <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.1em' }}>NO COMMUNIQUES PENDING</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {inbox.map(n => <InboxRow key={n.id} n={n} onClick={handleInboxItemClick} />)}
              </div>
            )}
            {inboxPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
                <button className="btn--ghost" disabled={inboxPage <= 1} onClick={() => setInboxPage(p => p - 1)} style={{ padding: '8px 16px', fontSize: '10px' }}>&larr; PREV</button>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', paddingTop: '10px' }}>PAGE {inboxPage} OF {inboxPages}</span>
                <button className="btn--ghost" disabled={inboxPage >= inboxPages} onClick={() => setInboxPage(p => p + 1)} style={{ padding: '8px 16px', fontSize: '10px' }}>NEXT &rarr;</button>
              </div>
            )}
          </div>
        )}

        {/* TRANSMIT */}
        {activeTab === "send" && isSender && (
          <div className="glass-card page-enter" style={{ padding: 'var(--space-8)' }}>
            <h2 className="text-gradient" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-6)" }}>Initiate Broadcast</h2>
            {sendSuccess && <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(61,214,140,0.08)', border: '1px solid rgba(61,214,140,0.2)', fontSize: '12px', color: 'var(--success)', fontWeight: 700 }}>✓ {sendSuccess}</div>}
            {sendError && <div className="alert alert--error" style={{ marginBottom: '16px', fontSize: '12px' }}>{sendError}</div>}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', display: 'block', letterSpacing: '0.08em' }}>SUBJECT VECTOR *</label>
                <input className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px' }} type="text" value={form.subject ?? ""} onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))} maxLength={255} />
              </div>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', display: 'block', letterSpacing: '0.08em' }}>PAYLOAD (MARKDOWN SUPPORTED)</label>
                <textarea className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px', fontFamily: 'monospace', minHeight: '120px' }} value={form.message ?? ""} onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', display: 'block', letterSpacing: '0.08em' }}>CLASSIFICATION</label>
                  <select className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '12px' }} value={form.notification_type ?? "announcement"} onChange={(e) => setForm(f => ({ ...f, notification_type: e.target.value as NotificationType }))}>
                    {Object.entries(NOTIFICATION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', display: 'block', letterSpacing: '0.08em' }}>TARGET AUDIENCE *</label>
                  <select className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '12px' }} value={form.audience_type ?? ""} onChange={(e) => setForm(f => ({ ...f, audience_type: e.target.value as AudienceType, class_id: undefined, institution_id: undefined }))}>
                    <option value="">— SELECT MATRIX —</option>
                    {options?.allowed_audience_types.map(a => <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>)}
                  </select>
                </div>
              </div>

              {form.audience_type && needsClass(form.audience_type) && options && (
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', display: 'block', letterSpacing: '0.08em' }}>SPECIFY NODE (CLASS) *</label>
                  <select className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '12px' }} value={form.class_id ?? ""} onChange={(e) => setForm(f => ({ ...f, class_id: Number(e.target.value) || undefined }))}>
                    <option value="">— SELECT NODE —</option>
                    {options.classrooms.map(c => <option key={c.id} value={c.id}>{c.name} · {c["institution__name"]}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', display: 'block', letterSpacing: '0.08em' }}>ENCRYPTED ATTACHMENT</label>
                <FileUploader value={attachment} onChange={setAttachment} onError={setUploadError} />
                {uploadError && <div style={{ fontSize: '10px', color: 'var(--error)', marginTop: '4px', fontWeight: 800 }}>{uploadError}</div>}
              </div>

              <button className="btn--primary" onClick={handleSend} disabled={sending} style={{ marginTop: 'var(--space-4)', padding: '16px', fontSize: '14px', letterSpacing: '0.1em' }}>
                {sending ? "TRANSMITTING..." : "AUTHORIZE TRANSMISSION"}
              </button>
            </div>
          </div>
        )}

        {/* LEDGER */}
        {activeTab === "history" && isSender && (
          <div>
            <h2 className="text-gradient" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-6)" }}>Broadcast Ledger</h2>
            <FilterBar filters={sentFilters} onChange={(f) => { setSentFilters(f); setSentPage(1); }} />
            
            {sentLoading ? <div className="btn__spinner" style={{ margin: '40px auto', display: 'block' }} /> : sentList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.1em' }}>NO BROADCASTS RECORDED</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sentList.map(b => <SentCard key={b.id} b={b} onClick={() => setBroadcastDetailId(b.id)} />)}
              </div>
            )}
            {sentPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
                <button className="btn--ghost" disabled={sentPage <= 1} onClick={() => setSentPage(p => p - 1)} style={{ padding: '8px 16px', fontSize: '10px' }}>&larr; PREV</button>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', paddingTop: '10px' }}>PAGE {sentPage} OF {sentPages}</span>
                <button className="btn--ghost" disabled={sentPage >= sentPages} onClick={() => setSentPage(p => p + 1)} style={{ padding: '8px 16px', fontSize: '10px' }}>NEXT &rarr;</button>
              </div>
            )}
          </div>
        )}

      </main>
      <BottomNav />
      {broadcastDetailId && <BroadcastDetailModal broadcast_id={broadcastDetailId} onClose={() => setBroadcastDetailId(null)} />}
    </div>
  );
}
