import { useEffect, useState } from "react";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import type { Role } from "../auth/authTypes";

type UserRow = {
  id: number;
  username: string;
  role: Role;
  // Note: /accounts/users/ returns id, username, role only
  // is_active is NOT returned by this endpoint
};

const ROLE_COLORS: Record<Role, string> = {
  STUDENT:   "badge--info",
  TEACHER:   "badge--success",
  PRINCIPAL: "badge--warning",
  OFFICIAL:  "badge--warning",
  ADMIN:     "badge--error",
};

function StatCard({ label, value, accent }: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="card">
      <div className="card__label">{label}</div>
      <div
        className="card__value"
        style={{ color: accent ?? "var(--text-primary)" }}
      >
        {value}
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
  const [users, setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    apiGet<UserRow[]>("/accounts/users/")
      .then(setUsers)
      .catch(() => setError("Failed to load user data."))
      .finally(() => setLoading(false));
  }, []);

  const countByRole = (role: Role) => users.filter((u) => u.role === role).length;

  return (
    <div className="page-shell">
      <TopBar title="Admin" />
      <main className="page-content page-enter">

        <div className="section-header">
          <div>
            <h2 className="section-header__title">System Overview</h2>
            <p className="section-header__subtitle">
              Read-only user management dashboard
            </p>
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        {/* Stat cards */}
        <div className="stat-grid" style={{ marginBottom: "var(--space-8)" }}>
          <StatCard label="Total Users" value={users.length} />
          <StatCard label="Students"   value={countByRole("STUDENT")}   accent="var(--role-student)" />
          <StatCard label="Teachers"   value={countByRole("TEACHER")}   accent="var(--role-teacher)" />
          <StatCard label="Principals" value={countByRole("PRINCIPAL")} accent="var(--role-principal)" />
          <StatCard label="Officials"  value={countByRole("OFFICIAL")}  accent="var(--role-official)" />
          <StatCard label="Admins"     value={countByRole("ADMIN")}     accent="var(--role-admin)" />
        </div>

        {/* User table */}
        <div className="section-header">
          <h3 className="section-header__title">All Users</h3>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "var(--space-6)" }}>
              <TableSkeleton />
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">👥</div>
              <h3 className="empty-state__title">No users found</h3>
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
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)", fontSize: "var(--text-xs)" }}>
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