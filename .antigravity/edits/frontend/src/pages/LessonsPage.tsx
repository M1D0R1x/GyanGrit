import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSubjectLessons, type Lesson } from '../services/lesson';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';

const LessonsPage: React.FC = () => {
  const { grade, subject_slug } = useParams<{ grade: string; subject_slug: string }>();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!grade || !subject_slug) return;
      try {
        const data = await getSubjectLessons(parseInt(grade), subject_slug);
        setLessons(data);
      } catch (err) {
        console.error("Lessons load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [grade, subject_slug]);

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
      <TopBar title="Lessons" />
      <main className="page-content page-enter has-bottom-nav">
        {/* Editorial Header */}
        <section className="editorial-header animate-fade-up">
          <button 
            className="btn--ghost" 
            style={{ marginBottom: 'var(--space-6)', padding: 0, fontSize: 'var(--text-sm)', color: 'var(--brand-primary)' }}
            onClick={() => navigate('/courses')}
          >
            ← All Subjects
          </button>
          <h1 className="text-gradient" style={{ fontSize: 'clamp(32px, 8vw, 48px)', lineHeight: 1.1, marginBottom: 'var(--space-2)' }}>
            The Curriculum<br/>
            Journey.
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)', maxWidth: '400px' }}>
            Track your progress through the modules and prepare for your next major assessment.
          </p>
        </section>

        {/* Lessons Feed */}
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {lessons.map((lesson, idx) => (
            <div 
              key={lesson.id} 
              className="assessment-row"
              onClick={() => navigate(`/lessons/${lesson.id}`)}
            >
              <div className="assessment-row__icon">
                 {idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div className="assessment-row__title">{lesson.title}</div>
                <div className="assessment-row__meta">
                  <span>MODULE {idx + 1}</span>
                  {idx === 0 && <span style={{ color: 'var(--success)' }}>● READY TO START</span>}
                </div>
              </div>
              <button className="assessment-row__btn">
                STUDY
              </button>
            </div>
          ))}

          {/* Assessment Call-to-Action */}
          <div className="glass-card" style={{ 
            marginTop: 'var(--space-12)', padding: 'var(--space-10)', border: '1px dashed var(--brand-primary)44', 
            textAlign: 'center', background: 'var(--brand-primary)08' 
          }}>
            <div style={{ fontSize: '32px', marginBottom: 'var(--space-4)' }}>🎯</div>
            <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)' }}>Ready for the Assessment?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)', maxWidth: '300px', margin: '0 auto 24px' }}>
              Finalize your knowledge by taking the module assessment to earn your mastery points.
            </p>
            <button className="btn--primary" style={{ width: '100%', borderRadius: 'var(--radius-xl)' }} onClick={() => navigate(`/assessments/take/${subject_slug}`)}>
              Take Assessment
            </button>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default LessonsPage;
