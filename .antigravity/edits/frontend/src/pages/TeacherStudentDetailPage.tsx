import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  getTeacherStudentAssessments,
  type TeacherStudentDetailResponse,
} from '../services/teacherAnalytics';
import TopBar from '../components/TopBar';

const TeacherStudentDetailPage: React.FC = () => {
  const { classId, studentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const prefix = location.pathname.startsWith('/principal') ? '/principal'
    : location.pathname.startsWith('/official') ? '/official'
    : '/teacher';

  const [data, setData] = useState<TeacherStudentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId || !studentId) return;
    async function loadData() {
      try {
        const res = await getTeacherStudentAssessments(Number(classId), Number(studentId));
        setData(res || null);
      } catch (err) {
        console.error("Student detail load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [classId, studentId]);

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
      <TopBar title="Performance Dossier" />
      <main className="page-content page-enter">
        {/* Editorial Header */}
        <section className="editorial-header animate-fade-up">
           <button 
             className="btn--ghost" 
             style={{ marginBottom: 'var(--space-6)', padding: 0, fontSize: 'var(--text-sm)', color: 'var(--role-teacher)' }}
             onClick={() => navigate(`${prefix}/classes/${classId}`)}
           >
             ← Core Cohort Data
           </button>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
              <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-2xl)', background: 'var(--bg-elevated)', border: '1px solid var(--role-teacher)22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xl)', fontWeight: 900, color: 'var(--role-teacher)' }}>
                {data?.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-gradient" style={{ fontSize: 'clamp(24px, 5vw, 36px)', lineHeight: 1.1 }}>
                  {data?.username}<br/>
                  Registry Profile.
                </h1>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginTop: '4px' }}>
                  Student Resource Mapping
                </div>
              </div>
           </div>

           <div style={{ display: 'flex', gap: 'var(--space-10)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 800 }}>ASSESSMENTS</div>
                <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900 }}>{data?.attempts.length || 0}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: 'var(--space-10)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 800 }}>AVERAGE SCORE</div>
                <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: 'var(--role-teacher)' }}>
                  {data?.attempts.length ? Math.round(data.attempts.reduce((s, a) => s + a.score, 0) / data.attempts.length) : 0}%
                </div>
              </div>
           </div>
        </section>

        {/* Assessment Timeline */}
        <div className="section-header">
           <h2 className="section-header__title">Chronological Performance</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {data?.attempts.map((a, i) => (
            <div 
              key={i} 
              className="glass-card page-enter" 
              style={{ padding: 'var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${a.passed ? 'var(--role-teacher)22' : 'var(--role-admin)22'}`, animationDelay: `${i * 100}ms` }}
            >
              <div>
                <h3 style={{ fontSize: 'var(--text-base)', marginBottom: '4px' }}>{a.assessment_title}</h3>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {new Date(a.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: a.passed ? 'var(--role-teacher)' : 'var(--role-admin)' }}>{a.score}</div>
                  <div style={{ fontSize: '8px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>PRECISION</div>
                </div>
                <div className={`role-tag role-tag--${a.passed ? 'teacher' : 'admin'}`} style={{ fontSize: '9px', width: '60px', textAlign: 'center' }}>
                  {a.passed ? 'SUCCESS' : 'FAILED'}
                </div>
              </div>
            </div>
          ))}

          {data?.attempts.length === 0 && (
            <div className="empty-state glass-card" style={{ padding: 'var(--space-12)' }}>
               <div style={{ fontSize: '40px', marginBottom: 'var(--space-4)' }}>🌓</div>
               <h3 className="empty-state__title">No Historical Data</h3>
               <p className="empty-state__message">This student has not yet engaged with institutional assessments.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TeacherStudentDetailPage;
