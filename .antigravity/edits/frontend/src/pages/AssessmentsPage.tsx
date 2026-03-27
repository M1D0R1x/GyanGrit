import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../services/api';
import { type AssessmentWithStatus } from '../services/assessments';
import { assessmentPath } from '../utils/slugs';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';

// pages.AssessmentsPage

const CircularScore: React.FC<{ pct: number; size?: number }> = ({ pct, size = 44 }) => {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * pct;
  const color = pct >= 0.8 ? 'var(--success)' : pct >= 0.5 ? 'var(--warning)' : 'var(--error)';

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth={4} />
        <circle 
          cx={size/2} cy={size/2} r={r} 
          fill="none" 
          stroke={color}
          strokeWidth={4}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <span style={{ color, fontSize: 13, fontWeight: 900, fontFamily: 'var(--font-display)' }}>{Math.round(pct * 100)}</span>
    </div>
  );
};

const AssessmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<AssessmentWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "pending">("all");

  useEffect(() => {
    let cancelled = false;
    apiGet<AssessmentWithStatus[]>("/assessments/my/")
      .then(data => { if (!cancelled) setAssessments(data); })
      .catch(() => { if (!cancelled) setError("Failed to load assessments."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const subjects = ["all", ...Array.from(new Set(assessments.map((a) => a.subject))).sort()];
  const filtered = assessments.filter((a) => {
    const matchSubject = subjectFilter === "all" || a.subject === subjectFilter;
    const matchStatus  = statusFilter === "all" ? true : statusFilter === "passed" ? a.passed : !a.passed;
    return matchSubject && matchStatus;
  });

  const attempted = assessments.filter((a) => (a.attempt_count ?? 0) > 0).length;
  const passed    = assessments.filter((a) => a.passed).length;

  if (loading) return (
    <div className="page-shell">
      <TopBar title="Assessments" />
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn__spinner" style={{ width: 40, height: 40 }} />
      </div>
      <BottomNav />
    </div>
  );

  return (
    <div className="page-shell">
      <TopBar title="Assessments" />
      
      <main className="page-content page-enter has-bottom-nav" style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
        
        {/* Header */}
        <header style={{ marginBottom: 'var(--space-8)' }}>
           <div style={{ display: 'inline-block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', padding: '4px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--role-student)', border: '1px solid rgba(56, 189, 248, 0.2)', marginBottom: '16px' }}>🏆 EVALUATION CENTER</div>
           <h1 className="text-gradient" style={{ fontSize: '32px', margin: 0 }}>My Assessments.</h1>
           <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.4 }}>Test your mastery across subjects and track your progress in real-time.</p>
        </header>

        {/* Dynamic Telemetry Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
           <div className="glass-card page-enter" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', display: 'block' }}>{assessments.length}</span>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>TOTAL</span>
           </div>
           <div className="glass-card page-enter" style={{ padding: 'var(--space-4)', textAlign: 'center', animationDelay: '50ms' }}>
              <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--brand-primary)', display: 'block' }}>{attempted}</span>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>ATTEMPTED</span>
           </div>
           <div className="glass-card page-enter" style={{ padding: 'var(--space-4)', textAlign: 'center', borderBottom: '2px solid var(--success)', animationDelay: '100ms' }}>
              <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--success)', display: 'block' }}>{passed}</span>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>PASSED</span>
           </div>
        </div>

        {/* History shortcut */}
        <button className="glass-card page-enter" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', marginBottom: 'var(--space-8)', cursor: 'pointer', border: '1px solid var(--brand-primary)', background: 'rgba(59, 130, 246, 0.05)', animationDelay: '150ms' }} onClick={() => navigate('/assessments/history')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: 800, color: 'var(--brand-primary)', letterSpacing: '0.05em' }}>
            <span style={{ fontSize: '20px' }}>🕒</span>
            REVIEW PREVIOUS ATTEMPTS
          </div>
          <span style={{ color: 'var(--brand-primary)', fontSize: '18px' }}>➔</span>
        </button>

        {/* Subject filter */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: 'var(--space-8)' }}>
           <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
             {subjects.map(s => (
               <button 
                 key={s} 
                 style={{ whiteSpace: 'nowrap', padding: '8px 16px', fontSize: '12px', fontWeight: 800, letterSpacing: '0.05em', borderRadius: '100px', border: subjectFilter === s ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)', background: subjectFilter === s ? 'var(--brand-primary)' : 'var(--bg-surface)', color: subjectFilter === s ? '#000' : 'var(--text-secondary)', transition: 'all 0.2s', cursor: 'pointer' }}
                 onClick={() => setSubjectFilter(s)}
               >
                 {s === 'all' ? 'All Subjects' : s}
               </button>
             ))}
           </div>

           {/* Status tabs */}
           <div className="glass-card" style={{ padding: '4px', display: 'flex', borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
             {(['all', 'pending', 'passed'] as const).map(f => (
               <button 
                 key={f} 
                 style={{ flex: 1, padding: '8px 0', fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', borderRadius: '4px', background: statusFilter === f ? 'var(--bg-surface)' : 'transparent', color: statusFilter === f ? 'var(--text-primary)' : 'var(--text-muted)', border: statusFilter === f ? '1px solid var(--border-default)' : '1px solid transparent', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}
                 onClick={() => setStatusFilter(f)}
               >
                 {f}
               </button>
             ))}
           </div>
        </section>

        {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.length === 0 ? (
            <div className="glass-card page-enter" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px', filter: 'grayscale(1) opacity(0.3)' }}>⚠️</span>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No assessments matching your criteria.</p>
            </div>
          ) : filtered.map((a, i) => {
            const isAttempted = (a.attempt_count ?? 0) > 0;
            const pct = (a.best_score || 0) / (a.total_marks || 1);
            
            // Build human-readable URL: /assessments/:grade/:subject/:id
            return (
              <div 
                key={a.id} 
                className="glass-card page-enter"
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s', borderLeft: a.passed ? '4px solid var(--success)' : '1px solid var(--glass-border)', animationDelay: `${i * 40}ms` }}
                onClick={() => navigate(assessmentPath(a.grade, a.subject, a.id))}
              >
                <div style={{ flexShrink: 0 }}>
                  {isAttempted ? <CircularScore pct={pct} /> : <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px dashed var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-elevated)', color: 'var(--brand-primary)', border: '1px solid var(--border-subtle)' }}>{a.subject}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Class {a.grade}</span>
                  </div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span>{a.total_marks} Marks</span>
                    <span>·</span>
                    <span>{a.attempt_count} Attempts</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                   {a.passed ? (
                     <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ fontSize: '16px' }}>✅</span> Mastered</span>
                   ) : (
                     <span style={{ color: 'var(--text-muted)', fontSize: '16px' }}>➔</span>
                   )}
                </div>
              </div>
            );
          })}
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default AssessmentsPage;
