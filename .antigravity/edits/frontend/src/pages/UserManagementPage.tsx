import React, { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

/**
 * DYNAMIC USER MANAGEMENT PAGE
 *
 * This single page adapts to the logged-in user's role:
 *
 *   TEACHER   → manages STUDENT join codes (scoped to their section/class)
 *   PRINCIPAL → manages TEACHER join codes (scoped to their institution)
 *   OFFICIAL  → manages PRINCIPAL join codes (scoped to their district)
 *   ADMIN     → manages all roles (unscoped)
 *
 * Architecture:
 * - Role config is a lookup table — adding a new role requires only one entry
 * - All API calls go through the existing /accounts/join-codes/ endpoints
 * - The backend enforces scope — we do not pass district/institution manually,
 *   the backend reads it from the authenticated user's profile
 */

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

// ── Helpers ────────────────────────────────────────────────────────────────

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
    <span className="role-tag" style={{ border: `1px solid ${color}44`, color, background: `${color}11`, fontSize: '9px', padding: '4px 8px' }}>
      {role}
    </span>
  );
};

// Which roles can the current user create codes for?
function getAllowedCreatableRoles(myRole: string): CreatableRole[] {
  if (myRole === "ADMIN")     return ["STUDENT", "TEACHER", "PRINCIPAL", "OFFICIAL"];
  if (myRole === "PRINCIPAL") return ["STUDENT", "TEACHER"];
  if (myRole === "TEACHER")   return ["STUDENT"];
  if (myRole === "OFFICIAL")  return ["PRINCIPAL"];
  return [];
}

// Which fields are required for each role?
function getRequiredFields(role: CreatableRole) {
  return {
    needsInstitution: role === "STUDENT" || role === "TEACHER" || role === "PRINCIPAL",
    needsSection:     role === "STUDENT",
    needsSubject:     role === "TEACHER",
    needsDistrict:    role === "OFFICIAL",
  };
}

// ── Main component ─────────────────────────────────────────────────────────

const UserManagementPage: React.FC = () => {
  const auth = useAuth();
  const myRole = auth.user?.role ?? "STUDENT";
  const allowedRoles = getAllowedCreatableRoles(myRole);

  // ── State ─────────────────────────────────────────────────────────────────

  const [codes, setCodes]         = useState<JoinCode[]>([]);
  const [users, setUsers]         = useState<UserRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [creating, setCreating]   = useState(false);

  // Form state
  const [role, setRole]               = useState<CreatableRole>(allowedRoles[0] ?? "STUDENT");
  const [institutionId, setInstitutionId] = useState("");
  const [sectionId, setSectionId]     = useState("");
  const [subjectId, setSubjectId]     = useState("");
  const [districtId, setDistrictId]   = useState("");
  const [expiresDays, setExpiresDays] = useState(3);

  // Lookup data
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [sections, setSections]         = useState<Section[]>([]);
  const [subjects, setSubjects]         = useState<Subject[]>([]);
  const [districts, setDistricts]       = useState<District[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  // Derived
  const { needsInstitution, needsSection, needsSubject, needsDistrict } = getRequiredFields(role);

  // ── Load initial data ─────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const promises: Promise<unknown>[] = [
          apiGet<JoinCode[]>("/accounts/join-codes/"),
          apiGet<UserRow[]>("/accounts/users/"),
        ];
        
        // Load lookup data based on what the current role needs
        if (myRole !== "TEACHER") promises.push(apiGet<Institution[]>("/accounts/institutions/"));
        promises.push(apiGet<Subject[]>("/accounts/subjects/"));
        promises.push(apiGet<District[]>("/academics/districts/"));

        const results = await Promise.all(promises);
        if (!cancelled) {
          setCodes(results[0] as JoinCode[]);
          setUsers(results[1] as UserRow[]);
          let idx = 2;
          if (myRole !== "TEACHER") {
             setInstitutions(results[idx++] as Institution[]);
          } else if (auth.user?.institution_id) {
            // Teacher's own institution is pre-filled from auth context
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

  // ── Load sections when institution changes ────────────────────────────────

  useEffect(() => {
    if (!institutionId || !needsSection) { setSections([]); setSectionId(""); return; }
    let cancelled = false;
    async function loadSections() {
      setSectionsLoading(true);
      try {
        const data = await apiGet<Section[]>(`/academics/sections/?classroom__institution_id=${institutionId}`);
        if (!cancelled) {
          const sorted = (data || []).sort((a, b) => {
            const numA = parseInt(a.short_label || a.name);
            const numB = parseInt(b.short_label || b.name);
            if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
            return (a.short_label || a.name).localeCompare(b.short_label || b.name);
          });
          setSections(sorted);
          setSectionsLoading(false);
        }
      } catch { if (!cancelled) setSectionsLoading(false); }
    }
    loadSections();
    return () => { cancelled = true; };
  }, [institutionId, needsSection]);

  // Reset dependent fields when role changes
  useEffect(() => {
     setSectionId("");
     setSubjectId("");
     setDistrictId("");
     if (myRole === "TEACHER" && auth.user?.institution_id) {
       setInstitutionId(String(auth.user.institution_id));
     } else if (myRole !== "ADMIN" && myRole !== "OFFICIAL") {
       // Principal/Teacher auto-scoped to their institution
     }
  }, [role, myRole, auth.user]);

  // ── Create join code ──────────────────────────────────────────────────────

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Page title based on viewer role ──────────────────────────────────────
  const pageTitle = myRole === "TEACHER" ? "Manage Students" : myRole === "PRINCIPAL" ? "Manage Teachers & Students" : myRole === "OFFICIAL" ? "Manage Principals" : "User Management";

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar title="Oversight Terminal" />
        <main className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="btn__spinner" />
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title={pageTitle} />
      <main className="page-content page-enter has-bottom-nav" style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--space-10) var(--space-6)' }}>

        {/* ── Header ── */}
        <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
           <div>
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px', display: 'block' }}>SCOPE: {myRole} JURISDICTION</span>
              <h1 className="text-gradient" style={{ fontSize: 'var(--text-3xl)', margin: 0 }}>{pageTitle.toUpperCase()}</h1>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>Unified registry for all nodes within your institutional scope.</p>
           </div>
           {!showForm && allowedRoles.length > 0 && (
             <button className="btn--primary" onClick={() => setShowForm(true)} style={{ padding: '12px 24px', fontSize: '12px', letterSpacing: '0.1em' }}>
                <span style={{ fontSize: '16px', marginRight: '6px' }}>+</span> INSTANTIATE JOIN CODE
             </button>
           )}
        </section>

        {/* ── Alerts ── */}
        {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-6)' }}>{error}</div>}
        {success && <div style={{ marginBottom: 'var(--space-6)', padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(61,214,140,0.08)', border: '1px solid rgba(61,214,140,0.2)', fontSize: '12px', color: 'var(--role-student)' }}>{success}</div>}

        {/* ── Create form ── */}
        {/* Join Code Creation Architect */}
        {showForm && (
          <section className="glass-card page-enter" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
             <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '24px' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-primary)', letterSpacing: '0.1em', marginBottom: '4px' }}>CODE ARCHITECT</div>
                <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>CREATE REGISTRATION PROTOCOL</h2>
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)' }}>
                {/* Role selector */}
                <div>
                   <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>ROLE SPEC *</label>
                   <select className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px' }} value={role} onChange={e => setRole(e.target.value as any)}>
                      {allowedRoles.map(r => <option key={r} value={r}>{r}</option>)}
                   </select>
                </div>

                {/* Institution */}
                {needsInstitution && (
                  <div>
                     <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>INSTITUTIONAL NODE</label>
                     {myRole === "TEACHER" || myRole === "PRINCIPAL" ? (
                       /* Teacher/Principal: their institution is fixed */
                       <input className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px', opacity: 0.6 }} value={auth.user?.institution ?? "—"} disabled />
                     ) : (
                       <select className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px' }} value={institutionId} onChange={e => setInstitutionId(e.target.value)}>
                          <option value="">Select node...</option>
                          {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                       </select>
                     )}
                  </div>
                )}

                {/* Section (STUDENT only) */}
                {needsSection && (
                  <div>
                     <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>SEGMENT SCOPE</label>
                     <select className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px' }} value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={sectionsLoading}>
                        <option value="">All segments...</option>
                        {sections.map(s => <option key={s.id} value={s.id}>{s.short_label}</option>)}
                     </select>
                  </div>
                )}

                {/* Subject (TEACHER only) */}
                {needsSubject && (
                  <div>
                     <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>SUBJECT FOCUS *</label>
                     <select className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px' }} value={subjectId} onChange={e => setSubjectId(e.target.value)}>
                        <option value="">Select subject...</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                  </div>
                )}

                {/* District (OFFICIAL only) */}
                {needsDistrict && (
                  <div>
                     <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>DISTRICT VECTOR *</label>
                     <select className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px' }} value={districtId} onChange={e => setDistrictId(e.target.value)}>
                        <option value="">Select district...</option>
                        {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                     </select>
                  </div>
                )}

                {/* Expiry */}
                <div>
                   <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>TTL (DAYS) *</label>
                   <input className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px' }} type="number" min={1} max={30} value={expiresDays} onChange={e => setExpiresDays(Number(e.target.value))} />
                </div>
             </div>

             <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                <button className="btn--primary" style={{ flex: 1, padding: '16px', fontSize: '12px', letterSpacing: '0.1em' }} onClick={handleCreate} disabled={creating}>
                   {creating ? "INSTANTIATING..." : "CREATE PROTOCOL"}
                </button>
                <button className="btn--ghost" style={{ flex: 1, padding: '16px', fontSize: '12px', letterSpacing: '0.1em' }} onClick={() => setShowForm(false)} disabled={creating}>CANCEL</button>
             </div>
          </section>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-8)' }}>
           
           {/* ── Join codes list ── */}
           {/* Active Join Codes Registry */}
           <section>
              <div style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <span style={{ fontSize: '16px' }}>🔑</span>
                 <h2 style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.05em', margin: 0 }}>ACTIVE REGISTRATION PROTOCOLS</h2>
              </div>
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                 <table className="data-table">
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
                            <td>
                              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--brand-primary)', background: 'var(--bg-elevated)', padding: '4px 8px', borderRadius: '4px', letterSpacing: '0.1em' }}>
                                {c.code}
                              </span>
                            </td>
                            <td><RoleTag role={c.role} /></td>
                            <td>
                               <div style={{ fontSize: '11px', fontWeight: 700 }}>{c.institution ?? c.district ?? "GLOBAL"}</div>
                               <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{c.section ? `Segment §${c.section}` : c.subject ? `Focus: ${c.subject}` : "Nodal Scope"}</div>
                            </td>
                            <td><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(c.expires_at).toLocaleDateString()}</span></td>
                            <td style={{ textAlign: 'right' }}>
                               <button className="btn--ghost" style={{ color: 'var(--error)', padding: '6px 12px', fontSize: '10px' }} onClick={() => handleRevoke(c.id, c.code)}>REVOKE</button>
                            </td>
                         </tr>
                       ))}
                       {codes.filter(c => c.is_valid).length === 0 && (
                         <tr><td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em' }}>NO ACTIVE CODES FOUND</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </section>

           {/* ── Users list ── */}
           {/* User Registry */}
           <section>
              <div style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <span style={{ fontSize: '16px' }}>👥</span>
                   <h2 style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.05em', margin: 0 }}>SCOPED IDENTITY REGISTRY</h2>
                 </div>
                 <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 }}>{users.length} NODES LINKED</span>
              </div>
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                 <table className="data-table">
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
                               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900, color: 'var(--text-primary)' }}>
                                    {u.username.slice(0, 2).toUpperCase()}
                                  </div>
                                  <span style={{ fontWeight: 800, fontSize: '13px' }}>{u.username}</span>
                               </div>
                            </td>
                            <td><RoleTag role={u.role} /></td>
                            <td style={{ textAlign: 'right' }}>
                               <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{u.public_id ?? `#${u.id}`}</span>
                            </td>
                         </tr>
                       ))}
                       {users.length === 0 && (
                         <tr><td colSpan={3} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em' }}>NO CONNECTED NODES</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </section>

        </div>

      </main>
      <BottomNav />
    </div>
  );
};

export default UserManagementPage;
