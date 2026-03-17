// pages.NotificationsPage
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";
import {
  getAudienceOptions,
  getSentHistory,
  getBroadcastDetail,
  sendNotification,
  type AudienceOptions,
  type AudienceType,
  type Broadcast,
  type BroadcastDetail,
  type NotificationType,
  type SendPayload,
  AUDIENCE_LABELS,
  NOTIFICATION_TYPE_LABELS,
} from "../services/notifications";
import {
  uploadNotificationFile,
  NOTIFICATION_ALLOWED_EXTENSIONS,
} from "../services/media";

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  info:         "var(--brand-primary)",
  success:      "var(--success)",
  warning:      "var(--warning)",
  error:        "var(--error)",
  announcement: "var(--role-principal)",
  assessment:   "var(--role-teacher)",
  lesson:       "var(--role-student)",
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
  if (ext === "pdf")                             return "📄";
  if (["doc", "docx"].includes(ext))             return "📝";
  if (["xls", "xlsx"].includes(ext))             return "📊";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "🖼️";
  return "📎";
}

// ── File uploader widget ───────────────────────────────────────────────────

type AttachmentState = {
  url:  string;
  name: string;
};

function FileUploader({
  value,
  onChange,
  onError,
}: {
  value:    AttachmentState | null;
  onChange: (a: AttachmentState | null) => void;
  onError:  (msg: string) => void;
}) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const abortRef  = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // Cancel ongoing upload on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const startUpload = async (file: File) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setProgress(0);
    onError("");

    try {
      const result = await uploadNotificationFile(
        file,
        (pct) => setProgress(pct),
        controller.signal,
      );
      onChange({ url: result.url, name: result.display_name });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      onError((err as Error).message ?? "Upload failed");
    } finally {
      setProgress(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) startUpload(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) startUpload(file);
    // Reset input so re-selecting same file triggers onChange
    e.target.value = "";
  };

  const handleRemove = () => {
    abortRef.current?.abort();
    onChange(null);
    setProgress(null);
  };

  // File already attached
  if (value) {
    return (
      <div style={{
        display:      "flex",
        alignItems:   "center",
        gap:          "var(--space-3)",
        padding:      "var(--space-3) var(--space-4)",
        background:   "var(--bg-elevated)",
        border:       "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
      }}>
        <span style={{ fontSize: 22 }}>{getFileIcon(value.name)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {value.name}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--success)", marginTop: 2 }}>
            ✓ Uploaded
          </div>
        </div>
        <button
          type="button"
          onClick={handleRemove}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18, padding: "var(--space-1)", borderRadius: "var(--radius-sm)" }}
          aria-label="Remove attachment"
        >
          ✕
        </button>
      </div>
    );
  }

  // Uploading in progress
  if (progress !== null) {
    return (
      <div style={{ padding: "var(--space-4)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
          Uploading… {progress}%
        </div>
        <div style={{ height: 4, background: "var(--border-subtle)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "var(--brand-primary)", transition: "width 0.1s", borderRadius: 2 }} />
        </div>
        <button
          type="button"
          onClick={handleRemove}
          style={{ marginTop: "var(--space-2)", background: "none", border: "none", fontSize: "var(--text-xs)", color: "var(--text-muted)", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  // Drop zone / file picker
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      style={{
        padding:      "var(--space-5)",
        background:   dragging ? "rgba(59,130,246,0.06)" : "var(--bg-elevated)",
        border:       `2px dashed ${dragging ? "var(--brand-primary)" : "var(--border-default)"}`,
        borderRadius: "var(--radius-md)",
        textAlign:    "center",
        cursor:       "pointer",
        transition:   "all 0.15s",
      }}
      role="button"
      tabIndex={0}
      aria-label="Click or drag a file to attach"
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
    >
      <div style={{ fontSize: 24, marginBottom: "var(--space-2)" }}>📎</div>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: dragging ? "var(--brand-primary)" : "var(--text-secondary)" }}>
        {dragging ? "Drop file here" : "Click or drag to attach a file"}
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
        PDF, Word, Excel, or image · Max 10 MB
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={NOTIFICATION_ALLOWED_EXTENSIONS}
        onChange={handleFileInput}
        style={{ display: "none" }}
        aria-hidden="true"
      />
    </div>
  );
}

// ── Sent history sub-components ───────────────────────────────────────────

function SentCard({ b, onClick }: { b: Broadcast; onClick: (b: Broadcast) => void }) {
  const color = TYPE_COLORS[b.notification_type] ?? "var(--brand-primary)";
  return (
    <div
      className="card card--clickable page-enter"
      onClick={() => onClick(b)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(b)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {NOTIFICATION_TYPE_LABELS[b.notification_type] ?? b.notification_type}
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>·</span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{b.audience_label}</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", marginBottom: "var(--space-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {b.subject}
          </div>
          {b.message && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {b.message.replace(/[#*_`[\]()>]/g, "").slice(0, 120)}
            </div>
          )}
          {b.attachment_name && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", marginTop: "var(--space-2)" }}>
              <span style={{ fontSize: 12 }}>{getFileIcon(b.attachment_name)}</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--brand-primary)" }}>{b.attachment_name}</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{relativeDate(b.sent_at)}</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
            {b.recipient_count} recipient{b.recipient_count !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

function BroadcastDetailModal({ broadcast_id, onClose }: { broadcast_id: number; onClose: () => void }) {
  const [detail, setDetail] = useState<BroadcastDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBroadcastDetail(broadcast_id).then(setDetail).finally(() => setLoading(false));
  }, [broadcast_id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9998, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "var(--space-16)", overflowY: "auto" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", width: "min(560px, calc(100vw - 2rem))", maxHeight: "80vh", overflow: "auto", padding: "var(--space-6)", animation: "fadeInUp 0.15s ease both" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--text-primary)" }}>
            Broadcast Detail
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}>✕</button>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 20, borderRadius: 4 }} />)}
          </div>
        ) : !detail ? (
          <p style={{ color: "var(--text-muted)" }}>Could not load details.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div><div className="card__label">Subject</div><div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{detail.subject}</div></div>
            {detail.message && <div><div className="card__label">Message</div><div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{detail.message}</div></div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <div><div className="card__label">Audience</div><div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{detail.audience_label}</div></div>
              <div><div className="card__label">Sent</div><div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{new Date(detail.sent_at).toLocaleString("en-IN")}</div></div>
            </div>
            {detail.attachment_name && (
              <div>
                <div className="card__label">Attachment</div>
                <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                  <a href={detail.attachment_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "var(--text-sm)", color: "var(--brand-primary)", display: "flex", alignItems: "center", gap: 4 }}>
                    {getFileIcon(detail.attachment_name)} {detail.attachment_name}
                  </a>
                  <a href={detail.attachment_url} download={detail.attachment_name} style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    (download)
                  </a>
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)", padding: "var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              {[
                { label: "Sent to", value: detail.recipient_count, color: "var(--text-primary)" },
                { label: "Read",    value: detail.read_count,      color: "var(--success)"      },
                { label: "Unread",  value: detail.unread_count,    color: "var(--warning)"      },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color }}>{value}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{label}</div>
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
}

// ── Main page ───────────────────────────────────────────────────────────────

type Tab = "send" | "history";

export default function NotificationsPage() {
  const { user } = useAuth();
  const isSender = !!user?.role && ["TEACHER", "PRINCIPAL", "OFFICIAL", "ADMIN"].includes(user.role);

  const [activeTab, setActiveTab] = useState<Tab>(isSender ? "send" : "history");

  // Send form
  const [options, setOptions]         = useState<AudienceOptions | null>(null);
  const [form, setForm]               = useState<Partial<SendPayload>>({ notification_type: "announcement" });
  const [attachment, setAttachment]   = useState<{ url: string; name: string } | null>(null);
  const [uploadError, setUploadError] = useState<string>("");
  const [sending, setSending]         = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError]     = useState<string | null>(null);

  // History
  const [history, setHistory]         = useState<Broadcast[]>([]);
  const [histTotal, setHistTotal]     = useState(0);
  const [histPage, setHistPage]       = useState(1);
  const [histPages, setHistPages]     = useState(1);
  const [histLoading, setHistLoading] = useState(false);
  const [filters, setFilters]         = useState({ q: "", type: "", from: "", to: "" });
  const [detailId, setDetailId]       = useState<number | null>(null);

  useEffect(() => {
    if (isSender) getAudienceOptions().then(setOptions).catch(() => {});
  }, [isSender]);

  const loadHistory = useCallback(() => {
    if (!isSender) return;
    setHistLoading(true);
    getSentHistory({
      q:    filters.q    || undefined,
      type: (filters.type as NotificationType) || undefined,
      from: filters.from || undefined,
      to:   filters.to   || undefined,
      page: histPage,
    })
      .then((d) => {
        if (!d) return;
        setHistory(d.results);
        setHistTotal(d.count);
        setHistPages(d.total_pages);
      })
      .finally(() => setHistLoading(false));
  }, [isSender, filters, histPage]);

  useEffect(() => {
    if (activeTab === "history") loadHistory();
  }, [activeTab, loadHistory]);

  const handleSend = async () => {
    if (!form.subject?.trim())    { setSendError("Subject is required"); return; }
    if (!form.audience_type)      { setSendError("Please select an audience"); return; }
    if (needsClass(form.audience_type) && !form.class_id) {
      setSendError("Please select a class"); return;
    }
    if (user && needsInstitution(form.audience_type, user.role) && !form.institution_id) {
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
        setSendSuccess(
          `Sent to ${result.recipient_count} recipient${result.recipient_count !== 1 ? "s" : ""} — ${result.audience_label}`
        );
        setForm({ notification_type: "announcement" });
        setAttachment(null);
      }
    } catch {
      setSendError("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-shell">
      <TopBar title="Notifications" />
      <main className="page-content page-enter">

        {/* Tab toggle */}
        {isSender && (
          <div style={{ display: "flex", marginBottom: "var(--space-6)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
            {(["send", "history"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex:       1,
                  padding:    "var(--space-3)",
                  background: activeTab === tab ? "var(--brand-primary)" : "var(--bg-elevated)",
                  border:     "none",
                  color:      activeTab === tab ? "#fff" : "var(--text-muted)",
                  fontSize:   "var(--text-sm)",
                  fontWeight: activeTab === tab ? 700 : 400,
                  cursor:     "pointer",
                  transition: "all var(--transition-fast)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {tab === "send" ? "📤 Send Message" : "📋 Sent History"}
              </button>
            ))}
          </div>
        )}

        {/* ── SEND FORM ─────────────────────────────────────────────────── */}
        {activeTab === "send" && isSender && (
          <div style={{ maxWidth: 640 }}>
            {sendSuccess && (
              <div className="alert alert--success" style={{ marginBottom: "var(--space-5)" }}>✓ {sendSuccess}</div>
            )}
            {sendError && (
              <div className="alert alert--error" style={{ marginBottom: "var(--space-5)" }}>{sendError}</div>
            )}

            <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>

              {/* Subject */}
              <div>
                <label className="form-label">Subject <span style={{ color: "var(--error)" }}>*</span></label>
                <input className="form-input" type="text" placeholder="e.g. Class test on Friday" value={form.subject ?? ""} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} maxLength={255} />
              </div>

              {/* Message with Markdown hint */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-2)" }}>
                  <label className="form-label" style={{ margin: 0 }}>Message</label>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    Markdown supported: **bold**, _italic_, - lists
                  </span>
                </div>
                <textarea
                  className="form-input"
                  rows={5}
                  placeholder={"Write your message here…\n\nYou can use **bold**, _italic_, and - lists.\nRecipients will see it formatted."}
                  value={form.message ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  style={{ resize: "vertical", fontFamily: "monospace", fontSize: "var(--text-sm)" }}
                />
              </div>

              {/* Type + Audience */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <div>
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.notification_type ?? "announcement"} onChange={(e) => setForm((f) => ({ ...f, notification_type: e.target.value as NotificationType }))}>
                    {Object.entries(NOTIFICATION_TYPE_LABELS).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Send to <span style={{ color: "var(--error)" }}>*</span></label>
                  <select className="form-input" value={form.audience_type ?? ""} onChange={(e) => setForm((f) => ({ ...f, audience_type: e.target.value as AudienceType, class_id: undefined, institution_id: undefined }))}>
                    <option value="">— Select audience —</option>
                    {options?.allowed_audience_types.map((a) => (<option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>))}
                  </select>
                </div>
              </div>

              {/* Class selector */}
              {form.audience_type && needsClass(form.audience_type) && options && options.classrooms.length > 0 && (
                <div>
                  <label className="form-label">Select Class <span style={{ color: "var(--error)" }}>*</span></label>
                  <select className="form-input" value={form.class_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, class_id: Number(e.target.value) || undefined }))}>
                    <option value="">— Select class —</option>
                    {options.classrooms.map((c) => (<option key={c.id} value={c.id}>Class {c.name} · {c["institution__name"]}</option>))}
                  </select>
                </div>
              )}

              {/* Institution selector */}
              {form.audience_type && user && needsInstitution(form.audience_type, user.role) && options && options.institutions.length > 0 && (
                <div>
                  <label className="form-label">Select School <span style={{ color: "var(--error)" }}>*</span></label>
                  <select className="form-input" value={form.institution_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, institution_id: Number(e.target.value) || undefined }))}>
                    <option value="">— Select school —</option>
                    {options.institutions.map((i) => (<option key={i.id} value={i.id}>{i.name}</option>))}
                  </select>
                </div>
              )}

              {/* Link */}
              <div>
                <label className="form-label">Link (optional)</label>
                <input className="form-input" type="text" placeholder="Internal: /assessments/12  or  External: https://example.com" value={form.link ?? ""} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                  Must start with / (internal) or https:// (external)
                </div>
              </div>

              {/* File attachment — drag-and-drop uploader */}
              <div>
                <label className="form-label">Attachment (optional)</label>
                {uploadError && (
                  <div className="alert alert--error" style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-xs)" }}>
                    {uploadError}
                  </div>
                )}
                <FileUploader
                  value={attachment}
                  onChange={setAttachment}
                  onError={setUploadError}
                />
              </div>

              <button className="btn btn--primary" onClick={handleSend} disabled={sending} style={{ alignSelf: "flex-start" }}>
                {sending ? "Sending…" : "Send Message"}
              </button>
            </div>
          </div>
        )}

        {/* ── SENT HISTORY ──────────────────────────────────────────────── */}
        {activeTab === "history" && isSender && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
              <input className="form-input" type="text" placeholder="Search subject or message…" value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setHistPage(1); }} />
              <select className="form-input" value={filters.type} onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setHistPage(1); }}>
                <option value="">All types</option>
                {Object.entries(NOTIFICATION_TYPE_LABELS).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
              </select>
              <input className="form-input" type="date" title="From date" value={filters.from} onChange={(e) => { setFilters((f) => ({ ...f, from: e.target.value })); setHistPage(1); }} />
              <input className="form-input" type="date" title="To date"   value={filters.to}   onChange={(e) => { setFilters((f) => ({ ...f, to:   e.target.value })); setHistPage(1); }} />
            </div>

            {histLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 90, borderRadius: "var(--radius-lg)" }} />)}
              </div>
            ) : history.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">📭</div>
                <h3 className="empty-state__title">No messages sent yet</h3>
                <p className="empty-state__message">Messages you send will appear here.</p>
              </div>
            ) : (
              <>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
                  {histTotal} message{histTotal !== 1 ? "s" : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {history.map((b) => (
                    <SentCard key={b.id} b={b} onClick={(x) => setDetailId(x.id)} />
                  ))}
                </div>
                {histPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)", marginTop: "var(--space-8)" }}>
                    <button className="btn btn--secondary" disabled={histPage <= 1} onClick={() => setHistPage((p) => p - 1)}>← Previous</button>
                    <span style={{ alignSelf: "center", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{histPage} / {histPages}</span>
                    <button className="btn btn--secondary" disabled={histPage >= histPages} onClick={() => setHistPage((p) => p + 1)}>Next →</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

      </main>

      {detailId !== null && (
        <BroadcastDetailModal broadcast_id={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}