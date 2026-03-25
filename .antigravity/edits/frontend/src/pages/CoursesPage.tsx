import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStudentEnrollments, type Enrollment } from '../services/course';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';

const CoursesPage: React.FC = () => {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getStudentEnrollments();
        setEnrollments(data);
      } catch (err) {
        console.error("Courses load failed:", err);
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
      <TopBar title="My Subjects" />
      <main className="page-content page-enter has-bottom-nav">
        {/* Editorial Header */}
        <section className="editorial-header animate-fade-up">
          <button 
            className="btn--ghost" 
            style={{ marginBottom: 'var(--space-6)', padding: 0, fontSize: 'var(--text-sm)', color: 'var(--brand-primary)' }}
            onClick={() => navigate('/dashboard')}
          >
            ← Back to Overview
          </button>
          <h1 className="text-gradient" style={{ fontSize: 'clamp(32px, 8vw, 48px)', lineHeight: 1.1, marginBottom: 'var(--space-2)' }}>
            Your Library<br/>
            of Knowledge.
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)', maxWidth: '400px' }}>
            Choose a subject to dive deeper into its lessons and track your mastery.
          </p>
        </section>

        {/* Courses Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-8)' }}>
          {enrollments.map((enr) => (
            <div 
              key={enr.id} 
              className="glass-card" 
              style={{ cursor: 'pointer', padding: 'var(--space-10)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
              onClick={() => navigate(`/courses/${enr.grade}/${enr.subject_slug}`)}
            >
              <div style={{ fontSize: '32px' }}>
                {enr.subject_name.toLowerCase().includes('english') ? '📖' : 
                 enr.subject_name.toLowerCase().includes('math') ? '📐' : 
                 enr.subject_name.toLowerCase().includes('science') ? '🧬' : '📓'}
              </div>
              <div>
                <h3 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{enr.subject_name}</h3>
                <div className="role-tag role-tag--student" style={{ marginTop: 'var(--space-2)', fontSize: '9px' }}>
                  Grade {enr.grade}
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                Mastery and core learning materials for your current curriculum.
              </p>
              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--space-4)' }}>
                 <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-primary)' }}>CONTINUE LEARNING</div>
                 <div style={{ color: 'var(--brand-primary)' }}>→</div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default CoursesPage;
