import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../services/api';
import TopBar from '../components/TopBar';
import type { Role } from '../auth/authTypes';

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

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [userData, statData] = await Promise.all([
          apiGet<UserRow[]>("/accounts/users/"),
          apiGet<SystemStats>("/accounts/system-stats/")
        ]);
        setUsers(userData || []);
        setStats(statData || []);
      } catch (err) {
        console.error("Admin Dashboard load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return (
    <div className="page-shell">
      <TopBar />
      <main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn__spinner" style={{ width: 40, height: 40 }} />
      </main>
    </div>
  );

  return (
    <div className="page-shell">
      <TopBar title="System Nexus" />
      <main className="page-content page-enter">
        {/* Editorial Header */}
        <section className="editorial-header animate-fade-up">
           <div className="role-tag role-tag--admin" style={{ marginBottom: 'var(--space-4)' }}>
             ⚡ System Architect
           </div>
           <h1 className="text-gradient" style={{ fontSize: 'clamp(32px, 8vw, 48px)', lineHeight: 1.1, marginBottom: 'var(--space-2)' }}>
             GyanGrit<br/>
             Core Infrastructure.
           </h1>
           <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-lg)', maxWidth: '500px' }}>
             High-level system orchestrations and global data management.
           </p>
        </section>

        {/* Quick Nav Icons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-12)' }}>
          {[
            { icon: '📚', label: 'CONTENT', path: '/admin/content', color: 'var(--brand-primary)' },
            { icon: '🔑', label: 'JOIN CODES', path: '/admin/join-codes', color: 'var(--role-principal)' },
            { icon: '👥', label: 'USER MGMT', path: '/admin/users', color: 'var(--role-official)' },
            { icon: '🔔', label: 'BROADCAST', path: '/notifications', color: 'var(--role-admin)' },
          ].map((link) => (
            <div 
              key={link.label} 
              className="glass-card" 
              style={{ cursor: 'pointer', textAlign: 'center', padding: 'var(--space-6)', border: `1px solid ${link.color}22` }}
              onClick={() => navigate(link.path)}
            >
              <div style={{ fontSize: '32px', marginBottom: 'var(--space-2)' }}>{link.icon}</div>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.1em' }}>{link.label}</div>
            </div>
          ))}
        </div>

        {/* System Overview Stats */}
        <div className="section-header">
           <h2 className="section-header__title">Global Pulse</h2>
        </div>
        <div className="glass-card" style={{ marginBottom: 'var(--space-12)', padding: 'var(--space-8)', border: '1px solid var(--role-admin)22' }}>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-8)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 'var(--space-1)' }}>Total Users</div>
                <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, fontFamily: 'var(--font-display)' }}>{stats?.users.total || 0}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: 'var(--space-8)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 'var(--space-1)' }}>Live Sessions</div>
                <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--brand-primary)' }}>{stats?.active_sessions || 0}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: 'var(--space-8)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 'var(--space-1)' }}>Assessments</div>
                <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--role-teacher)' }}>{stats?.content.published_assessments || 0}</div>
              </div>
           </div>
        </div>

        {/* Recent Users Table */}
        <div className="section-header">
           <h2 className="section-header__title">Infrastructure Registry</h2>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>MAPPING ID</th>
                <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>RESOURCE NAME</th>
                <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>LEVEL</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 10).map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td style={{ padding: 'var(--space-4)', fontFamily: 'var(--font-display)', color: 'var(--text-dim)', fontSize: '12px' }}>#{u.id}</td>
                  <td style={{ padding: 'var(--space-4)', fontWeight: 700, color: 'var(--text-primary)' }}>{u.username}</td>
                  <td style={{ padding: 'var(--space-4)' }}>
                    <span className="role-tag" style={{ fontSize: '8px', background: 'var(--bg-elevated)' }}>{u.role}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: 'var(--space-4)', textAlign: 'center', background: 'var(--bg-elevated)', borderTop: '1px solid var(--glass-border)' }}>
             <button className="btn--ghost" style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-primary)', fontWeight: 800 }} onClick={() => navigate('/admin/users')}>
               EXPAND FULL REGISTRY →
             </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboardPage;
