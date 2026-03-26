import React, { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";
import { 
  Users, 
  Plus, 
  Key
} from 'lucide-react';
import './UserManagementPage.css';

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

type UserRow = {
  id: number;
  username: string;
  role: string;
  public_id?: string;
};

type Institution = { id: number; name: string };
type Section     = { id: number; name: string; classroom_id: number; grade: string; short_label: string; label: string };
type Subject     = { id: number; name: string };
type District    = { id: number; name: string };

type CreatableRole = "STUDENT" | "TEACHER" | "PRINCIPAL" | "OFFICIAL";

const ROLE_COLORS: Record<string, string> = {
  STUDENT:   "var(--role-student)",
  TEACHER:   "var(--role-teacher)",
  PRINCIPAL: "var(--warning)",
  OFFICIAL:  "var(--role-official)",
  ADMIN:     "var(--error)",
};

const RoleTag: React.FC<{ role: string }> = ({ role }) => {
  const color = ROLE_COLORS[role] ?? "var(--text-dim)";
  return (
    <span className="role-tag" style={{ border: `1px solid ${color}44`, color, background: `${color}11` }}>
      {role}
    </span>
  );
};

function getAllowedCreatableRoles(myRole: string): CreatableRole[] {
  if (myRole === "ADMIN")     return ["STUDENT", "TEACHER", "PRINCIPAL", "OFFICIAL"];
  if (myRole === "PRINCIPAL") return ["STUDENT", "TEACHER"];
  if (myRole === "TEACHER")   return ["STUDENT"];
  if (myRole === "OFFICIAL")  return ["PRINCIPAL"];
  return [];
}

function getRequiredFields(role: CreatableRole) {
  return {
    needsInstitution: role === "STUDENT" || role === "TEACHER" || role === "PRINCIPAL",
    needsSection:     role === "STUDENT",
    needsSubject:     role === "TEACHER",
    needsDistrict:    role === "OFFICIAL",
  };
}

const UserManagementPage: React.FC = () => {
  const auth = useAuth();
  const myRole = auth.user?.role ?? "STUDENT";
  const allowedRoles = getAllowedCreatableRoles(myRole);

  const [codes, setCodes]         = useState<JoinCode[]>([]);
  const [users, setUsers]         = useState<UserRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [creating, setCreating]   = useState(false);

  const [role, setRole]               = useState<CreatableRole>(allowedRoles[0] ?? "STUDENT");
  const [institutionId, setInstitutionId] = useState("");
  const [sectionId, setSectionId]     = useState("");
  const [subjectId, setSubjectId]     = useState("");
  const [districtId, setDistrictId]   = useState("");
  const [expiresDays, setExpiresDays] = useState(3);

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [sections, setSections]         = useState<Section[]>([]);
  const [subjects, setSubjects]         = useState<Subject[]>([]);
  const [districts, setDistricts]       = useState<District[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const { needsInstitution, needsSection, needsSubject, needsDistrict } = getRequiredFields(role);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const promises: Promise<unknown>[] = [
          apiGet<JoinCode[]>("/accounts/join-codes/"),
          apiGet<UserRow[]>("/accounts/users/"),
        ];
        if (myRole !== "TEACHER") promises.push(apiGet<Institution[]>("/accounts/institutions/"));
        promises.push(apiGet<Subject[]>("/accounts/subjects/"));
        promises.push(apiGet<District[]>("/academics/districts/"));

        const results = await Promise.all(promises);
        if (!cancelled) {
          setCodes(results[0] as JoinCode[]);
          setUsers(results[1] as UserRow[]);
          let idx = 2;
          if (myRole !== "TEACHER") setInstitutions(results[idx++] as Institution[]);
          else if (auth.user?.institution_id) {
            setInstitutions([{ id: auth.user.institution_id as number, name: auth.user.institution ?? "" }]);
            setInstitutionId(String(auth.user.institution_id));
          }
          setSubjects(results[idx++] as Subject[]);
          setDistricts(results[idx] as District[]);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("TELEMETRY ERROR: User registry unreachable.");
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [myRole, auth.user]);

  useEffect(() => {
    if (!institutionId || !needsSection) { setSections([]); setSectionId(""); return; }
    let cancelled = false;
    async function loadSections() {
      setSectionsLoading(true);
      try {
        const data = await apiGet<Section[]>(`/academics/sections/?classroom__institution_id=${institutionId}`);
        if (!cancelled) { setSections(data ?? []); setSectionsLoading(false); }
      } catch { if (!cancelled) setSectionsLoading(false); }
    }
    loadSections();
    return () => { cancelled = true; };
  }, [institutionId, needsSection]);

  const handleCreate = useCallback(async () => {
    setCreating(true); setError(null); setSuccess(null);
    try {
      const payload: Record<string, unknown> = { role, expires_days: expiresDays };
      if (needsInstitution) payload.institution_id = Number(institutionId);
      if (needsSection && sectionId) payload.section_id = Number(sectionId);
      if (needsSubject) payload.subject_id = Number(subjectId);
      if (needsDistrict) payload.district_id = Number(districtId);

      const created = await apiPost<JoinCode>("/accounts/join-codes/create/", payload);
      setCodes(prev => [created, ...prev]);
      setSuccess(`✓ PROTOCOL SUCCESS: Code instantiated ${created.code}`);
      setShowForm(false);
    } catch {
      setError("Instantiate Error: Protocol failure.");
    } finally {
      setCreating(false);
    }
  }, [role, expiresDays, institutionId, sectionId, subjectId, districtId, needsInstitution, needsSection, needsSubject, needsDistrict]);

  const handleRevoke = useCallback(async (id: number, code: string) => {
    if (!window.confirm(`Revoke protocol ${code}?`)) return;
    try {
      await apiPost(`/accounts/join-codes/${id}/revoke/`, {});
      setCodes(prev => prev.map(c => c.id === id ? { ...c, is_valid: false } : c));
      setSuccess(`✓ PROTOCOL REVOKED: ${code}`);
    } catch {
      setError("Revoke Error: Protocol stabilization failure.");
    }
  }, []);

  const pageTitle = myRole === "TEACHER" ? "Manage Students" : myRole === "PRINCIPAL" ? "Manage Teachers & Students" : myRole === "OFFICIAL" ? "Manage Principals" : "User Management";

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar title="Oversight Terminal" />
        <main className="page-content">
          <div className="skeleton-box" style={{ height: '400px' }} />
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title={pageTitle} />
      <main className="page-content page-enter usermgmt-layout">

        {/* Adaptive Header */}
        <section className="usermgmt-header animate-fade-up">
           <div className="inst-info">
              <span className="inst-label">SCOPE: {myRole} JURISDICTION</span>
              <h1 className="inst-name">{pageTitle.toUpperCase()}</h1>
              <p className="hero-subtitle">Unified registry for all nodes within your institutional scope.</p>
           </div>
           {!showForm && allowedRoles.length > 0 && (
             <button className="btn--primary" onClick={() => setShowForm(true)}>
                <Plus size={16} /> INSTANTIATE JOIN CODE
             </button>
           )}
        </section>

        {error && <div className="alert alert--error animate-fade-up">{error}</div>}
        {success && <div className="alert alert--success animate-fade-up">{success}</div>}

        {/* Join Code Creation Architect */}
        {showForm && (
          <section className="glass-card animate-fade-up" style={{ padding: 'var(--space-8) !important', marginBottom: 'var(--space-10)' }}>
             <div className="modal-header-nexus">
                <div className="inst-label">CODE ARCHITECT</div>
                <h2 className="modal-title" style={{ fontSize: '20px' }}>CREATE REGISTRATION PROTOCOL</h2>
             </div>

             <div className="joincode-form-grid" style={{ marginTop: 'var(--space-6)' }}>
                <div className="obsidian-form-group">
                   <label className="obsidian-label">ROLE SPEC *</label>
                   <select className="obsidian-select" value={role} onChange={e => setRole(e.target.value as any)}>
                      {allowedRoles.map(r => <option key={r} value={r}>{r}</option>)}
                   </select>
                </div>

                {needsInstitution && (
                  <div className="obsidian-form-group">
                     <label className="obsidian-label">INSTITUTIONAL NODE</label>
                     {myRole === "TEACHER" || myRole === "PRINCIPAL" ? (
                       <input className="obsidian-input" value={auth.user?.institution ?? "—"} disabled style={{ opacity: 0.6 }} />
                     ) : (
                       <select className="obsidian-select" value={institutionId} onChange={e => setInstitutionId(e.target.value)}>
                          <option value="">Select node...</option>
                          {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                       </select>
                     )}
                  </div>
                )}

                {needsSection && (
                  <div className="obsidian-form-group">
                     <label className="obsidian-label">SEGMENT SCOPE</label>
                     <select className="obsidian-select" value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={sectionsLoading}>
                        <option value="">All segments...</option>
                        {sections.map(s => <option key={s.id} value={s.id}>{s.short_label}</option>)}
                     </select>
                  </div>
                )}

                {needsSubject && (
                  <div className="obsidian-form-group">
                     <label className="obsidian-label">SUBJECT FOCUS *</label>
                     <select className="obsidian-select" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
                        <option value="">Select subject...</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                  </div>
                )}

                <div className="obsidian-form-group">
                   <label className="obsidian-label">TTL (DAYS) *</label>
                   <input className="obsidian-input" type="number" min={1} max={30} value={expiresDays} onChange={e => setExpiresDays(Number(e.target.value))} />
                </div>
             </div>

             <div className="mgmt-actions" style={{ gap: '12px' }}>
                <button className="btn--primary" style={{ flex: 1 }} onClick={handleCreate} disabled={creating}>
                   {creating ? "INSTANTIATING..." : "CREATE PROTOCOL"}
                </button>
                <button className="btn--secondary" onClick={() => setShowForm(false)} disabled={creating}>CANCEL</button>
             </div>
          </section>
        )}

        <div className="usermgmt-grid-stack">
           
           {/* Active Join Codes Registry */}
           <section className="registry-nexus animate-fade-up" style={{ animationDelay: '50ms' }}>
              <div className="nexus-header-text" style={{ marginBottom: 'var(--space-4)' }}>
                 <h2><Key size={14} color="var(--brand-primary)" /> ACTIVE REGISTRATION PROTOCOLS</h2>
              </div>
              <div className="glass-card registry-card" style={{ padding: 0 }}>
                 <table className="student-table">
                    <thead>
                       <tr>
                          <th>CODE</th>
                          <th>PERMISSION</th>
                          <th>JURISDICTION</th>
                          <th>EXPIRY</th>
                          <th style={{ textAlign: 'right' }}>PROTOCOLS</th>
                       </tr>
                    </thead>
                    <tbody>
                       {codes.filter(c => c.is_valid).map((c) => (
                         <tr key={c.id}>
                            <td><span className="code-cell">{c.code}</span></td>
                            <td><RoleTag role={c.role} /></td>
                            <td>
                               <div style={{ fontSize: '11px', fontWeight: 700 }}>{c.institution ?? c.district ?? "GLOBAL"}</div>
                               <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{c.section ? `Segment §${c.section}` : "Nodal Scope"}</div>
                            </td>
                            <td><span className="stat-lbl">{new Date(c.expires_at).toLocaleDateString()}</span></td>
                            <td style={{ textAlign: 'right' }}>
                               <button className="btn--ghost sm" style={{ color: 'var(--error)' }} onClick={() => handleRevoke(c.id, c.code)}>REVOKE</button>
                            </td>
                         </tr>
                       ))}
                       {codes.filter(c => c.is_valid).length === 0 && (
                         <tr><td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>NO ACTIVE CODES FOUND</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </section>

           {/* User Registry */}
           <section className="registry-nexus animate-fade-up" style={{ animationDelay: '100ms' }}>
              <div className="nexus-header-text" style={{ marginBottom: 'var(--space-4)' }}>
                 <h2><Users size={14} color="var(--role-student)" /> SCOPED IDENTITY REGISTRY</h2>
              </div>
              <div className="glass-card registry-card" style={{ padding: 0 }}>
                 <table className="student-table">
                    <thead>
                       <tr>
                          <th>IDENTITY</th>
                          <th>ACCESS LEVEL</th>
                          <th style={{ textAlign: 'right' }}>PUBLIC ID</th>
                       </tr>
                    </thead>
                    <tbody>
                       {users.map((u) => (
                         <tr key={u.id}>
                            <td>
                               <div className="user-identity-cell">
                                  <div className="user-avatar-init">{u.username.slice(0, 2).toUpperCase()}</div>
                                  <span style={{ fontWeight: 800 }}>{u.username}</span>
                               </div>
                            </td>
                            <td><RoleTag role={u.role} /></td>
                            <td style={{ textAlign: 'right' }}>
                               <span className="id-badge">{u.public_id ?? `#${u.id}`}</span>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </section>

        </div>

      </main>
    </div>
  );
};

export default UserManagementPage;
