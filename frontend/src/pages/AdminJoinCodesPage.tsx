import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../services/api";
import TopBar from "../components/TopBar";

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

type SubjectItem      = { id: number; name: string };
type InstitutionItem  = { id: number; name: string; district__name: string };
type DistrictItem     = { id: number; name: string };

// Updated: includes the enriched fields returned by academics/sections/
type SectionItem = {
  id: number;
  name: string;
  classroom_id: number;
  grade: string;
  institution_id: number;
  institution_name: string;
  label: string;        // "Class 8-A — Govt School Amritsar"
  short_label: string;  // "Class 8-A"
};

type RoleType    = "STUDENT" | "TEACHER" | "PRINCIPAL" | "OFFICIAL";
type ValidFilter = "ALL" | "VALID" | "USED";

const ROLES: RoleType[]            = ["STUDENT", "TEACHER", "PRINCIPAL", "OFFICIAL"];
const ROLE_FILTERS: string[]       = ["ALL", "STUDENT", "TEACHER", "PRINCIPAL", "OFFICIAL"];
const VALID_FILTERS: ValidFilter[] = ["ALL", "VALID", "USED"];

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

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "2px 12px",
        borderRadius: "var(--radius-full)",
        border: "1px solid var(--border-default)",
        background: active ? "var(--brand-primary-glow)" : "transparent",
        color: active ? "var(--brand-primary)" : "var(--text-muted)",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all var(--transition-fast)",
      }}
    >
      {label}
    </button>
  );
}

export default function AdminJoinCodesPage() {
  const [codes, setCodes]             = useState<JoinCode[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);
  const [showForm, setShowForm]       = useState(false);
  const [creating, setCreating]       = useState(false);
  const [filterRole, setFilterRole]   = useState("ALL");
  const [filterValid, setFilterValid] = useState<ValidFilter>("ALL");

  // Form fields
  const [role, setRole]               = useState<RoleType>("STUDENT");
  const [institutionId, setInstitutionId] = useState("");
  const [sectionId, setSectionId]     = useState("");
  const [subjectId, setSubjectId]     = useState("");
  const [districtId, setDistrictId]   = useState("");
  const [expiresDays, setExpiresDays] = useState(3);

  // Lookup data
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [sections, setSections]         = useState<SectionItem[]>([]);
  const [subjects, setSubjects]         = useState<SubjectItem[]>([]);
  const [districts, setDistricts]       = useState<DistrictItem[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  // Load initial data
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

  // Load sections when institution is selected
  useEffect(() => {
    if (!institutionId) {
      setSections([]);
      setSectionId("");
      return;
    }
    setSectionsLoading(true);
    // Uses academics/sections/ which returns enriched labels (grade, short_label, etc.)
    apiGet<SectionItem[]>(
      `/academics/sections/?classroom__institution_id=${institutionId}`
    )
      .then((data) => {
        // Sort numerically by grade then alphabetically by section name
        const sorted = [...data].sort((a, b) => {
          const gradeA = parseInt(a.grade, 10) || 0;
          const gradeB = parseInt(b.grade, 10) || 0;
          if (gradeA !== gradeB) return gradeA - gradeB;
          return a.name.localeCompare(b.name);
        });
        setSections(sorted);
      })
      .catch(() => setSections([]))
      .finally(() => setSectionsLoading(false));
  }, [institutionId]);

  // Reset section when institution changes
  useEffect(() => {
    setSectionId("");
  }, [institutionId]);

  const resetForm = () => {
    setRole("STUDENT");
    setInstitutionId("");
    setSectionId("");
    setSubjectId("");
    setDistrictId("");
    setExpiresDays(3);
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, unknown> = {
        role,
        expires_days: expiresDays,
      };
      if (institutionId) payload.institution_id = Number(institutionId);
      if (sectionId)     payload.section_id     = Number(sectionId);
      if (subjectId)     payload.subject_id     = Number(subjectId);
      if (districtId)    payload.district_id    = Number(districtId);

      const created = await apiPost<JoinCode>(
        "/accounts/join-codes/create/",
        payload
      );
      setCodes((prev) => [created, ...prev]);
      setSuccess(`Code created: ${created.code}`);
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(parseApiError(err, "Failed to create join code."));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (codeId: number, codeStr: string) => {
    if (!confirm(`Revoke code ${codeStr.slice(0, 8)}...?`)) return;
    try {
      await apiPost(`/accounts/join-codes/${codeId}/revoke/`, {});
      setCodes((prev) =>
        prev.map((c) =>
          c.id === codeId ? { ...c, is_used: true, is_valid: false } : c
        )
      );
      setSuccess("Code revoked.");
    } catch {
      setError("Failed to revoke.");
    }
  };

  const filtered = codes.filter((c) => {
    if (filterRole !== "ALL" && c.role !== filterRole) return false;
    if (filterValid === "VALID" && !c.is_valid) return false;
    if (filterValid === "USED" && c.is_valid) return false;
    return true;
  });

  const needsInstitution = role === "STUDENT" || role === "TEACHER" || role === "PRINCIPAL";
  const needsSection     = role === "STUDENT";
  const needsSubject     = role === "TEACHER";
  const needsDistrict    = role === "OFFICIAL";

  return (
    <div className="page-shell">
      <TopBar title="Join Codes" />
      <main className="page-content page-enter">

        <div className="section-header">
          <div>
            <h2 className="section-header__title">Join Code Manager</h2>
            <p className="section-header__subtitle">
              Generate and manage registration codes for new users
            </p>
          </div>
          <button className="btn btn--primary" onClick={() => setShowForm(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Code
          </button>
        </div>

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
              {/* Role */}
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select
                  className="form-input"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as RoleType);
                    setInstitutionId("");
                    setSectionId("");
                    setSubjectId("");
                    setDistrictId("");
                  }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Institution */}
              {needsInstitution && (
                <div className="form-group">
                  <label className="form-label">Institution *</label>
                  <select
                    className="form-input"
                    value={institutionId}
                    onChange={(e) => setInstitutionId(e.target.value)}
                  >
                    <option value="">— select institution —</option>
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Section — only for STUDENT, only after institution selected */}
              {needsSection && institutionId && (
                <div className="form-group">
                  <label className="form-label">Section</label>
                  {sectionsLoading ? (
                    <div
                      className="skeleton"
                      style={{ height: 42, borderRadius: "var(--radius-md)" }}
                    />
                  ) : sections.length > 0 ? (
                    <select
                      className="form-input"
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                    >
                      <option value="">— all sections —</option>
                      {sections.map((s) => (
                        // FIX: use short_label ("Class 8-A") not name ("A")
                        <option key={s.id} value={s.id}>
                          {s.short_label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="form-input"
                      value="No sections found"
                      disabled
                      style={{ opacity: 0.5, cursor: "not-allowed" }}
                    />
                  )}
                </div>
              )}

              {/* Subject — only for TEACHER */}
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

              {/* District — only for OFFICIAL */}
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
                <label className="form-label">Expires in (days, max 30)</label>
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

            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
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

        {/* ── Filters ── */}
        <div style={{
          display: "flex",
          gap: "var(--space-2)",
          marginBottom: "var(--space-5)",
          flexWrap: "wrap",
          alignItems: "center",
        }}>
          <span style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            Role:
          </span>
          {ROLE_FILTERS.map((r) => (
            <FilterPill
              key={r}
              label={r}
              active={filterRole === r}
              onClick={() => setFilterRole(r)}
            />
          ))}

          <div style={{ width: 1, height: 16, background: "var(--border-subtle)" }} />

          <span style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            Status:
          </span>
          {VALID_FILTERS.map((f) => (
            <FilterPill
              key={f}
              label={f}
              active={filterValid === f}
              onClick={() => setFilterValid(f)}
            />
          ))}
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 52, borderRadius: "var(--radius-md)" }}
              />
            ))}
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
                <tr>
                  <th>Code</th>
                  <th>Role</th>
                  <th>For</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Created by</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((code) => (
                  <tr key={code.id}>
                    <td>
                      <code style={{
                        fontFamily: "monospace",
                        fontSize: "var(--text-xs)",
                        background: "var(--bg-elevated)",
                        padding: "2px 6px",
                        borderRadius: "var(--radius-sm)",
                        letterSpacing: "0.05em",
                        color: "var(--text-primary)",
                      }}>
                        {code.code.slice(0, 8)}…
                      </code>
                    </td>
                    <td>
                      <span className={`badge ${roleColor(code.role)}`}>
                        {code.role}
                      </span>
                    </td>
                    <td style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                      {code.institution ?? code.district ?? "—"}
                      {code.subject ? ` · ${code.subject}` : ""}
                      {code.section ? ` · ${code.section}` : ""}
                    </td>
                    <td>
                      <span className={`badge ${code.is_valid ? "badge--success" : "badge--error"}`}>
                        {code.is_valid ? "Active" : "Used"}
                      </span>
                    </td>
                    <td style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      {new Date(code.expires_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      {code.created_by ?? "—"}
                    </td>
                    <td>
                      {code.is_valid && (
                        <button
                          className="btn btn--ghost"
                          style={{
                            padding: "2px 8px",
                            fontSize: "var(--text-xs)",
                            color: "var(--error)",
                          }}
                          onClick={() => handleRevoke(code.id, code.code)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </main>
    </div>
  );
}