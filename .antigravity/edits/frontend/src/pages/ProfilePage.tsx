import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getMySummary, type MySummary } from "../services/gamification";
import { getStudentGrades, type GradeEntry } from "../services/gradebook";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

const ProfilePage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const user = auth.user;

  const [gamification, setGamification] = useState<MySummary | null>(null);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === "STUDENT" && user.id) {
      Promise.all([
        getMySummary(),
        getStudentGrades(user.id)
      ]).then(([s, g]) => {
        setGamification(s);
        setGrades(g.entries);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) return <div className="page-shell"><TopBar /><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="btn__spinner" /></main></div>;

  return (
    <div className="page-shell">
      <TopBar title="Scholar Dossier" />
      <main className="page-content page-enter has-bottom-nav" style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-10) var(--space-6)' }}>
        
        {/* Dossier Header */}
        <section className="glass-card" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-8)', display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
           <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-elevated)', border: '2px solid var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 900, color: 'var(--brand-primary)' }}>
              {user?.username.slice(0, 1).toUpperCase()}
           </div>
           <div style={{ flex: 1 }}>
              <div className={`role-tag role-tag--${user?.role.toLowerCase()}`} style={{ marginBottom: '8px' }}>{user?.role}</div>
              <h1 className="text-gradient" style={{ fontSize: 'var(--text-3xl)', marginBottom: '4px' }}>{user?.username}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{user?.email || 'No institutional email provisioned'}</p>
           </div>
           <button className="btn--ghost" onClick={() => navigate('/login')}>TERMINATE SESSION</button>
        </section>

        {/* Gamification Stats */}
        {user?.role === "STUDENT" && gamification && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
             <div className="glass-card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 800 }}>REPUTATION</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--role-principal)' }}>{gamification.total_points}</div>
             </div>
             <div className="glass-card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 800 }}>CONSISTENCY</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--role-student)' }}>{gamification.current_streak}D</div>
             </div>
             <div className="glass-card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 800 }}>BADGES</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--role-teacher)' }}>{gamification.badge_count}</div>
             </div>
          </div>
        )}

        {/* Identity Registry */}
        <section className="glass-card" style={{ padding: '0 var(--space-8)', marginBottom: 'var(--space-8)' }}>
           <div style={{ padding: '16px 0', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>PUBLIC IDENTIFIER</span>
              <code style={{ fontSize: '11px', color: 'var(--brand-primary)' }}>{user?.public_id || 'O-992-UX'}</code>
           </div>
           <div style={{ padding: '16px 0', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>INSTITUTION</span>
              <span style={{ fontSize: '11px' }}>{user?.institution || 'Global Network'}</span>
           </div>
           <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>DISTRICT VECTORE</span>
              <span style={{ fontSize: '11px' }}>{user?.district || 'Central Command'}</span>
           </div>
        </section>

        {/* Grade Ledger */}
        {user?.role === "STUDENT" && grades.length > 0 && (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
             <table className="data-table">
                <thead>
                   <tr>
                      <th>DOMAIN</th>
                      <th>ASSESSMENT</th>
                      <th>MASTERY</th>
                   </tr>
                </thead>
                <tbody>
                   {grades.map((g, i) => (
                      <tr key={i}>
                         <td><div className="role-tag role-tag--teacher" style={{ fontSize: '7px' }}>{g.subject}</div></td>
                         <td style={{ fontSize: '11px' }}>{g.category}</td>
                         <td style={{ fontWeight: 800, color: g.percentage > 70 ? 'var(--role-student)' : 'var(--role-teacher)' }}>{g.percentage}%</td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  );
};

export default ProfilePage;
