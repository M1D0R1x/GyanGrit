import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiGet, apiPost } from "../services/api";
import TopBar from "../components/TopBar";
import type { Role } from "../auth/authTypes";

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

// ── Role config ───────────────────────────────────────────────────────────────

type ManagedRole = "STUDENT" | "TEACHER" | "PRINCIPAL";

type RoleConfig = {
  manages: ManagedRole;
  label: string;
  plural: string;
  description: string;
  accentVar: string;
  icon: string;
  scopeLabel: string;
};

const ROLE_CONFIG: Partial<Record<Role, RoleConfig>> = {
  TEACHER: {
    manages: "STUDENT",
    label: "Student",
    plural: "Students",
    description: "Generate join codes for students to register in your class.",
    accentVar: "var(--role-student)",
    icon: "🎓",
    scopeLabel: "Your Class",
  },
  PRINCIPAL: {
    manages: "TEACHER",
    label: "Teacher",
    plural: "Teachers",
    description: "Generate join codes for teachers to join your institution.",
    accentVar: "var(--role-teacher)",
    icon: "👩‍🏫",
    scopeLabel: "Your Institution",
  },
  OFFICIAL: {
    manages: "PRINCIPAL",
    label: "Principal",
    plural: "Principals",
    description: "Generate join codes for principals across your district.",
    accentVar: "var(--role-principal)",
    icon: "🏫",
    scopeLabel: "Your District",
  },
  ADMIN: {
    manages: "TEACHER",
    label: "Teacher",
    plural: "Teachers",
    description: "Generate join codes for any role system-wide.",
    accentVar: "var(--role-admin)",
    icon: "⚙️",
    scopeLabel: "All Institutions",
  },
};

// ── Types ────────────────────────────────────────────────────────────────────

type JoinCode = {
  id: number;
  code: string;
  role: Role;
  is_used: boolean;
  is_active: boolean;
  created_at: string;
  used_by_username: string | null;
  // Scope fields
  institution_name: string | null;
  section_name: string | null;
  district_name: string | null;
  subject_name: string | null;
};

type CreateCodePayload = {
  role: ManagedRole;
  count?: number;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="btn btn--ghost"
      style={{ padding: "var(--space-1) var(--space-2)", fontSize: "var(--text-xs)" }}
      title="Copy join code"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function CodeRow({ code, onRevoke }: { code: JoinCode; onRevoke: (id: number) => void }) {
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await apiPost(`/accounts/join-codes/${code.id}/revoke/`, {});
      onRevoke(code.id);
    } catch {
      // silent — parent will not remove it
    } finally {
      setRevoking(false);
    }
  };

  const statusBadge = code.is_used
    ? <span className="badge badge--success">Used</span>
    : code.is_active
    ? <span className="badge badge--info">Active</span>
    : <span className="badge badge--error">Revoked</span>;

  const scopeText = [
    code.institution_name,
    code.section_name,
    code.district_name,
    code.subject_name,
  ].filter(Boolean).join(" · ");

  return (
    <tr>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <code style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "var(--text-sm)",
            color: "var(--text-primary)",
            background: "var(--bg-elevated)",
            padding: "var(--space-1) var(--space-2)",
            borderRadius: "var(--radius-sm)",
            letterSpacing: "0.08em",
          }}>
            {code.code}
          </code>
          <CopyButton text={code.code} />
        </div>
      </td>
      <td>
        {code.used_by_username ? (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 500 }}>
            {code.used_by_username}
          </span>
        ) : (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", fontStyle: "italic" }}>
            Unused
          </span>
        )}
      </td>
      <td>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {scopeText || "—"}
        </span>
      </td>
      <td>{statusBadge}</td>
      <td>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {new Date(code.created_at).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric"
          })}
        </span>
      </td>
      <td>
        {code.is_active && !code.is_used && (
          <button
            className="btn btn--danger"
            style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-xs)" }}
            onClick={handleRevoke}
            disabled={revoking}
          >
            {revoking ? <span className="btn__spinner" /> : "Revoke"}
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const { user } = useAuth();
  const role = user?.role ?? "TEACHER";
  const config = ROLE_CONFIG[role as Role];

  const [codes, setCodes] = useState<JoinCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "used" | "revoked">("all");
  const [count, setCount] = useState(1);

  // ── Load codes ──
  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<JoinCode[]>("/accounts/join-codes/");
      setCodes(data);
    } catch {
      setError("Failed to load join codes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  // ── Create codes ──
  const handleCreate = async () => {
    if (!config) return;
    setCreating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload: CreateCodePayload = {
        role: config.manages,
        count,
      };
      await apiPost("/accounts/join-codes/create/", payload);
      setSuccessMsg(`${count} ${config.label} join code${count > 1 ? "s" : ""} created.`);
      await loadCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create join codes.");
    } finally {
      setCreating(false);
    }
  };

  // ── Revoke ──
  const handleRevoke = (id: number) => {
    setCodes((prev) =>
      prev.map((c) => c.id === id ? { ...c, is_active: false } : c)
    );
  };

  // ── Filtered codes ──
  const filteredCodes = codes.filter((c) => {
    if (filterStatus === "active")  return c.is_active && !c.is_used;
    if (filterStatus === "used")    return c.is_used;
    if (filterStatus === "revoked") return !c.is_active && !c.is_used;
    return true;
  });

  const activeCount  = codes.filter((c) => c.is_active && !c.is_used).length;
  const usedCount    = codes.filter((c) => c.is_used).length;
  const revokedCount = codes.filter((c) => !c.is_active && !c.is_used).length;

  // ── No config = role cannot manage users ──
  if (!config) {
    return (
      <div className="page-shell">
        <TopBar />
        <main className="page-content">
          <div className="empty-state">
            <div className="empty-state__icon">🔒</div>
            <h3 className="empty-state__title">Not available</h3>
            <p className="empty-state__message">
              User management is not available for your role.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const accentStyle = { color: config.accentVar };

  return (
    <div className="page-shell">
      <TopBar />
      <main className="page-content page-enter">

        {/* Header */}
        <div className="section-header" style={{ marginBottom: "var(--space-8)" }}>
          <div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-2)",
            }}>
              <span style={{ fontSize: 28 }}>{config.icon}</span>
              <h1 style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-3xl)",
                fontWeight: 800,
                color: "var(--text-primary)",
                letterSpacing: "-0.03em",
              }}>
                {config.plural} Management
              </h1>
            </div>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              {config.description}
            </p>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginTop: "var(--space-3)",
              padding: "var(--space-1) var(--space-3)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-full)",
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Scope: <strong style={{ color: "var(--text-secondary)" }}>{config.scopeLabel}</strong>
              {user?.institution && (
                <span style={{ color: "var(--text-secondary)" }}>· {user.institution}</span>
              )}
              {user?.district && (
                <span style={{ color: "var(--text-secondary)" }}>· {user.district}</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stat-grid" style={{ marginBottom: "var(--space-6)" }}>
          <div className="card">
            <div className="card__label">Total Codes</div>
            <div className="card__value">{codes.length}</div>
          </div>
          <div className="card">
            <div className="card__label">Active</div>
            <div className="card__value" style={{ color: "var(--info)" }}>{activeCount}</div>
          </div>
          <div className="card">
            <div className="card__label">Used</div>
            <div className="card__value" style={{ color: "var(--success)" }}>{usedCount}</div>
          </div>
          <div className="card">
            <div className="card__label">Revoked</div>
            <div className="card__value" style={{ color: "var(--error)" }}>{revokedCount}</div>
          </div>
        </div>

        {/* Create form */}
        <div className="card" style={{
          marginBottom: "var(--space-8)",
          borderColor: `${config.accentVar}33`,
          background: `linear-gradient(135deg, ${config.accentVar}08 0%, var(--bg-surface) 60%)`,
        }}>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "var(--space-4)",
          }}>
            Generate New {config.label} Codes
          </h2>

          {successMsg && (
            <div className="alert alert--success" style={{ marginBottom: "var(--space-4)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {successMsg}
            </div>
          )}

          {error && (
            <div className="alert alert--error" style={{ marginBottom: "var(--space-4)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label className="form-label">
                Number of codes
              </label>
              <input
                type="number"
                className="form-input"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value))))}
                style={{ width: 120 }}
              />
            </div>

            <div style={{
              padding: "var(--space-3) var(--space-4)",
              background: "var(--bg-elevated)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              fontSize: "var(--text-sm)",
              color: "var(--text-muted)",
            }}>
              Role: <strong style={accentStyle}>{config.manages}</strong>
              {" "}· Scope: <strong style={{ color: "var(--text-secondary)" }}>
                {user?.institution || user?.district || "System"}
              </strong>
            </div>

            <button
              className="btn btn--primary"
              onClick={handleCreate}
              disabled={creating}
              style={{ flexShrink: 0 }}
            >
              {creating ? (
                <>
                  <span className="btn__spinner" aria-hidden="true" />
                  Generating…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Generate {count > 1 ? `${count} codes` : "code"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{
          display: "flex",
          gap: "var(--space-2)",
          marginBottom: "var(--space-4)",
          flexWrap: "wrap",
        }}>
          {(["all", "active", "used", "revoked"] as const).map((f) => (
            <button
              key={f}
              className="badge"
              style={{
                cursor: "pointer",
                border: "1px solid var(--border-default)",
                background: filterStatus === f ? "rgba(88,166,255,0.12)" : "transparent",
                color: filterStatus === f ? "var(--info)" : "var(--text-muted)",
                padding: "var(--space-1) var(--space-3)",
                textTransform: "capitalize",
              }}
              onClick={() => setFilterStatus(f)}
            >
              {f === "all" ? `All (${codes.length})` :
               f === "active" ? `Active (${activeCount})` :
               f === "used" ? `Used (${usedCount})` :
               `Revoked (${revokedCount})`}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "var(--space-6)" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton" style={{
                  height: 44,
                  borderRadius: "var(--radius-sm)",
                  marginBottom: "var(--space-2)",
                }} />
              ))}
            </div>
          ) : filteredCodes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">🎫</div>
              <h3 className="empty-state__title">No join codes yet</h3>
              <p className="empty-state__message">
                Generate codes above and share them with {config.plural.toLowerCase()} to let them register.
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Join Code</th>
                  <th>Used By</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredCodes.map((code) => (
                  <CodeRow
                    key={code.id}
                    code={code}
                    onRevoke={handleRevoke}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  );
}