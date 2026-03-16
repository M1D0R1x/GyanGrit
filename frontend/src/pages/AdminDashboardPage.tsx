import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import type { Role } from "../auth/authTypes";

type UserRow = {
  id: number;
  username: string;
  role: Role;
};

const ROLE_COLORS: Record<Role, string> = {
  STUDENT:   "badge--info",
  TEACHER:   "badge--success",
  PRINCIPAL: "badge--warning",
  OFFICIAL:  "badge--purple",
  ADMIN:     "badge--error",
};

const ROLE_ACCENT: Record<Role, string> = {
  STUDENT:   "var(--role-student)",
  TEACHER:   "var(--role-teacher)",
  PRINCIPAL: "var(--role-principal)",
  OFFICIAL:  "var(--role-official)",
  ADMIN:     "var(--role-admin)",
};

function StatCard({ label, value, accent }: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="card">
      <div className="card__label">{label}</div>
      <div className="card__value" style={{ color: accent ?? "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function QuickLink({
  icon, title, description, onClick, accent,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
  accent?: string;
}) {
  return (
    <div
      className="card card--clickable"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={{ borderColor: accent ? `${accent}33` : undefined }}
    >
      <div style={{ fontSize: 28, marginBottom: "var(--space-3)" }}>{icon}</div>
      <div style={{
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: "var(--text-base)",
        color: accent ?? "var(--text-primary)",
        marginBottom: "var(--space-1)",
      }}>
        {title}
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.5 }}>
        {description}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 44, borderRadius: "var(--radius-sm)" }} />
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");

  useEffect(() => {
    apiGet<UserRow[]>("/accounts/users/")
      .then(setUsers)
      .catch(() => setError("Failed to load user data."))
      .finally(() => setLoading(false));
  }, []);

  const countByRole = (role: Role) => users.filter((u) => u.role === role).length;

  const filteredUsers = roleFilter === "ALL"
    ? users
    : users.filter((u) => u.role === roleFilter);

  const ROLES: Role[] = ["STUDENT", "TEACHER", "PRINCIPAL", "OFFICIAL", "ADMIN"];

  return (
    <div className="page-shell">
      <TopBar title="Admin" />
      <main className="page-content page-enter">

        {/* Quick nav */}
        <div className="section-header">
          <h2 className="section-header__title">Admin Panel</h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-10)",
        }}>
          <QuickLink
            icon="📚"
            title="Content"
            description="Manage courses, lessons, and assessments"
            accent="var(--brand-primary)"
            onClick={() => navigate("/admin/content")}
          />
          <QuickLink
            icon="🔑"
            title="Join Codes"
            description="Generate and manage registration codes"
            accent="var(--role-principal)"
            onClick={() => navigate("/admin/join-codes")}
          />
          <QuickLink
            icon="👥"
            title="Users"
            description="View and manage all users in the system"
            accent="var(--role-official)"
            onClick={() => navigate("/admin/users")}
          />
        </div>

        {/* System stats */}
        <div className="section-header">
          <div>
            <h2 className="section-header__title">System Overview</h2>
            <p className="section-header__subtitle">
              {loading ? "Loading…" : `${users.length} total users`}
            </p>
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <div className="stat-grid" style={{ marginBottom: "var(--space-8)" }}>
          <StatCard label="Total Users"  value={users.length} />
          <StatCard label="Students"     value={countByRole("STUDENT")}   accent="var(--role-student)" />
          <StatCard label="Teachers"     value={countByRole("TEACHER")}   accent="var(--role-teacher)" />
          <StatCard label="Principals"   value={countByRole("PRINCIPAL")} accent="var(--role-principal)" />
          <StatCard label="Officials"    value={countByRole("OFFICIAL")}  accent="var(--role-official)" />
          <StatCard label="Admins"       value={countByRole("ADMIN")}     accent="var(--role-admin)" />
        </div>

        {/* User table with role filter */}
        <div className="section-header">
          <h3 className="section-header__title">All Users</h3>
        </div>

        {/* Role filter pills */}
        {!loading && (
          <div style={{
            display: "flex",
            gap: "var(--space-2)",
            flexWrap: "wrap",
            marginBottom: "var(--space-4)",
          }}>
            {(["ALL", ...ROLES] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                style={{
                  padding: "2px 12px",
                  borderRadius: "var(--radius-full)",
                  border: "1px solid var(--border-default)",
                  background: roleFilter === r ? "var(--brand-primary-glow)" : "transparent",
                  color: roleFilter === r
                    ? "var(--brand-primary)"
                    : r === "ALL" ? "var(--text-muted)" : ROLE_ACCENT[r as Role],
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                }}
              >
                {r === "ALL" ? `All (${users.length})` : `${r} (${countByRole(r as Role)})`}
              </button>
            ))}
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "var(--space-6)" }}>
              <TableSkeleton />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">👥</div>
              <h3 className="empty-state__title">No users found</h3>
              <p className="empty-state__message">
                {roleFilter !== "ALL" ? `No ${roleFilter} users in the system.` : "No users yet."}
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td style={{
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--text-xs)",
                    }}>
                      #{u.id}
                    </td>
                    <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                      {u.username}
                    </td>
                    <td>
                      <span className={`badge ${ROLE_COLORS[u.role]}`}>
                        {u.role}
                      </span>
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