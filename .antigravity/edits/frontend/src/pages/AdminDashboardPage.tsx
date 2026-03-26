import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import type { Role } from "../auth/authTypes";
import { 
  BookOpen, 
  Key, 
  Users, 
  Megaphone,
  Monitor,
  ShieldCheck,
  Terminal
} from 'lucide-react';
import './AdminDashboardPage.css';

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

const ROLE_COLOR: Record<Role, string> = {
  STUDENT:   "var(--role-student)",
  TEACHER:   "var(--role-teacher)",
  PRINCIPAL: "var(--role-principal)",
  OFFICIAL:  "var(--role-official)",
  ADMIN:     "var(--role-admin)",
};

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
          apiGet<UserRow[]>("/accounts/users/"),
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
        <main className="page-content has-bottom-nav">
          <div className="skeleton-line skeleton-line--title animate-pulse-subtle" style={{ height: '40px', marginBottom: '20px' }} />
          <div className="skeleton-stack animate-pulse-subtle">
             <div className="skeleton-box" style={{ height: '300px' }} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title="Technical Oversight" />
      <main className="page-content page-enter has-bottom-nav admin-dash-layout">

        {/* Command Center Title */}
        <section className="command-center animate-fade-up">
           <h2 className="display-sm text-gradient">COMMAND CENTER</h2>
           <p className="hero-subtitle">Neural hub for system-wide telemetry and administrative oversight.</p>
        </section>

        {/* Quick Actions */}
        <section className="quick-nav-grid animate-fade-up" style={{ animationDelay: '50ms' }}>
           <div className="glass-card quick-link-card" onClick={() => navigate("/admin/content")} 
                style={{ borderBottomColor: 'var(--brand-primary)' }}>
              <div className="ql-icon"><BookOpen size={28} color="var(--brand-primary)" /></div>
              <div className="ql-title" style={{ color: 'var(--brand-primary)' }}>CONTENT</div>
              <div className="ql-desc">Courses, units, and evaluation benchmarks.</div>
           </div>
           
           <div className="glass-card quick-link-card" onClick={() => navigate("/admin/join-codes")}
                style={{ borderBottomColor: 'var(--role-principal)' }}>
              <div className="ql-icon"><Key size={28} color="var(--role-principal)" /></div>
              <div className="ql-title" style={{ color: 'var(--role-principal)' }}>JOIN CODES</div>
              <div className="ql-desc">Registration cryptographic tokens and access keys.</div>
           </div>

           <div className="glass-card quick-link-card" onClick={() => navigate("/admin/users")}
                style={{ borderBottomColor: 'var(--role-official)' }}>
              <div className="ql-icon"><Users size={28} color="var(--role-official)" /></div>
              <div className="ql-title" style={{ color: 'var(--role-official)' }}>USER LOGS</div>
              <div className="ql-desc">Full spectrum profile and permission management.</div>
           </div>

           <div className="glass-card quick-link-card" onClick={() => navigate("/notifications")}
                style={{ borderBottomColor: 'var(--role-admin)' }}>
              <div className="ql-icon"><Megaphone size={28} color="var(--role-admin)" /></div>
              <div className="ql-title" style={{ color: 'var(--role-admin)' }}>BROADCAST</div>
              <div className="ql-desc">System-wide neural announcements and alerts.</div>
           </div>
        </section>

        {/* System Overview Stats */}
        <h3 className="command-title animate-fade-up" style={{ animationDelay: '100ms' }}>
          <Monitor size={16} color="var(--role-admin)" /> SYSTEM OVERVIEW
        </h3>
        
        <div className="stat-nexus-grid animate-fade-up" style={{ animationDelay: '150ms' }}>
           <div className="glass-card stat-tile">
              <span className="stat-tile__label">TOTAL NODES</span>
              <span className="stat-tile__val">{stats?.users.total ?? 0}</span>
           </div>
           <div className="glass-card stat-tile">
              <span className="stat-tile__label" style={{ color: 'var(--role-student)' }}>STUDENTS</span>
              <span className="stat-tile__val" style={{ color: 'var(--role-student)' }}>{stats?.users.students ?? 0}</span>
           </div>
           <div className="glass-card stat-tile">
              <span className="stat-tile__label" style={{ color: 'var(--role-teacher)' }}>TEACHERS</span>
              <span className="stat-tile__val" style={{ color: 'var(--role-teacher)' }}>{stats?.users.teachers ?? 0}</span>
           </div>
           <div className="glass-card stat-tile">
              <span className="stat-tile__label" style={{ color: 'var(--role-principal)' }}>PRINCIPALS</span>
              <span className="stat-tile__val" style={{ color: 'var(--role-principal)' }}>{stats?.users.principals ?? 0}</span>
           </div>
           <div className="glass-card stat-tile">
              <span className="stat-tile__label" style={{ color: 'var(--role-official)' }}>OFFICIALS</span>
              <span className="stat-tile__val" style={{ color: 'var(--role-official)' }}>{stats?.users.officials ?? 0}</span>
           </div>
           <div className="glass-card stat-tile">
              <span className="stat-tile__label" style={{ color: 'var(--brand-primary)' }}>SESSIONS</span>
              <span className="stat-tile__val" style={{ color: 'var(--brand-primary)' }}>{stats?.active_sessions ?? 0}</span>
           </div>
        </div>

        {/* Content & Activity Hub */}
        <section className="content-activity-nexus animate-fade-up" style={{ animationDelay: '200ms' }}>
           <div className="glass-card nexus-well">
              <div className="well-title">CONTENT DISTRIBUTION</div>
              <div className="well-list">
                 <div className="well-item">
                    <span className="item-label">Atomic Courses</span>
                    <span className="item-val">{stats?.content.courses ?? 0}</span>
                 </div>
                 <div className="well-item">
                    <span className="item-label">Knowledge Units</span>
                    <span className="item-val">{stats?.content.lessons ?? 0}</span>
                 </div>
                 <div className="well-item">
                    <span className="item-label">Assessments Active</span>
                    <span className="item-val">{stats?.content.published_assessments ?? 0}</span>
                 </div>
              </div>
           </div>

           <div className="glass-card nexus-well">
              <div className="well-title">TELEMETRY: TODAY</div>
              <div className="well-list">
                 <div className="well-item">
                    <span className="item-label"><BookOpen size={12} /> Units Completed</span>
                    <span className="item-val" style={{ color: (stats?.activity.lessons_completed_today ?? 0) > 0 ? 'var(--role-student)' : 'var(--text-dim)' }}>
                       {stats?.activity.lessons_completed_today ?? 0}
                    </span>
                 </div>
                 <div className="well-item">
                    <span className="item-label"><ShieldCheck size={12} /> Submissions</span>
                    <span className="item-val" style={{ color: (stats?.activity.assessments_submitted_today ?? 0) > 0 ? 'var(--role-student)' : 'var(--text-dim)' }}>
                       {stats?.activity.assessments_submitted_today ?? 0}
                    </span>
                 </div>
                 <div className="well-item">
                    <span className="item-label"><Megaphone size={12} /> Broadcasts Pulse</span>
                    <span className="item-val">{stats?.activity.notifications_sent_today ?? 0}</span>
                 </div>
              </div>
           </div>
        </section>

        {/* User Table Nexus */}
        <section className="user-table-nexus animate-fade-up" style={{ animationDelay: '250ms' }}>
           <h3 className="command-title"><Terminal size={14} color="var(--role-admin)" /> ACCESS LOGS</h3>
           
           <div className="filter-pills">
              <button className={`filter-pill ${roleFilter === 'ALL' ? 'active' : ''}`} onClick={() => setRoleFilter('ALL')}>
                 ALL ({users.length})
              </button>
              {ROLES.map(r => (
                <button key={r} onClick={() => setRoleFilter(r)}
                        className={`filter-pill ${roleFilter === r ? 'active' : ''}`}
                        style={{ color: roleFilter === r ? '#fff' : ROLE_COLOR[r] }}>
                   {r} ({countByRole(r)})
                </button>
              ))}
           </div>

           <div className="glass-card admin-grid-card">
              <table className="admin-table">
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
                         <td className="id-cell">#{(u.id).toString().padStart(4, '0')}</td>
                         <td className="user-cell">{u.username}</td>
                         <td>
                            <div className="role-tag" style={{ color: ROLE_COLOR[u.role], background: `${ROLE_COLOR[u.role]}11`, border: `1px solid ${ROLE_COLOR[u.role]}33` }}>
                               {u.role}
                            </div>
                         </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
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
