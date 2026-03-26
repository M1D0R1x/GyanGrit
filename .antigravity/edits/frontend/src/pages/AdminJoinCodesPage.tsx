import React, { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../services/api";
import TopBar from "../components/TopBar";
import { 
  Plus, 
  Key, 
  Mail, 
  Download, 
  Trash2, 
  ChevronRight, 
  ShieldCheck, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import './AdminJoinCodesPage.css';

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

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:8000/api/v1";

const EmailModal: React.FC<{ code: JoinCode; onClose: () => void; onSent: (msg: string) => void }> = ({ code, onClose, onSent }) => {
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
      else { onSent(`Email protocol dispatched to ${res.to}`); onClose(); }
    } catch (e) {
      setErr("Protocol Error: Dispatch failure.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="obsidian-modal-overlay animate-fade-in" onClick={onClose}>
      <div className="glass-card obsidian-modal animate-scale-up" onClick={e => e.stopPropagation()}>
        <div className="modal-header-nexus">
           <div className="inst-label">DISPATCH PROTOCOL</div>
           <h2 className="modal-title">EMAIL JOIN CODE</h2>
           <p className="hero-subtitle">Code: {code.code.slice(0, 8)}... for {code.role}</p>
        </div>

        {preview ? (
          <div className="preview-mode">
             <div className="glass-card" style={{ background: 'var(--bg-elevated)', padding: '12px', fontSize: '12px', fontFamily: 'monospace', marginBottom: '16px' }}>{preview}</div>
             <div className="alert alert--info" style={{ marginBottom: '16px' }}>DEV MODE: Dispatch intercepted.</div>
             <button className="btn--secondary full" onClick={onClose}>CLOSE</button>
          </div>
        ) : (
          <div className="dispatch-form">
             {err && <div className="alert alert--error" style={{ marginBottom: '16px' }}>{err}</div>}
             <div className="obsidian-form-group">
                <label className="obsidian-label">RECIPIENT EMAIL *</label>
                <input ref={inputRef} className="obsidian-input" type="email" placeholder="recipient@nodal.net" value={email} onChange={e => setEmail(e.target.value)} />
             </div>
             <div className="mgmt-actions" style={{ gap: '12px', marginTop: 'var(--space-8)' }}>
                <button className="btn--primary" style={{ flex: 1 }} onClick={handleSend} disabled={sending}>
                   {sending ? "DISPATCHING..." : "SEND PROTOCOL"}
                </button>
                <button className="btn--secondary" onClick={onClose} disabled={sending}>CANCEL</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminJoinCodesPage: React.FC = () => {
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
    let cancelled = false;
    async function loadData() {
      try {
        const [c, inst, sub, dist] = await Promise.all([
          apiGet<JoinCode[]>("/accounts/join-codes/"),
          apiGet<InstitutionItem[]>("/accounts/institutions/"),
          apiGet<SubjectItem[]>("/accounts/subjects/"),
          apiGet<DistrictItem[]>("/academics/districts/"),
        ]);
        if (!cancelled) {
          setCodes(c ?? []);
          setInstitutions(inst ?? []);
          setSubjects(sub ?? []);
          setDistricts(dist ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("TELEMETRY ERROR: Join code database unreachable.");
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!institutionId) { setSections([]); setSectionId(""); return; }
    let cancelled = false;
    async function loadSections() {
      setSectionsLoading(true);
      try {
        const data = await apiGet<SectionItem[]>(`/academics/sections/?classroom__institution_id=${institutionId}`);
        if (!cancelled) {
          setSections(data ?? []);
          setSectionsLoading(false);
        }
      } catch { 
        if (!cancelled) setSectionsLoading(false); 
      }
    }
    loadSections();
    return () => { cancelled = true; };
  }, [institutionId]);

  const needsInstitution = role === "STUDENT" || role === "TEACHER" || role === "PRINCIPAL";
  const needsSection     = role === "STUDENT";
  const needsSubject     = role === "TEACHER";
  const needsDistrict    = role === "OFFICIAL";

  const handleCreateSingle = async () => {
    setCreating(true); setError(null); setSuccess(null);
    try {
      const payload: any = { role, expires_days: expiresDays };
      if (institutionId) payload.institution_id = Number(institutionId);
      if (sectionId) payload.section_id = Number(sectionId);
      if (subjectId) payload.subject_id = Number(subjectId);
      if (districtId) payload.district_id = Number(districtId);

      const created = await apiPost<JoinCode>("/accounts/join-codes/create/", payload);
      setCodes(prev => [created, ...prev]);
      setSuccess(`PROTOCOL SUCCESS: Code instantiated ${created.code}`);
      setShowForm(false);
    } catch {
      setError("Instantiate Error: Protocol failure.");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateBulk = async () => {
    setCreating(true); setError(null); setSuccess(null);
    try {
      const payload: any = { role, expires_days: expiresDays, count: bulkCount };
      if (institutionId) payload.institution_id = Number(institutionId);
      if (sectionId) payload.section_id = Number(sectionId);
      if (subjectId) payload.subject_id = Number(subjectId);
      if (districtId) payload.district_id = Number(districtId);

      const res = await apiPost<{ created: number; codes: JoinCode[] }>("/accounts/join-codes/bulk/", payload);
      setCodes(prev => [...res.codes, ...prev]);
      setBulkResult(res.codes);
      setSuccess(`ARCHIVE SUCCESS: ${res.created} codes instantiated.`);
      setShowForm(false);
    } catch {
      setError("Batch Error: Protocol failure.");
    } finally {
      setCreating(false);
    }
  };

  const filtered = codes.filter((c) => {
    if (filterRole !== "ALL" && c.role !== filterRole) return false;
    if (filterValid === "VALID" && !c.is_valid) return false;
    if (filterValid === "USED"  && c.is_valid)  return false;
    return true;
  });

  if (loading) {
     return (
       <div className="page-shell">
         <TopBar title="Onboarding Terminal" />
         <main className="page-content">
           <div className="skeleton-box" style={{ height: '400px' }} />
         </main>
       </div>
     );
  }

  return (
    <div className="page-shell">
      <TopBar title="Join Code Manager" />
      <main className="page-content page-enter joincodes-layout">

        {/* Header Nexus */}
        <section className="joincodes-header animate-fade-up">
           <div className="inst-info">
              <span className="inst-label">SECURITY PROTOCOLS</span>
              <h1 className="inst-name">ONBOARDING HUB</h1>
              <p className="hero-subtitle">Unified join code management for all GYANGRIT nodes.</p>
           </div>
           <div className="joincodes-actions">
              <button className="btn--secondary sm" onClick={() => {}}>
                 <Download size={14} /> EXPORT AGGREGATE
              </button>
              <button className="btn--primary sm" onClick={() => setShowForm(!showForm)}>
                 {showForm ? "CANCEL ARCHITECT" : <><Plus size={14} /> NEW CODE</>}
              </button>
           </div>
        </section>

        {error && <div className="alert alert--error animate-fade-up">{error}</div>}
        {success && <div className="alert alert--success animate-fade-up">{success}</div>}

        {/* Form Architect */}
        {showForm && (
          <section className="glass-card animate-fade-up" style={{ padding: 'var(--space-8) !important', marginBottom: 'var(--space-10)' }}>
             <div className="form-tabs">
                <button className={`form-tab ${formMode === 'single' ? 'active' : ''}`} onClick={() => setFormMode('single')}>SINGLE INSTANCE</button>
                <button className={`form-tab ${formMode === 'bulk' ? 'active' : ''}`} onClick={() => setFormMode('bulk')}>BATCH GENERATION</button>
             </div>

             <div className="joincode-form-grid">
                <div className="obsidian-form-group">
                   <label className="obsidian-label">ROLE SPEC *</label>
                   <select className="obsidian-select" value={role} onChange={e => setRole(e.target.value as any)}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                   </select>
                </div>

                {needsInstitution && (
                  <div className="obsidian-form-group">
                     <label className="obsidian-label">INSTITUTION *</label>
                     <select className="obsidian-select" value={institutionId} onChange={e => setInstitutionId(e.target.value)}>
                        <option value="">Select node...</option>
                        {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                     </select>
                  </div>
                )}

                {needsSection && institutionId && (
                  <div className="obsidian-form-group">
                     <label className="obsidian-label">SECTION *</label>
                     <select className="obsidian-select" value={sectionId} onChange={e => setSectionId(e.target.value)}>
                        <option value="">All segments...</option>
                        {sections.map(s => <option key={s.id} value={s.id}>{s.short_label}</option>)}
                     </select>
                  </div>
                )}

                {needsSubject && (
                  <div className="obsidian-form-group">
                     <label className="obsidian-label">SUBJECT *</label>
                     <select className="obsidian-select" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
                        <option value="">All subjects...</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                  </div>
                )}

                {formMode === 'bulk' && (
                  <div className="obsidian-form-group">
                     <label className="obsidian-label">BATCH COUNT *</label>
                     <input className="obsidian-input" type="number" min={1} max={100} value={bulkCount} onChange={e => setBulkCount(Number(e.target.value))} />
                  </div>
                )}

                <div className="obsidian-form-group">
                   <label className="obsidian-label">TTL (DAYS) *</label>
                   <input className="obsidian-input" type="number" min={1} max={30} value={expiresDays} onChange={e => setExpiresDays(Number(e.target.value))} />
                </div>
             </div>

             <button className="btn--primary full" onClick={formMode === 'single' ? handleCreateSingle : handleCreateBulk} disabled={creating}>
                {creating ? "EXECUTING PROTOCOL..." : "EXECUTE INSTANTIATION"}
             </button>
          </section>
        )}

        {/* Code Filter Terminals */}
        <div className="filter-pills animate-fade-up" style={{ animationDelay: '100ms' }}>
           {ROLE_FILTERS.map(r => (
             <button key={r} className={`filter-pill ${filterRole === r ? 'active' : ''}`} onClick={() => setFilterRole(r)}>{r}</button>
           ))}
           <div style={{ width: '1px', background: 'var(--glass-border)', height: '20px', margin: '0 8px' }} />
           {VALID_FILTERS.map(f => (
             <button key={f} className={`filter-pill ${filterValid === f ? 'active' : ''}`} onClick={() => setFilterValid(f)}>{f}</button>
           ))}
        </div>

        {/* Global Registry */}
        <div className="glass-card joincode-table-nexus animate-fade-up" style={{ animationDelay: '150ms' }}>
           <table className="student-table">
              <thead>
                 <tr>
                    <th>CODE</th>
                    <th>PERMISSION</th>
                    <th>JURISDICTION</th>
                    <th>STATUS</th>
                    <th>EXPIRY</th>
                    <th style={{ textAlign: 'right' }}>PROTOCOLS</th>
                 </tr>
              </thead>
              <tbody>
                 {filtered.map((c, i) => (
                   <tr key={c.id}>
                      <td><span className="code-cell">{c.code.slice(0, 8)}...</span></td>
                      <td><span className="role-tag" style={{ color: 'var(--role-admin)' }}>{c.role}</span></td>
                      <td>
                         <div style={{ fontSize: '12px', fontWeight: 600 }}>{c.institution ?? c.district ?? "GLOBAL"}</div>
                         <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{c.section ? `Segment: ${c.section}` : "Nodal Scope"}</div>
                      </td>
                      <td>
                         <span className="status-badge" style={{ color: c.is_valid ? 'var(--role-student)' : 'var(--error)' }}>
                            {c.is_valid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                            {c.is_valid ? "VALID" : "NULL"}
                         </span>
                      </td>
                      <td>
                         <span className="stat-lbl">{new Date(c.expires_at).toLocaleDateString()}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                         <div className="mgmt-actions" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                            <button className="btn--ghost sm" onClick={() => setEmailCode(c)}><Mail size={12} /></button>
                            <button className="btn--ghost sm" style={{ color: 'var(--error)' }}><Trash2 size={12} /></button>
                         </div>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>

      </main>
      {emailCode && <EmailModal code={emailCode} onClose={() => setEmailCode(null)} onSent={msg => { setSuccess(msg); setEmailCode(null); }} />}
    </div>
  );
};

export default AdminJoinCodesPage;
