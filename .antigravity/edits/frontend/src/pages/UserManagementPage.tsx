import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import TopBar from '../components/TopBar';

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
};

type UserRow = {
  id: number;
  username: string;
  role: string;
  public_id?: string;
};

const UserManagementPage: React.FC = () => {
  const auth = useAuth();
  const myRole = auth.user?.role ?? "STUDENT";

  const [codes, setCodes] = useState<JoinCode[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [codesData, usersData] = await Promise.all([
          apiGet<JoinCode[]>("/accounts/join-codes/"),
          apiGet<UserRow[]>("/accounts/users/"),
        ]);
        setCodes(codesData || []);
        setUsers(usersData || []);
      } catch (err) {
        console.error("User management load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
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
      <TopBar title="Identity Registry" />
      <main className="page-content page-enter">
        {/* Editorial Header */}
        <section className="editorial-header animate-fade-up">
           <div className="role-tag role-tag--admin" style={{ marginBottom: 'var(--space-4)' }}>
             🛂 Access Controller
           </div>
           <h1 className="text-gradient" style={{ fontSize: 'clamp(28px, 6vw, 40px)', lineHeight: 1.1, marginBottom: 'var(--space-1)' }}>
             Identity & Access<br/>
             Governance.
           </h1>
           <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-lg)', maxWidth: '500px' }}>
             Govern the roles and entry points for all institutional entities.
           </p>
        </section>

        {/* Stats Row */}
        <div className="stat-grid" style={{ marginBottom: 'var(--space-12)' }}>
           <div className="glass-card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 800 }}>TOTAL ENTITIES</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900 }}>{users.length}</div>
           </div>
           <div className="glass-card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 800 }}>ACTIVE VECTORS</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900 }}>{codes.filter(c => c.is_valid).length}</div>
           </div>
        </div>

        {/* Dynamic Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
           <h2 className="section-header__title" style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>REGISTRY LEDGER</h2>
           <button className="btn--primary" style={{ fontSize: '12px' }}>+ INITIALIZE JOIN VECTOR</button>
        </div>

        {/* Users Table */}
        <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
           <table className="data-table">
             <thead>
               <tr>
                 <th>ENTITY</th>
                 <th>ROLE</th>
                 <th>SCOPE</th>
                 <th>IDENTIFIER</th>
               </tr>
             </thead>
             <tbody>
               {users.map((u, i) => (
                 <tr key={u.id} className="page-enter" style={{ animationDelay: `${i * 20}ms` }}>
                   <td>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div className={`role-avatar role-avatar--${u.role.toLowerCase()}`} />
                        <span style={{ fontWeight: 700 }}>{u.username}</span>
                     </div>
                   </td>
                   <td><div className={`role-tag role-tag--${u.role.toLowerCase()}`} style={{ fontSize: '8px' }}>{u.role}</div></td>
                   <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Punjab Digital Framework</td>
                   <td style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-dim)' }}>{u.public_id || `#ID-${u.id}`}</td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>

        {/* Codes Section */}
        <div style={{ marginTop: 'var(--space-12)' }}>
           <h2 className="section-header__title" style={{ fontSize: 'var(--text-sm)', opacity: 0.6, marginBottom: 'var(--space-6)' }}>PROVISIONED VECTORS</h2>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
             {codes.filter(c => c.is_valid).map((c, i) => (
               <div key={c.id} className="glass-card page-enter" style={{ padding: 'var(--space-5)', animationDelay: `${i * 50}ms` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <code style={{ fontSize: 'var(--text-base)', fontWeight: 900, fontFamily: 'monospace', color: 'var(--brand-primary)' }}>{c.code}</code>
                    <div className={`role-tag role-tag--${c.role.toLowerCase()}`} style={{ fontSize: '7px' }}>{c.role}</div>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    EXP: {new Date(c.expires_at).toLocaleDateString()}
                  </div>
               </div>
             ))}
           </div>
        </div>
      </main>
    </div>
  );
};

export default UserManagementPage;
