import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";


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
type Section     = { id: number; name: string; classroom_id: number };
type Subject     = { id: number; name: string };
type District    = { id: number; name: string };

type CreatableRole = "STUDENT" | "TEACHER" | "PRINCIPAL" | "OFFICIAL";

// ── Helpers ────────────────────────────────────────────────────────────────

function parseApiError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const jsonStart = err.message.indexOf("{");
  if (jsonStart !== -1) {
    try {
      const p = JSON.parse(err.message.slice(jsonStart));
      if (p.error) return String(p.error);
      if (p.detail) return String(p.detail);
    } catch { /* fall through */ }
  }
  return fallback;
}

const ROLE_COLORS: Record<string, string> = {
  STUDENT:   "#3b82f6",
  TEACHER:   "#10b981",
  PRINCIPAL: "#f59e0b",
  OFFICIAL:  "#8b5cf6",
  ADMIN:     "#ef4444",
};

function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role] ?? "#6b7280";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      fontSize: 10,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 999,
      background: color + "22",
      color,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    }}>
      {role}
    </span>
  );
}

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

export default function UserManagementPage() {
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
    const promises: Promise<unknown>[] = [
      apiGet<JoinCode[]>("/accounts/join-codes/"),
      apiGet<UserRow[]>("/accounts/users/"),
    ];

    // Load lookup data based on what the current role needs
    if (myRole !== "TEACHER") {
      promises.push(apiGet<Institution[]>("/accounts/institutions/"));
    }
    promises.push(apiGet<Subject[]>("/accounts/subjects/"));
    promises.push(apiGet<District[]>("/academics/districts/"));

    Promise.all(promises)
      .then((results) => {
        setCodes(results[0] as JoinCode[]);
        setUsers(results[1] as UserRow[]);
        let idx = 2;
        if (myRole !== "TEACHER") {
          setInstitutions(results[idx++] as Institution[]);
        } else {
          // Teacher's own institution is pre-filled from auth context
          if (auth.user?.institution_id) {
            setInstitutions([{ id: auth.user.institution_id as number, name: auth.user.institution ?? "" }]);
            setInstitutionId(String(auth.user.institution_id));
          }
        }
        setSubjects(results[idx++] as Subject[]);
        setDistricts(results[idx] as District[]);
      })
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, [myRole, auth.user]);

  // ── Load sections when institution changes ────────────────────────────────

  useEffect(() => {
    if (!institutionId || !needsSection) {
      setSections([]);
      setSectionId("");
      return;
    }
    setSectionsLoading(true);
    apiGet<Section[]>(`/academics/sections/?classroom__institution_id=${institutionId}`)
      .then(setSections)
      .catch(() => setSections([]))
      .finally(() => setSectionsLoading(false));
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
    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, unknown> = {
        role,
        expires_days: expiresDays,
      };

      if (needsInstitution) {
        if (!institutionId) {
          setError("Please select an institution.");
          setCreating(false);
          return;
        }
        payload.institution_id = Number(institutionId);
      }
      if (needsSection) {
        if (sectionId) payload.section_id = Number(sectionId);
      }
      if (needsSubject) {
        if (!subjectId) {
          setError("Please select a subject for the teacher code.");
          setCreating(false);
          return;
        }
        payload.subject_id = Number(subjectId);
      }
      if (needsDistrict) {
        if (!districtId) {
          setError("Please select a district for the official code.");
          setCreating(false);
          return;
        }
        payload.district_id = Number(districtId);
      }

      const created = await apiPost<JoinCode>(
        "/accounts/join-codes/create/",
        payload
      );
      setCodes((prev) => [created, ...prev]);
      setSuccess(`✓ Code created: ${created.code}`);
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(parseApiError(err, "Failed to create join code."));
    } finally {
      setCreating(false);
    }
  }, [role, expiresDays, institutionId, sectionId, subjectId, districtId,
      needsInstitution, needsSection, needsSubject, needsDistrict]);

  const resetForm = () => {
    setRole(allowedRoles[0] ?? "STUDENT");
    setSectionId("");
    setSubjectId("");
    setDistrictId("");
    setExpiresDays(3);
    if (myRole !== "TEACHER") setInstitutionId("");
  };

  const handleRevoke = async (codeId: number, codeStr: string) => {
    if (!confirm(`Revoke code ${codeStr.slice(0, 8)}...? It will no longer work.`)) return;
    try {
      await apiPost(`/accounts/join-codes/${codeId}/revoke/`, {});
      setCodes((prev) =>
        prev.map((c) =>
          c.id === codeId ? { ...c, is_used: true, is_valid: false } : c
        )
      );
      setSuccess("Code revoked.");
    } catch {
      setError("Failed to revoke code.");
    }
  };

  // ── Page title based on viewer role ──────────────────────────────────────

  const pageTitle =
    myRole === "TEACHER" ? "Manage Students" :
    myRole === "PRINCIPAL" ? "Manage Teachers & Students" :
    myRole === "OFFICIAL" ? "Manage Principals" :
    "User Management";

  // ── Render ────────────────────────────────────────────────────────────────

  if (allowedRoles.length === 0) {
    return (
      <div className="page-shell">
        <TopBar title="Manage Users" />
        <main className="page-content">
          <div className="empty-state">
            <div className="empty-state__icon">🔒</div>
            <h3 className="empty-state__title">Access Restricted</h3>
            <p className="empty-state__message">
              Your role does not have permission to manage users.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title={pageTitle} />
      <main className="page-content page-enter">

        {/* ── Header ── */}
        <div className="section-header">
          <div>
            <h2 className="section-header__title">{pageTitle}</h2>
            <p className="section-header__subtitle">
              Create and manage join codes for new users
            </p>
          </div>
          {!showForm && (
            <button
              className="btn btn--primary"
              onClick={() => setShowForm(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Join Code
            </button>
          )}
        </div>

        {/* ── Alerts ── */}
        {error   && (
          <div className="alert alert--error" style={{ marginBottom: "var(--space-4)" }}>
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert--success" style={{ marginBottom: "var(--space-4)" }}>
            {success}
          </div>
        )}

        {/* ── Create form ── */}
        {showForm && (
          <div className="card" style={{ marginBottom: "var(--space-6)" }}>
            <h3 style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: "var(--space-5)",
            }}>
              Create Join Code
            </h3>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--space-4)",
            }}>
              {/* Role selector */}
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select
                  className="form-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as CreatableRole)}
                >
                  {allowedRoles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Institution */}
              {needsInstitution && (
                <div className="form-group">
                  <label className="form-label">
                    Institution {myRole !== "TEACHER" ? "*" : ""}
                  </label>
                  {myRole === "TEACHER" || myRole === "PRINCIPAL" ? (
                    /* Teacher/Principal: their institution is fixed */
                    <input
                      className="form-input"
                      value={auth.user?.institution ?? "—"}
                      disabled
                      style={{ opacity: 0.7, cursor: "not-allowed" }}
                    />
                  ) : (
                    <select
                      className="form-input"
                      value={institutionId}
                      onChange={(e) => setInstitutionId(e.target.value)}
                    >
                      <option value="">— select institution —</option>
                      {institutions.map((inst) => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Section (STUDENT only) */}
              {needsSection && (
                <div className="form-group">
                  <label className="form-label">Section</label>
                  {sectionsLoading ? (
                    <div className="skeleton" style={{ height: 42, borderRadius: "var(--radius-md)" }} />
                  ) : sections.length > 0 ? (
                    <select
                      className="form-input"
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                    >
                      <option value="">— all sections —</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="form-input"
                      placeholder={institutionId ? "No sections found" : "Select institution first"}
                      disabled
                      style={{ opacity: 0.6 }}
                    />
                  )}
                </div>
              )}

              {/* Subject (TEACHER only) */}
              {needsSubject && (
                <div className="form-group">
                  <label className="form-label">Subject *</label>
                  <select
                    className="form-input"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    <option value="">— select subject —</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* District (OFFICIAL only) */}
              {needsDistrict && (
                <div className="form-group">
                  <label className="form-label">District *</label>
                  <select
                    className="form-input"
                    value={districtId}
                    onChange={(e) => setDistrictId(e.target.value)}
                  >
                    <option value="">— select district —</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Expiry */}
              <div className="form-group">
                <label className="form-label">Expires in (days)</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={30}
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(Number(e.target.value))}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-5)" }}>
              <button
                className="btn btn--primary"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" />
                    Creating…
                  </>
                ) : "Create Code"}
              </button>
              <button
                className="btn btn--secondary"
                onClick={() => { setShowForm(false); resetForm(); }}
                disabled={creating}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Join codes list ── */}
        <div className="card" style={{ marginBottom: "var(--space-6)", padding: 0, overflow: "hidden" }}>
          <div style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--border-subtle)",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "var(--text-base)",
            color: "var(--text-primary)",
          }}>
            Active Join Codes
          </div>

          {loading ? (
            <div style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 44, borderRadius: "var(--radius-md)" }} />
              ))}
            </div>
          ) : codes.filter((c) => c.is_valid).length === 0 ? (
            <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: "var(--space-3)" }}>🔑</div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                No active join codes. Create one to invite users.
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Role</th>
                  <th>For</th>
                  <th>Expires</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {codes.filter((c) => c.is_valid).map((code) => (
                  <tr key={code.id}>
                    <td>
                      <code style={{
                        fontFamily: "monospace",
                        fontSize: "var(--text-xs)",
                        background: "var(--bg-elevated)",
                        padding: "2px 6px",
                        borderRadius: 4,
                        letterSpacing: "0.08em",
                        color: "var(--text-primary)",
                      }}>
                        {code.code}
                      </code>
                    </td>
                    <td><RoleBadge role={code.role} /></td>
                    <td style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                      {code.institution ?? code.district ?? "—"}
                      {code.subject ? ` · ${code.subject}` : ""}
                      {code.section ? ` · §${code.section}` : ""}
                    </td>
                    <td style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      {new Date(code.expires_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short",
                      })}
                    </td>
                    <td>
                      <button
                        className="btn btn--ghost"
                        style={{ fontSize: "var(--text-xs)", color: "var(--error)", padding: "2px 8px" }}
                        onClick={() => handleRevoke(code.id, code.code)}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Users list ── */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--border-subtle)",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "var(--text-base)",
            color: "var(--text-primary)",
          }}>
            Users in Scope ({users.length})
          </div>

          {loading ? (
            <div style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 40, borderRadius: "var(--radius-md)" }} />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                No users found in your scope.
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.username}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "monospace" }}>
                      {u.public_id ?? `#${u.id}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  );
}