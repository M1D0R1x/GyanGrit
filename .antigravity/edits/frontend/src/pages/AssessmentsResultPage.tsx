import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMySummary, type MySummary } from '../services/gamification';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';

interface ResultState {
  score:         number;
  passed:        boolean;
  total_marks:   number;
  pass_marks:    number;
  assessment_id: number;
}

const AssessmentsResultPage: React.FC = () => {
  const { state } = useLocation() as { state: ResultState | null };
  const navigate = useNavigate();
  const [summary, setSummary] = useState<MySummary | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMySummary();
        setSummary(data);
      } catch (err) { /* silent */ }
    }
    load();
  }, []);

  if (!state) return (
    <div className="page-shell">
      <TopBar />
      <main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         <div style={{ textAlign: 'center' }}>
            <h2>No Results Found</h2>
            <button className="btn--primary" onClick={() => navigate('/dashboard')}>Go Home</button>
         </div>
      </main>
    </div>
  );

  const percentage = state.total_marks ? Math.round((state.score / state.total_marks) * 100) : 0;
  const isPerfect = percentage === 100;

  return (
    <div className="page-shell">
      <TopBar title="Result" />
      <main className="page-content page-enter has-bottom-nav" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 'var(--space-12)' }}>
        
        <div className="glass-card animate-fade-up" style={{ width: '100%', maxWidth: '500px', textAlign: 'center', padding: 'var(--space-10)' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)', filter: 'drop-shadow(0 0 12px var(--brand-primary)44)' }}>
              {isPerfect ? '🏆' : state.passed ? '🌟' : '📚'}
            </div>

            <div style={{ 
              fontFamily: 'var(--font-display)', fontSize: '72px', fontWeight: 900, 
              background: state.passed ? 'linear-gradient(135deg, var(--success), #10b981)' : 'linear-gradient(135deg, var(--error), #ef4444)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              lineHeight: 1, marginBottom: 'var(--space-2)'
            }}>
              {percentage}%
            </div>

            <div style={{ 
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-xl)', 
              color: 'var(--text-primary)', marginBottom: 'var(--space-8)' 
            }}>
              {isPerfect ? 'Absolute Perfection!' : state.passed ? 'Assessment Passed' : 'Keep Learning!'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-1)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
               <div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>{state.score}</div>
                  <div style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>YOUR SCORE</div>
               </div>
               <div style={{ borderLeft: '1px solid var(--glass-border)', borderRight: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>{state.pass_marks}</div>
                  <div style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>PASS MARK</div>
               </div>
               <div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>{state.total_marks}</div>
                  <div style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>TOTAL</div>
               </div>
            </div>

            <div style={{ 
                display: 'flex', alignItems: 'center', gap: 'var(--space-4)', 
                padding: 'var(--space-5)', background: 'var(--brand-primary)12', 
                borderRadius: 'var(--radius-2xl)', border: '1px solid var(--brand-primary)22',
                marginBottom: 'var(--space-10)', textAlign: 'left'
            }}>
               <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  ⭐
               </div>
               <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>Points Gained</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>{summary ? `Total: ${summary.total_points} XP` : 'Building your legend...'}</div>
               </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
               <button className="btn--secondary" onClick={() => navigate('/dashboard')} style={{ borderRadius: 'var(--radius-lg)', fontWeight: 700 }}>
                  Review
               </button>
               <button className="btn--primary" onClick={() => navigate('/dashboard')} style={{ borderRadius: 'var(--radius-lg)', fontWeight: 800 }}>
                  Dashboard
               </button>
            </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default AssessmentsResultPage;
