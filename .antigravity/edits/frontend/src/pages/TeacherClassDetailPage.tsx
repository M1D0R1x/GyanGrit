import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  getTeacherClassStudents,
  type TeacherClassStudent,
} from '../services/teacherAnalytics';
import TopBar from '../components/TopBar';

const TeacherClassDetailPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const prefix = location.pathname.startsWith('/principal') ? '/principal'
    : location.pathname.startsWith('/official') ? '/official'
    : '/teacher';

  const [students, setStudents] = useState<TeacherClassStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    async function loadData() {
      try {
        const data = await getTeacherClassStudents(Number(classId));
        setStudents(data || []);
      } catch (err) {
        console.error("Class students load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [classId]);

  if (loading) return (
    <div className="page-shell">
      <TopBar />
      <main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn__spinner" style={{ width: 40, height: 40 }} />
      </main>
    </div>
  );

  const totalStudents = students.length;
  const avgProgress = totalStudents > 0
    ? Math.round(
        students.reduce((sum, s) =>
          sum + (s.total_lessons > 0 ? s.completed_lessons / s.total_lessons * 100 : 0), 0
        ) / totalStudents
      )
    : 0;

  return (
    <div className="page-shell">
      <TopBar title="Class Pulse" />
      <main className="page-content page-enter">
        {/* Editorial Sub-Header */}
        <section className="editorial-header animate-fade-up">
           <button 
             className="btn--ghost" 
             style={{ marginBottom: 'var(--space-6)', padding: 0, fontSize: 'var(--text-sm)', color: 'var(--role-teacher)' }}
             onClick={() => navigate(prefix)}
           >
             ← Return to Command Center
           </button>
           <h1 className="text-gradient" style={{ fontSize: 'clamp(28px, 6vw, 40px)', lineHeight: 1.2, marginBottom: 'var(--space-1)' }}>
             Student Mastery<br/>
             Breakdown.
           </h1>
           <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-8)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 800 }}>Cohort Size</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900 }}>{totalStudents}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: 'var(--space-6)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 800 }}>Avg. Progress</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--role-teacher)' }}>{avgProgress}%</div>
              </div>
           </div>
        </section>

        {/* Student Data Table */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>SCHOLAR</th>
                <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>CURRICULUM NODES</th>
                <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>MASTERY</th>
                <th style={{ padding: 'var(--space-4)', textAlign: 'right', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const pct = s.total_lessons > 0 ? Math.round((s.completed_lessons / s.total_lessons) * 100) : 0;
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }} onClick={() => navigate(`${prefix}/classes/${classId}/students/${s.id}`)}>
                    <td style={{ padding: 'var(--space-5)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: 'var(--role-teacher)' }}>
                          {(s.display_name || s.username).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{s.display_name || s.username}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>@{s.username}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-primary)' }}>{s.completed_lessons}</span>
                      <span style={{ color: 'var(--text-dim)' }}> / {s.total_lessons}</span>
                    </td>
                    <td style={{ padding: 'var(--space-5)', width: '200px' }}>
                      <div className="progress-bar" style={{ height: 6 }}>
                        <div className="progress-bar__fill" style={{ width: `${pct}%`, background: 'var(--role-teacher)' }} />
                      </div>
                      <div style={{ fontSize: '8px', fontWeight: 800, color: 'var(--text-muted)', marginTop: '4px' }}>{pct}% COMPLETE</div>
                    </td>
                    <td style={{ padding: 'var(--space-5)', textAlign: 'right' }}>
                       <button className="btn--ghost" style={{ fontSize: '10px', color: 'var(--role-teacher)', fontWeight: 800 }}>
                         ANALYZE →
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default TeacherClassDetailPage;
