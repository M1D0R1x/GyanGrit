import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../services/api";

// ── Types ──────────────────────────────────────────────────────────────────

type JoinCode = {
  id: number;
  code: string;
  role: string;
  institution: string | null;
  section: string | null;
  district: string | null;
  subject: string | null;
  is_used: boolean;
  is_valid: boolean;
  expires_at: string;
  created_at: string;
  created_by: string | null;
};

type SubjectItem     = { id: number; name: string };
type InstitutionItem = { id: number; name: string; district__name: string };
type DistrictItem    = { id: number; name: string };
type SectionItem     = {
  id: number; name: string; classroom_id: number;
  grade: string; institution_id: number; institution_name: string;
  label: string; short_label: string;
};

type RoleType    = "STUDENT" | "TEACHER" | "PRINCIPAL" | "OFFICIAL";
type ValidFilter = "ALL" | "VALID" | "USED";
type FormMode    = "single" | "bulk";

const ROLES: RoleType[]            = ["STUDENT", "TEACHER", "PRINCIPAL", "OFFICIAL"];
const ROLE_FILTERS: string[]       = ["ALL", "STUDENT", "TEACHER", "PRINCIPAL", "OFFICIAL"];
const VALID_FILTERS: ValidFilter[] = ["ALL", "VALID", "USED"];

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?? "http://127.0.0.1:8000/api/v1";

// ── Helpers ────────────────────────────────────────────────────────────────

function parseApiError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const jsonStart = err.message.indexOf("{");
  if (jsonStart !== -1) {
    try {
      const p = JSON.parse(err.message.slice(jsonStart));
      if (p.error) return String(p.error);
    } catch { /* fall through */ }
  }
  return fallback;
}

function roleColor(role: string): string {
  const map: Record<string, string> = {
    STUDENT:   "badge--info",
    TEACHER:   "badge--success",
    PRINCIPAL: "badge--warning",
    OFFICIAL:  "badge--purple",
    ADMIN:     "badge--error",
  };
  return map[role] ?? "badge--info";
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "2px 12px", borderRadius: "var(--radius-full)",
      border: "1px solid var(--border-medium)",
      background: active ? "var(--saffron-glow)" : "transparent",
      color: active ? "var(--saffron)" : "var(--ink-muted)",
      fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer",
      transition: "all var(--transition-fast)",
    }}>
      {label}
    </button>
  );
}

// ── Email modal ────────────────────────────────────────────────────────────

function EmailModal({ code, onClose, onSent }: { code: JoinCode; onClose: () => void; onSent: (msg: string) => void }) {
  const [email, setEmail]     = useState("");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr]         = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSend = async () => {
    if (!email.trim()) { setErr("Email address is required."); return; }
    setSending(true); setErr(null);
    try {
      const res = await apiPost<{ sent: boolean; dev_mode?: boolean; to?: string; preview?: { body: string } }>(
        `/accounts/join-codes/${code.id}/email/`, { email: email.trim() }
      );
      if (res.dev_mode && res.preview) { setPreview(res.preview.body); }
      else { onSent(`Email sent to ${res.to}`); onClose(); }
    } catch (e) { setErr(parseApiError(e, "Failed to send email.")); }
    finally { setSending(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-4)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", animation: "fadeInUp 0.2s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border-light)" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--ink-primary)" }}>Email Join Code</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>
              <span style={{ fontFamily: "monospace", color: "var(--saffron)" }}>{code.code.slice(0, 8)}…</span>
              {" · "}{code.role}{code.institution ? ` · ${code.institution}` : ""}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", fontSize: 20, lineHeight: 1, padding: "4px 6px" }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          {preview ? (
            <>
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: 12, fontFamily: "monospace", fontSize: 12, color: "var(--ink-secondary)", whiteSpace: "pre-wrap", maxHeight: 280, overflowY: "auto", marginBottom: 16 }}>{preview}</div>
              <div className="alert alert--info" style={{ marginBottom: 12 }}><strong>Dev mode:</strong> Email not sent. Configure Django email settings for production.</div>
              <button className="btn btn--secondary" onClick={onClose} style={{ width: "100%" }}>Close</button>
            </>
          ) : (
            <>
              {err && <div className="alert alert--error" style={{ marginBottom: 12 }}>{err}</div>}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Recipient email *</label>
                <input ref={inputRef} className="form-input" type="email" placeholder="recipient@school.edu" value={email}
                  onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }} disabled={sending} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn--primary" onClick={handleSend} disabled={sending} style={{ flex: 1 }}>
                  {sending ? <><span className="btn__spinner" aria-hidden="true" /> Sending…</> : <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Send Email
                  </>}
                </button>
                <button className="btn btn--secondary" onClick={onClose} disabled={sending}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bulk result preview ────────────────────────────────────────────────────

function BulkResultPanel({ codes, onDownload, onDismiss }: { codes: JoinCode[]; onDownload: () => void; onDismiss: () => void }) {
  return (
    <div className="card" style={{ marginBottom: "var(--space-6)", border: "1px solid var(--success-glow, #10b98133)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--ink-primary)" }}>
            ✓ {codes.length} codes generated
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>
            {codes[0]?.role} · {codes[0]?.institution ?? codes[0]?.district ?? "—"}
            {codes[0]?.section ? ` · ${codes[0].section}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className="btn btn--primary" onClick={onDownload}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Excel
          </button>
          <button className="btn btn--ghost" onClick={onDismiss} style={{ fontSize: "var(--text-xs)" }}>Dismiss</button>
        </div>
      </div>

      <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
        <table className="data-table" style={{ fontSize: "var(--text-xs)" }}>
          <thead>
            <tr><th>#</th><th>Code</th><th>Role</th><th>For</th><th>Expires</th></tr>
          </thead>
          <tbody>
            {codes.map((c, i) => (
              <tr key={c.id}>
                <td style={{ color: "var(--ink-muted)" }}>{i + 1}</td>
                <td>
                  <code style={{ fontFamily: "monospace", background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: 3, color: "var(--saffron)", letterSpacing: "0.05em" }}>
                    {c.code}
                  </code>
                </td>
                <td><span className={`badge ${roleColor(c.role)}`}>{c.role}</span></td>
                <td style={{ color: "var(--ink-secondary)" }}>
                  {c.institution ?? c.district ?? "—"}{c.section ? ` · ${c.section}` : ""}
                </td>
                <td style={{ color: "var(--ink-muted)" }}>
                  {new Date(c.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function AdminJoinCodesPage() {
  const [codes, setCodes]             = useState<JoinCode[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);
  const [showForm, setShowForm]       = useState(false);
  const [formMode, setFormMode]       = useState<FormMode>("single");
  const [creating, setCreating]       = useState(false);
  const [filterRole, setFilterRole]   = useState("ALL");
  const [filterValid, setFilterValid] = useState<ValidFilter>("ALL");
  const [emailCode, setEmailCode]     = useState<JoinCode | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [bulkResult, setBulkResult]   = useState<JoinCode[] | null>(null);

  // Form state (shared between single and bulk)
  const [role, setRole]               = useState<RoleType>("STUDENT");
  const [institutionId, setInstitutionId] = useState("");
  const [sectionId, setSectionId]     = useState("");
  const [subjectId, setSubjectId]     = useState("");
  const [districtId, setDistrictId]   = useState("");
  const [expiresDays, setExpiresDays] = useState(3);
  const [bulkCount, setBulkCount]     = useState(10);

  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [sections, setSections]         = useState<SectionItem[]>([]);
  const [subjects, setSubjects]         = useState<SubjectItem[]>([]);
  const [districts, setDistricts]       = useState<DistrictItem[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<JoinCode[]>("/accounts/join-codes/"),
      apiGet<InstitutionItem[]>("/accounts/institutions/"),
      apiGet<SubjectItem[]>("/accounts/subjects/"),
      apiGet<DistrictItem[]>("/academics/districts/"),
    ])
      .then(([codesData, instData, subData, distData]) => {
        setCodes(codesData);
        setInstitutions(instData);
        setSubjects(subData);
        setDistricts(distData);
      })
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!institutionId) { setSections([]); setSectionId(""); return; }
    setSectionsLoading(true);
    apiGet<SectionItem[]>(`/academics/sections/?classroom__institution_id=${institutionId}`)
      .then((data) => {
        const sorted = [...data].sort((a, b) => {
          const diff = (parseInt(a.grade, 10) || 0) - (parseInt(b.grade, 10) || 0);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        });
        setSections(sorted);
      })
      .catch(() => setSections([]))
      .finally(() => setSectionsLoading(false));
  }, [institutionId]);

  useEffect(() => { setSectionId(""); }, [institutionId]);

  const resetForm = () => {
    setRole("STUDENT"); setInstitutionId(""); setSectionId("");
    setSubjectId(""); setDistrictId(""); setExpiresDays(3); setBulkCount(10);
  };

  const needsInstitution = role === "STUDENT" || role === "TEACHER" || role === "PRINCIPAL";
  const needsSection     = role === "STUDENT";
  const needsSubject     = role === "TEACHER";
  const needsDistrict    = role === "OFFICIAL";

  const buildPayload = () => {
    const p: Record<string, unknown> = { role, expires_days: expiresDays };
    if (institutionId) p.institution_id = Number(institutionId);
    if (sectionId)     p.section_id     = Number(sectionId);
    if (subjectId)     p.subject_id     = Number(subjectId);
    if (districtId)    p.district_id    = Number(districtId);
    return p;
  };

  const handleCreateSingle = async () => {
    setCreating(true); setError(null); setSuccess(null);
    try {
      const created = await apiPost<JoinCode>("/accounts/join-codes/create/", buildPayload());
      setCodes((prev) => [created, ...prev]);
      setSuccess(`Code created: ${created.code}`);
      setShowForm(false); resetForm();
    } catch (err) { setError(parseApiError(err, "Failed to create join code.")); }
    finally { setCreating(false); }
  };

  const handleCreateBulk = async () => {
    if (bulkCount < 1 || bulkCount > 100) {
      setError("Count must be between 1 and 100.");
      return;
    }
    setCreating(true); setError(null); setSuccess(null);
    try {
      const res = await apiPost<{ created: number; codes: JoinCode[] }>(
        "/accounts/join-codes/bulk/",
        { ...buildPayload(), count: bulkCount }
      );
      setCodes((prev) => [...res.codes, ...prev]);
      setBulkResult(res.codes);
      setShowForm(false); resetForm();
      setSuccess(`${res.created} codes generated.`);
    } catch (err) { setError(parseApiError(err, "Failed to create codes.")); }
    finally { setCreating(false); }
  };

  const handleRevoke = async (codeId: number, codeStr: string) => {
    if (!confirm(`Revoke code ${codeStr.slice(0, 8)}...?`)) return;
    try {
      await apiPost(`/accounts/join-codes/${codeId}/revoke/`, {});
      setCodes((prev) => prev.map((c) => c.id === codeId ? { ...c, is_used: true, is_valid: false } : c));
      setSuccess("Code revoked.");
    } catch { setError("Failed to revoke."); }
  };

  const downloadBlob = async (url: string, filename: string) => {
    setDownloading(true);
    try {
      const csrf = document.cookie.split("; ").find((c) => c.startsWith("gyangrit_csrftoken="))?.split("=")[1] ?? "";
      const res  = await fetch(url, { credentials: "include", headers: { "X-CSRFToken": csrf } });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a    = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      setSuccess("Excel downloaded.");
    } catch { setError("Download failed."); }
    finally { setDownloading(false); }
  };

  const handleDownloadAll = () =>
    downloadBlob(`${API_BASE}/accounts/join-codes/export/`, `gyangrit_join_codes_${new Date().toISOString().slice(0, 10)}.xlsx`);

  // Download just the bulk-generated batch by filtering to those IDs
  const handleDownloadBatch = async () => {
    if (!bulkResult) return;
    // Use the same export endpoint — it exports visible codes.
    // For now just download all; the batch codes will be at the top sorted by date.
    handleDownloadAll();
  };

  const filtered = codes.filter((c) => {
    if (filterRole !== "ALL" && c.role !== filterRole) return false;
    if (filterValid === "VALID" && !c.is_valid) return false;
    if (filterValid === "USED"  && c.is_valid)  return false;
    return true;
  });

  // ── Shared form fields ─────────────────────────────────────────────────

  const FormFields = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
      <div className="form-group">
        <label className="form-label">Role *</label>
        <select className="form-input" value={role}
          onChange={(e) => { setRole(e.target.value as RoleType); setInstitutionId(""); setSectionId(""); setSubjectId(""); setDistrictId(""); }}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {needsInstitution && (
        <div className="form-group">
          <label className="form-label">Institution *</label>
          <select className="form-input" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
            <option value="">— select institution —</option>
            {institutions.map((inst) => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
          </select>
        </div>
      )}

      {needsSection && institutionId && (
        <div className="form-group">
          <label className="form-label">Section {formMode === "bulk" && <span style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>(one code per student)</span>}</label>
          {sectionsLoading ? (
            <div className="skeleton" style={{ height: 42, borderRadius: "var(--radius-md)" }} />
          ) : sections.length > 0 ? (
            <select className="form-input" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">— all sections —</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.short_label}</option>)}
            </select>
          ) : (
            <input className="form-input" value="No sections found" disabled style={{ opacity: 0.5 }} />
          )}
        </div>
      )}

      {needsSubject && (
        <div className="form-group">
          <label className="form-label">Subject *</label>
          <select className="form-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">— select subject —</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {needsDistrict && (
        <div className="form-group">
          <label className="form-label">District *</label>
          <select className="form-input" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            <option value="">— select district —</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}

      {formMode === "bulk" && (
        <div className="form-group">
          <label className="form-label">Number of codes * (max 100)</label>
          <input className="form-input" type="number" min={1} max={100} value={bulkCount}
            onChange={(e) => setBulkCount(Number(e.target.value))} />
          <span className="form-hint">Each code can only be used once by one person.</span>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Expires in (days, max 30)</label>
        <input className="form-input" type="number" min={1} max={30} value={expiresDays}
          onChange={(e) => setExpiresDays(Number(e.target.value))} />
      </div>
    </div>
  );

  return (
    <>

        {/* Header */}
        <div className="section-header">
          <div>
            <h2 className="section-header__title">Join Code Manager</h2>
            <p className="section-header__subtitle">Generate and manage registration codes for new users</p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button className="btn btn--secondary" onClick={handleDownloadAll} disabled={downloading} title="Download all codes as Excel">
              {downloading ? <><span className="btn__spinner" aria-hidden="true" /> Exporting…</> : <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export All
              </>}
            </button>
            <button className="btn btn--primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Code
              </>}
            </button>
          </div>
        </div>

        {error   && <div className="alert alert--error"   style={{ marginBottom: "var(--space-4)" }}>{error}</div>}
        {success && <div className="alert alert--success" style={{ marginBottom: "var(--space-4)" }}>{success}</div>}

        {/* Bulk result */}
        {bulkResult && (
          <BulkResultPanel
            codes={bulkResult}
            onDownload={handleDownloadBatch}
            onDismiss={() => setBulkResult(null)}
          />
        )}

        {/* Create form */}
        {showForm && (
          <div className="card" style={{ marginBottom: "var(--space-6)" }}>
            {/* Mode tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: "var(--space-5)", borderBottom: "1px solid var(--border-light)" }}>
              {(["single", "bulk"] as FormMode[]).map((m) => (
                <button key={m} onClick={() => setFormMode(m)} style={{
                  padding: "var(--space-2) var(--space-5)",
                  background: "none", border: "none",
                  borderBottom: formMode === m ? "2px solid var(--saffron)" : "2px solid transparent",
                  color: formMode === m ? "var(--saffron)" : "var(--ink-muted)",
                  fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600,
                  cursor: "pointer", transition: "all 0.15s", marginBottom: -1,
                }}>
                  {m === "single" ? "Single Code" : "Bulk Generate"}
                </button>
              ))}
            </div>

            {formMode === "bulk" && (
              <div className="alert alert--info" style={{ marginBottom: "var(--space-4)", display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                <span style={{ fontWeight: 700, flexShrink: 0, color: "var(--info)" }}>Bulk mode:</span>
                <span>Generates N identical codes for the same role/section. Each code is single-use — distribute one per student. After generation, download the Excel sheet to share codes.</span>
              </div>
            )}

            <FormFields />

            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <button className="btn btn--primary" disabled={creating}
                onClick={formMode === "single" ? handleCreateSingle : handleCreateBulk}>
                {creating ? <><span className="btn__spinner" aria-hidden="true" /> Creating…</> :
                  formMode === "single" ? "Create Code" : `Generate ${bulkCount} Codes`}
              </button>
              <button className="btn btn--secondary" disabled={creating}
                onClick={() => { setShowForm(false); resetForm(); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-5)", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Role:</span>
          {ROLE_FILTERS.map((r) => <FilterPill key={r} label={r} active={filterRole === r} onClick={() => setFilterRole(r)} />)}
          <div style={{ width: 1, height: 16, background: "var(--border-light)" }} />
          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Status:</span>
          {VALID_FILTERS.map((f) => <FilterPill key={f} label={f} active={filterValid === f} onClick={() => setFilterValid(f)} />)}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: "var(--radius-md)" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🔑</div>
            <h3 className="empty-state__title">No join codes</h3>
            <p className="empty-state__message">Create a code to invite new users.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr><th>Code</th><th>Role</th><th>For</th><th>Status</th><th>Expires</th><th>Created by</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map((code) => (
                  <tr key={code.id}>
                    <td>
                      <code style={{ fontFamily: "monospace", fontSize: "var(--text-xs)", background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "var(--radius-sm)", letterSpacing: "0.05em", color: "var(--ink-primary)" }}>
                        {code.code.slice(0, 8)}…
                      </code>
                    </td>
                    <td><span className={`badge ${roleColor(code.role)}`}>{code.role}</span></td>
                    <td style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)" }}>
                      {code.institution ?? code.district ?? "—"}
                      {code.subject ? ` · ${code.subject}` : ""}
                      {code.section ? ` · ${code.section}` : ""}
                    </td>
                    <td><span className={`badge ${code.is_valid ? "badge--success" : "badge--error"}`}>{code.is_valid ? "Active" : "Used"}</span></td>
                    <td style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                      {new Date(code.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{code.created_by ?? "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {code.is_valid && (
                          <>
                            <button className="btn btn--ghost" style={{ padding: "2px 8px", fontSize: "var(--text-xs)", color: "var(--saffron)" }}
                              onClick={() => setEmailCode(code)} title="Send by email">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                            </button>
                            <button className="btn btn--ghost" style={{ padding: "2px 8px", fontSize: "var(--text-xs)", color: "var(--error)" }}
                              onClick={() => handleRevoke(code.id, code.code)}>
                              Revoke
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {emailCode && (
        <EmailModal code={emailCode} onClose={() => setEmailCode(null)}
          onSent={(msg) => { setSuccess(msg); setEmailCode(null); }} />
      )}
    </>
  );
}