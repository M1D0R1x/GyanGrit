import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  getTeacherStudentAssessments,
  type TeacherStudentDetailResponse,
} from '../services/teacherAnalytics';
import TopBar from '../components/TopBar';
import { 
  ArrowLeft, 
  CheckCircle, 
  Award,
  Calendar,
  Zap,
  Activity,
  ClipboardList
} from 'lucide-react';

const TeacherStudentDetailPage: React.FC = () => {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const prefix = location.pathname.startsWith('/principal') ? '/principal'
    : location.pathname.startsWith('/official') ? '/official'
    : '/teacher';

  const [data, setData] = useState<TeacherStudentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId || !studentId) return;
    getTeacherStudentAssessments(Number(classId), Number(studentId))
      .then(setData)
      .catch(err => console.error("Student assessments load failed:", err))
      .finally(() => setLoading(false));
  }, [classId, studentId]);

  if (loading && !data) return (
    <div className="page-shell">
      <TopBar />
      <main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn__spinner" style={{ width: 40, height: 40 }} />
      </main>
    </div>
  );

  const attempts = data?.attempts || [];
  const passCount = attempts.filter(a => a.passed).length;
  const totalAttempts = attempts.length;
  const avgScore = totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / totalAttempts) : 0;

  return (
    <div className="page-shell">
      <TopBar title={data?.username ? `${data.username} Dossier` : "Scholar Dossier"} />
      <main className="page-content page-enter">
        
        {/* Nav row */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
           <button className="btn--ghost sm" style={{ padding: 0 }} onClick={() => navigate(`${prefix}/classes/${classId}`)}>
             <ArrowLeft size={16} style={{ marginRight: 'var(--space-2)' }} />
             Back to Class Overview
           </button>
        </div>

        {/* Editorial Header */}
        <section className="editorial-header animate-fade-up">
           <div className="role-tag role-tag--teacher" style={{ marginBottom: 'var(--space-4)' }}>
             👤 Scholar Identity
           </div>
           <h1 className="text-gradient" style={{ fontSize: 'clamp(32px, 8vw, 48px)', lineHeight: 1.1, marginBottom: 'var(--space-2)' }}>
             {data?.username || 'Progress'}<br/>
             Validation Log.
           </h1>
           <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)', maxWidth: '500px' }}>
             Detailed audit of assessment performance and neural node validation.
           </p>

           <div style={{ display: 'flex', gap: 'var(--space-10)', marginTop: 'var(--space-10)' }}>
              <div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--role-teacher)', marginBottom: '4px' }}>
                    <Activity size={14} />
                    <span style={{ fontSize: '10px', fontWeight: 800 }}>AVG SCORE</span>
                 </div>
                 <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900 }}>{avgScore}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: 'var(--space-10)' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <ClipboardList size={14} />
                    <span style={{ fontSize: '10px', fontWeight: 800 }}>ATTEMPTS</span>
                 </div>
                 <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900 }}>{totalAttempts}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: 'var(--space-10)' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--role-student)', marginBottom: '4px' }}>
                    <Award size={14} />
                    <span style={{ fontSize: '10px', fontWeight: 800 }}>STATUS</span>
                 </div>
                 <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: 'var(--role-student)' }}>
                    {passCount === totalAttempts && totalAttempts > 0 ? 'ELITE' : 'ACTIVE'}
                 </div>
              </div>
           </div>
        </section>

        {/* Assessment Log */}
        <div className="section-header">
           <h2 className="section-header__title">Validation History</h2>
        </div>
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-12)' }}>
           <div className="curriculum-stack">
              {attempts.length === 0 ? (
                <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--text-dim)' }}>
                   <Zap size={32} style={{ opacity: 0.2, marginBottom: 'var(--space-4)' }} />
                   <p style={{ fontWeight: 800, fontSize: 'var(--text-sm)' }}>NO VALIDATION DATA DETECTED</p>
                </div>
              ) : (
                attempts.map((a, i) => (
                  <div key={i} className="lesson-item--obsidian animate-fade-up" style={{ animationDelay: `${i * 20}ms` }}>
                     <div style={{ 
                       width: 32, height: 32, borderRadius: '50%', 
                       background: a.passed ? 'var(--role-student)22' : 'rgba(239,68,68,0.1)', 
                       border: a.passed ? '1px solid var(--role-student)' : '1px solid var(--error)',
                       display: 'flex', alignItems: 'center', justifyContent: 'center',
                       color: a.passed ? 'var(--role-student)' : 'var(--error)',
                       flexShrink: 0
                     }}>
                        {a.passed ? <CheckCircle size={16} /> : <Zap size={14} />}
                     </div>
                     <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{a.assessment_title}</div>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-dim)', marginTop: '2px', textTransform: 'uppercase' }}>
                           Score: {a.score} • {a.passed ? 'Passed' : 'Neural Degradation Detected'}
                        </div>
                     </div>
                     <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-dim)' }}>
                        <Calendar size={12} />
                        <span style={{ fontSize: '10px', fontWeight: 700 }}>{new Date(a.submitted_at).toLocaleDateString()}</span>
                     </div>
                  </div>
                ))
              )}
           </div>
        </div>

      </main>

      <style>{`
        .lesson-item--obsidian {
          display: flex;
          align-items: center;
          gap: var(--space-5);
          padding: var(--space-5) var(--space-6);
          border-bottom: 1px solid var(--glass-border);
          transition: background 0.2s;
        }
        .lesson-item--obsidian:last-child { border-bottom: none; }
        .lesson-item--obsidian:hover {
          background: var(--glass-bg-hover);
        }
      `}</style>
    </div>
  );
};

export default TeacherStudentDetailPage;
