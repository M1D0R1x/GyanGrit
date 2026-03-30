// pages.AdminDashboardPage
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import type { Role } from "../auth/authTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRow = {
  id:       number;
  username: string;
  role:     Role;
};

type SystemStats = {
  users: {
    total:      number;
    students:   number;
    teachers:   number;
    principals: number;
    officials:  number;
    admins:     number;
  };
  active_sessions: number;
  content: {
    courses:               number;
    lessons:               number;
    published_assessments: number;
  };
  activity: {
    lessons_completed_today:     number;
    assessments_submitted_today: number;
    notifications_sent_today:    number;
  };
};

// ── Styling helpers ───────────────────────────────────────────────────────────

const ROLE_BADGE: Record<Role, string> = {
  STUDENT:   "badge--info",
  TEACHER:   "badge--success",
  PRINCIPAL: "badge--warning",
  OFFICIAL:  "badge--purple",
  ADMIN:     "badge--error",
};

const ROLE_COLOR: Record<Role, string> = {
  STUDENT:   "var(--role-student)",
  TEACHER:   "var(--role-teacher)",
  PRINCIPAL: "var(--role-principal)",
  OFFICIAL:  "var(--role-official)",
  ADMIN:     "var(--role-admin)",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  accent,
  loading,
}: {
  label:   string;
  value:   number | string;
  sub?:    string;
  accent?: string;
  loading: boolean;
}) {
  return (
    <div className="card" style={{ padding: "var(--space-4)" }}>
      {loading ? (
        <>
          <div className="skeleton skeleton-line skeleton-line--short" style={{ marginBottom: "var(--space-2)" }} />
          <div className="skeleton skeleton-line skeleton-line--title" style={{ height: 28 }} />
        </>
      ) : (
        <>
          <div style={{
            fontSize:      "var(--text-xs)",
            color:         "var(--ink-muted)",
            fontWeight:    600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom:  "var(--space-2)",
          }}>
            {label}
          </div>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize:   "var(--text-3xl)",
            fontWeight: 800,
            color:      accent ?? "var(--ink-primary)",
            lineHeight: 1,
          }}>
            {value}
          </div>
          {sub && (
            <div style={{
              fontSize:   "var(--text-xs)",
              color:      "var(--ink-muted)",
              marginTop:  "var(--space-1)",
            }}>
              {sub}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuickLink({
  icon, title, description, onClick, accent,
}: {
  icon:        string;
  title:       string;
  description: string;
  onClick:     () => void;
  accent?:     string;
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
        fontFamily:    "var(--font-display)",
        fontWeight:    700,
        fontSize:      "var(--text-base)",
        color:         accent ?? "var(--ink-primary)",
        marginBottom:  "var(--space-1)",
      }}>
        {title}
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", lineHeight: 1.5 }}>
        {description}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize:      "var(--text-xs)",
      fontWeight:    700,
      color:         "var(--ink-muted)",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      marginBottom:  "var(--space-3)",
      marginTop:     "var(--space-6)",
    }}>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const [users, setUsers]       = useState<UserRow[]>([]);
  const [stats, setStats]       = useState<SystemStats | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError]     = useState(false);
  const [roleFilter, setRoleFilter]     = useState<Role | "ALL">("ALL");

  useEffect(() => {
    // Users list
    apiGet<UserRow[]>("/accounts/users/")
      .then(setUsers)
      .catch(() => {/* silently — table shows empty */})
      .finally(() => setLoadingUsers(false));

    // System stats — ADMIN-only endpoint
    apiGet<SystemStats>("/accounts/system-stats/")
      .then(setStats)
      .catch(() => setStatsError(true))
      .finally(() => setLoadingStats(false));
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

        {/* ── Quick nav ──────────────────────────────────────────────────── */}
        <div className="section-header">
          <h2 className="section-header__title">Admin Panel</h2>
          <p className="section-header__subtitle">GyanGrit system management</p>
        </div>

        <div style={{
          display:               "grid",
          gridTemplateColumns:   "repeat(auto-fill, minmax(180px, 1fr))",
          gap:                   "var(--space-4)",
          marginBottom:          "var(--space-8)",
        }}>
          <QuickLink
            icon="📚" title="Content"
            description="Manage courses, lessons, and assessments"
            accent="var(--saffron)"
            onClick={() => navigate("/admin/content")}
          />
          <QuickLink
            icon="🔑" title="Join Codes"
            description="Generate and manage registration codes"
            accent="var(--role-principal)"
            onClick={() => navigate("/admin/join-codes")}
          />
          <QuickLink
            icon="👥" title="Users"
            description="View and manage all users in the system"
            accent="var(--role-official)"
            onClick={() => navigate("/admin/users")}
          />
          <QuickLink
            icon="🔔" title="Broadcast"
            description="Send system-wide announcements"
            accent="var(--role-admin)"
            onClick={() => navigate("/notifications")}
          />
        </div>

        {/* ── Live system stats ──────────────────────────────────────────── */}
        <SectionLabel>System Overview</SectionLabel>

        {statsError ? (
          <div className="alert alert--warning" style={{ marginBottom: "var(--space-6)" }}>
            Could not load system stats.
          </div>
        ) : (
          <>
            {/* User counts */}
            <div style={{
              display:             "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
              gap:                 "var(--space-3)",
              marginBottom:        "var(--space-4)",
            }}>
              <StatTile
                loading={loadingStats}
                label="Total Users"
                value={stats?.users.total ?? 0}
              />
              <StatTile
                loading={loadingStats}
                label="Students"
                value={stats?.users.students ?? 0}
                accent="var(--role-student)"
              />
              <StatTile
                loading={loadingStats}
                label="Teachers"
                value={stats?.users.teachers ?? 0}
                accent="var(--role-teacher)"
              />
              <StatTile
                loading={loadingStats}
                label="Principals"
                value={stats?.users.principals ?? 0}
                accent="var(--role-principal)"
              />
              <StatTile
                loading={loadingStats}
                label="Officials"
                value={stats?.users.officials ?? 0}
                accent="var(--role-official)"
              />
              <StatTile
                loading={loadingStats}
                label="Active Sessions"
                value={stats?.active_sessions ?? 0}
                sub="logged-in devices"
                accent="var(--saffron)"
              />
            </div>

            {/* Content + today's activity in two groups */}
            <div style={{
              display:             "grid",
              gridTemplateColumns: "1fr 1fr",
              gap:                 "var(--space-4)",
              marginBottom:        "var(--space-8)",
            }}>
              {/* Content */}
              <div className="card" style={{ padding: "var(--space-5)" }}>
                <div style={{
                  fontSize:      "var(--text-xs)",
                  fontWeight:    700,
                  color:         "var(--ink-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom:  "var(--space-4)",
                }}>
                  Content
                </div>
                {loadingStats ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton skeleton-line" style={{ marginBottom: "var(--space-3)", height: 16 }} />
                  ))
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {[
                      { label: "Courses",      value: stats?.content.courses ?? 0 },
                      { label: "Lessons",      value: stats?.content.lessons ?? 0, sub: "published" },
                      { label: "Assessments",  value: stats?.content.published_assessments ?? 0, sub: "published" },
                    ].map(({ label, value, sub }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-secondary)" }}>
                          {label}{sub ? <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}> ({sub})</span> : ""}
                        </span>
                        <span style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 800,
                          fontSize:   "var(--text-lg)",
                          color:      "var(--ink-primary)",
                        }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Today */}
              <div className="card" style={{ padding: "var(--space-5)" }}>
                <div style={{
                  fontSize:      "var(--text-xs)",
                  fontWeight:    700,
                  color:         "var(--ink-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom:  "var(--space-4)",
                }}>
                  Today's Activity
                </div>
                {loadingStats ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton skeleton-line" style={{ marginBottom: "var(--space-3)", height: 16 }} />
                  ))
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {[
                      { icon: "📖", label: "Lessons completed",    value: stats?.activity.lessons_completed_today ?? 0 },
                      { icon: "📋", label: "Assessments submitted", value: stats?.activity.assessments_submitted_today ?? 0 },
                      { icon: "🔔", label: "Broadcasts sent",       value: stats?.activity.notifications_sent_today ?? 0 },
                    ].map(({ icon, label, value }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-secondary)" }}>
                          {icon} {label}
                        </span>
                        <span style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 800,
                          fontSize:   "var(--text-lg)",
                          color:      value > 0 ? "var(--success)" : "var(--ink-muted)",
                        }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── User table ─────────────────────────────────────────────────── */}
        <SectionLabel>All Users</SectionLabel>

        {/* Role filter pills */}
        {!loadingUsers && (
          <div style={{
            display:       "flex",
            gap:           "var(--space-2)",
            flexWrap:      "wrap",
            marginBottom:  "var(--space-4)",
          }}>
            {(["ALL", ...ROLES] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                style={{
                  padding:      "2px 12px",
                  borderRadius: "var(--radius-full)",
                  border:       "1px solid var(--border-medium)",
                  background:   roleFilter === r ? "var(--saffron-glow)" : "transparent",
                  color:        roleFilter === r
                    ? "var(--saffron)"
                    : r === "ALL" ? "var(--ink-muted)" : ROLE_COLOR[r as Role],
                  fontSize:     "var(--text-xs)",
                  fontWeight:   600,
                  cursor:       "pointer",
                  transition:   "all var(--transition-fast)",
                }}
              >
                {r === "ALL"
                  ? `All (${users.length})`
                  : `${r} (${countByRole(r as Role)})`}
              </button>
            ))}
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loadingUsers ? (
            <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 44, borderRadius: "var(--radius-sm)" }} />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">👥</div>
              <h3 className="empty-state__title">No users found</h3>
              <p className="empty-state__message">
                {roleFilter !== "ALL"
                  ? `No ${roleFilter} users in the system.`
                  : "No users yet."}
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
                      color:      "var(--ink-muted)",
                      fontFamily: "var(--font-display)",
                      fontSize:   "var(--text-xs)",
                    }}>
                      #{u.id}
                    </td>
                    <td style={{ fontWeight: 500, color: "var(--ink-primary)" }}>
                      {u.username}
                    </td>
                    <td>
                      <span className={`badge ${ROLE_BADGE[u.role]}`}>
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
