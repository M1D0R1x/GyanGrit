import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import type { Role } from "../auth/authTypes";

// pages.AdminDashboardPage

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

const ROLE_COLOR: Record<Role, string> = {
  STUDENT:   "var(--role-student)",
  TEACHER:   "var(--role-teacher)",
  PRINCIPAL: "var(--role-principal)",
  OFFICIAL:  "var(--role-official)",
  ADMIN:     "var(--role-admin)",
};

// ── Page ──────────────────────────────────────────────────────────────────────

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [users, setUsers]       = useState<UserRow[]>([]);
  const [stats, setStats]       = useState<SystemStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [u, s] = await Promise.all([
          // Users list
          apiGet<UserRow[]>("/accounts/users/"),
          // System stats — ADMIN-only endpoint
          apiGet<SystemStats>("/accounts/system-stats/")
        ]);
        if (!cancelled) {
          setUsers(u ?? []);
          setStats(s);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setStatsError(true);
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  const ROLES: Role[] = ["STUDENT", "TEACHER", "PRINCIPAL", "OFFICIAL", "ADMIN"];
  const countByRole = (role: Role) => users.filter((u) => u.role === role).length;
  const filteredUsers = roleFilter === "ALL" ? users : users.filter((u) => u.role === roleFilter);

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar title="Admin Terminal" />
        <main className="page-content has-bottom-nav" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="btn__spinner" />
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title="Technical Oversight" />
      <main className="page-content page-enter has-bottom-nav" style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--space-10) var(--space-6)' }}>

        {/* ── Quick nav ──────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
           <h2 className="text-gradient" style={{ fontSize: 'var(--text-3xl)', margin: 0 }}>COMMAND CENTER</h2>
           <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>Neural hub for system-wide telemetry and administrative oversight.</p>
        </section>

        {/* Quick Actions */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-10)' }}>
           <div className="glass-card page-enter" onClick={() => navigate("/admin/content")} role="button" tabIndex={0}
                style={{ borderBottom: '2px solid var(--brand-primary)', cursor: 'pointer', padding: 'var(--space-5)' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>📖</div>
              <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--brand-primary)', marginBottom: '6px' }}>CONTENT</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Courses, units, and evaluation benchmarks.</div>
           </div>
           
           <div className="glass-card page-enter" onClick={() => navigate("/admin/join-codes")} role="button" tabIndex={0}
                style={{ borderBottom: '2px solid var(--role-principal)', cursor: 'pointer', padding: 'var(--space-5)', animationDelay: '50ms' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>🔑</div>
              <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--role-principal)', marginBottom: '6px' }}>JOIN CODES</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Registration cryptographic tokens and access keys.</div>
           </div>

           <div className="glass-card page-enter" onClick={() => navigate("/admin/users")} role="button" tabIndex={0}
                style={{ borderBottom: '2px solid var(--role-official)', cursor: 'pointer', padding: 'var(--space-5)', animationDelay: '100ms' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>👥</div>
              <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--role-official)', marginBottom: '6px' }}>USER LOGS</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Full spectrum profile and permission management.</div>
           </div>

           <div className="glass-card page-enter" onClick={() => navigate("/notifications")} role="button" tabIndex={0}
                style={{ borderBottom: '2px solid var(--role-admin)', cursor: 'pointer', padding: 'var(--space-5)', animationDelay: '150ms' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>📢</div>
              <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--role-admin)', marginBottom: '6px' }}>BROADCAST</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>System-wide neural announcements and alerts.</div>
           </div>
        </section>

        {statsError && <div className="alert alert--error" style={{ marginBottom: "var(--space-6)" }}>Telemetry Sync Error</div>}

        {/* ── Live system stats ──────────────────────────────────────────── */}
        <h3 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🖥️</span> SYSTEM OVERVIEW
        </h3>
        
        {/* User counts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
           <div className="glass-card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>TOTAL NODES</span>
              <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>{stats?.users.total ?? 0}</span>
           </div>
           <div className="glass-card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--role-student)', display: 'block', marginBottom: '8px' }}>STUDENTS</span>
              <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--role-student)' }}>{stats?.users.students ?? 0}</span>
           </div>
           <div className="glass-card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--role-teacher)', display: 'block', marginBottom: '8px' }}>TEACHERS</span>
              <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--role-teacher)' }}>{stats?.users.teachers ?? 0}</span>
           </div>
           <div className="glass-card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--role-principal)', display: 'block', marginBottom: '8px' }}>PRINCIPALS</span>
              <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--role-principal)' }}>{stats?.users.principals ?? 0}</span>
           </div>
           <div className="glass-card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--role-official)', display: 'block', marginBottom: '8px' }}>OFFICIALS</span>
              <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--role-official)' }}>{stats?.users.officials ?? 0}</span>
           </div>
           <div className="glass-card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--brand-primary)', display: 'block', marginBottom: '8px' }}>SESSIONS</span>
              <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--brand-primary)' }}>{stats?.active_sessions ?? 0}</span>
           </div>
        </div>

        {/* Content + today's activity in two groups */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-10)' }}>
           {/* Content */}
           <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>CONTENT DISTRIBUTION</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Atomic Courses</span>
                    <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>{stats?.content.courses ?? 0}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Knowledge Units</span>
                    <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>{stats?.content.lessons ?? 0}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Assessments Active</span>
                    <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>{stats?.content.published_assessments ?? 0}</span>
                 </div>
              </div>
           </div>

           {/* Today */}
           <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>TELEMETRY: TODAY</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}><span>📖</span> Units Completed</span>
                    <span style={{ fontSize: '20px', fontWeight: 900, color: (stats?.activity.lessons_completed_today ?? 0) > 0 ? 'var(--role-student)' : 'var(--text-primary)' }}>
                       {stats?.activity.lessons_completed_today ?? 0}
                    </span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}><span>🛡️</span> Submissions</span>
                    <span style={{ fontSize: '20px', fontWeight: 900, color: (stats?.activity.assessments_submitted_today ?? 0) > 0 ? 'var(--role-student)' : 'var(--text-primary)' }}>
                       {stats?.activity.assessments_submitted_today ?? 0}
                    </span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}><span>📢</span> Broadcasts Pulse</span>
                    <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>{stats?.activity.notifications_sent_today ?? 0}</span>
                 </div>
              </div>
           </div>
        </section>

        {/* ── User table ─────────────────────────────────────────────────── */}
        <section>
           <h3 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <span>💻</span> ACCESS LOGS
           </h3>
           
           {/* Role filter pills */}
           <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
              <button 
                onClick={() => setRoleFilter('ALL')} 
                style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 800, borderRadius: '4px', border: '1px solid var(--border-default)', background: roleFilter === 'ALL' ? 'var(--brand-primary)' : 'transparent', color: roleFilter === 'ALL' ? '#000' : 'var(--text-muted)' }}
              >
                 ALL ({users.length})
              </button>
              {ROLES.map(r => (
                <button 
                  key={r} 
                  onClick={() => setRoleFilter(r)}
                  style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 800, borderRadius: '4px', border: `1px solid ${ROLE_COLOR[r]}44`, background: roleFilter === r ? ROLE_COLOR[r] : 'transparent', color: roleFilter === r ? '#000' : ROLE_COLOR[r] }}
                >
                   {r} ({countByRole(r)})
                </button>
              ))}
           </div>

           <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                 <thead>
                    <tr>
                       <th>NODAL ID</th>
                       <th>IDENTIFIER</th>
                       <th>PROTOCOL ROLE</th>
                    </tr>
                 </thead>
                 <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id}>
                         <td style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>#{(u.id).toString().padStart(4, '0')}</td>
                         <td style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{u.username}</td>
                         <td>
                            <div style={{ display: 'inline-block', fontSize: '9px', fontWeight: 800, padding: '4px 8px', borderRadius: '4px', color: ROLE_COLOR[u.role], background: `${ROLE_COLOR[u.role]}11`, border: `1px solid ${ROLE_COLOR[u.role]}33` }}>
                               {u.role}
                            </div>
                         </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)', fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em' }}>
                           DATA VOID: No nodes detected for filter protocol.
                        </td>
                      </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </section>

      </main>
      <BottomNav />
    </div>
  );
};

export default AdminDashboardPage;
