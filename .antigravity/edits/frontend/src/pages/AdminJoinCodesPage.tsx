import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../services/api';
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
  created_by: string | null;
};

const AdminJoinCodesPage: React.FC = () => {
  const [codes, setCodes] = useState<JoinCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("ALL");

  useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<JoinCode[]>("/accounts/join-codes/");
        setCodes(data || []);
      } catch (err) {
        console.error("Join codes load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = codes.filter(c => filterRole === "ALL" || c.role === filterRole);

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
      <TopBar title="Access Vectors" />
      <main className="page-content page-enter">
        {/* Editorial Header */}
        <section className="editorial-header animate-fade-up">
           <div className="role-tag role-tag--admin" style={{ marginBottom: 'var(--space-4)' }}>
             🔑 Auth Orchestrator
           </div>
           <h1 className="text-gradient" style={{ fontSize: 'clamp(28px, 6vw, 40px)', lineHeight: 1.1, marginBottom: 'var(--space-1)' }}>
             Join Code<br/>
             Provisioning.
           </h1>
           <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-lg)', maxWidth: '500px' }}>
             Manage the entry points for the GyanGrit institutional framework.
           </p>
        </section>

        {/* Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
           <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {["ALL", "STUDENT", "TEACHER", "PRINCIPAL", "OFFICIAL"].map(r => (
                <button 
                  key={r} 
                  className={`btn--${filterRole === r ? 'primary' : 'ghost'}`} 
                  style={{ fontSize: '10px', padding: 'var(--space-2) var(--space-4)' }}
                  onClick={() => setFilterRole(r)}
                >
                  {r}
                </button>
              ))}
           </div>
           <button className="btn--primary" style={{ fontSize: '12px' }}>+ GENERATE NEW VECTORS</button>
        </div>

        {/* Codes Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
          {filtered.map((c, i) => (
            <div key={c.id} className="glass-card page-enter" style={{ padding: 'var(--space-5)', border: `1px solid ${c.is_valid ? 'var(--role-student)22' : 'var(--glass-border)'}`, animationDelay: `${i * 50}ms` }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                  <code style={{ fontSize: 'var(--text-xl)', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '0.1em', color: c.is_valid ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                    {c.code.slice(0, 4)}-{c.code.slice(4, 8)}
                  </code>
                  <div className={`role-tag role-tag--${c.role.toLowerCase()}`} style={{ fontSize: '8px' }}>{c.role}</div>
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Scope</div>
                    <div style={{ fontSize: '12px', fontWeight: 700 }}>{c.institution || c.district || 'Global'}</div>
                    {c.section && <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Section {c.section}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: c.is_valid ? 'var(--role-teacher)' : 'var(--role-admin)' }}>
                      {c.is_valid ? 'ACTIVE' : 'EXPIRED'}
                    </div>
                    <div style={{ fontSize: '8px', color: 'var(--text-dim)' }}>EXP: {new Date(c.expires_at).toLocaleDateString()}</div>
                  </div>
               </div>
               
               {c.is_valid && (
                 <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
                    <button className="btn--ghost" style={{ flex: 1, fontSize: '10px', color: 'var(--brand-primary)' }}>COPY VECTOR</button>
                    <button className="btn--ghost" style={{ flex: 1, fontSize: '10px', color: 'var(--role-teacher)' }}>EMAIL RECIPIENT</button>
                 </div>
               )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="empty-state glass-card" style={{ padding: 'var(--space-12)', gridColumn: '1 / -1' }}>
               <div style={{ fontSize: '40px', marginBottom: 'var(--space-4)' }}>🕳️</div>
               <h3 className="empty-state__title">Zero Vectors Found</h3>
               <p className="empty-state__message">No join codes currently exist within this administrative scope.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminJoinCodesPage;
