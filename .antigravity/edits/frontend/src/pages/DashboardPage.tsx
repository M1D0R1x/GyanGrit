import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getMySummary, type MySummary } from '../services/gamification';
import { getStudentEnrollments, type Enrollment } from '../services/course';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<MySummary | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [sum, enr] = await Promise.all([
          getMySummary(),
          getStudentEnrollments()
        ]);
        setSummary(sum);
        setEnrollments(enr);
      } catch (err) {
        console.error("Dashboard load failed:", err);
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
      <TopBar />
      <main className="page-content page-enter has-bottom-nav">
        {/* Editorial Welcome Section */}
        <section className="editorial-header animate-fade-up">
          <div className="role-tag role-tag--student" style={{ marginBottom: 'var(--space-4)' }}>
            ✨ Scholarly Explorer
          </div>
          <h1 className="text-gradient" style={{ fontSize: 'clamp(32px, 8vw, 64px)', lineHeight: 1.1, marginBottom: 'var(--space-2)' }}>
            Welcome back,<br/>
            {user?.full_name?.split(' ')[0] || 'Scholar'}.
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-lg)', maxWidth: '500px' }}>
            Your journey continues. You've earned <strong>{summary?.total_points || 0} XP</strong> so far. Keep pushing boundaries.
          </p>
        </section>

        {/* Gamification High-Density Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-12)' }}>
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-xl)', background: 'var(--brand-primary)12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              🎖️
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Rank</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, fontFamily: 'var(--font-display)' }}>Novice Sage</div>
            </div>
          </div>
          
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-xl)', background: 'var(--success)12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              ⚡
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Streak</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, fontFamily: 'var(--font-display)' }}>5 Days</div>
            </div>
          </div>
        </div>

        {/* Subjects Grid */}
        <div className="section-header">
           <h2 className="section-header__title" style={{ fontSize: 'var(--text-2xl)' }}>My Subjects</h2>
           <button className="btn--ghost" style={{ fontSize: 'var(--text-sm)', color: 'var(--brand-primary)' }} onClick={() => navigate('/courses')}>
             View All
           </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-8)' }}>
          {enrollments.map((enr) => (
            <div 
              key={enr.id} 
              className="glass-card" 
              style={{ cursor: 'pointer', padding: 'var(--space-8)' }}
              onClick={() => navigate(`/courses/${enr.grade}/${enr.subject_slug}`)}
            >
              <div style={{ 
                width: 48, height: 8, background: 'var(--brand-primary)', 
                borderRadius: 'var(--radius-full)', marginBottom: 'var(--space-6)',
                filter: 'drop-shadow(0 0 8px var(--brand-primary)88)' 
              }} />
              <h3 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>{enr.subject_name}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                Grade {enr.grade} • Part of your official curriculum.
              </p>
              <div className="progress-bar">
                <div className="progress-bar__fill" style={{ width: '45%' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>
                <span>45% COMPLETE</span>
                <span>12/30 LESSONS</span>
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default DashboardPage;
