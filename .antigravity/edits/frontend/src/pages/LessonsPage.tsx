import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet } from '../services/api';
import { getCourseBySlug } from '../services/content';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';

type LessonItem = {
  id: number;
  type: "global" | "section";
  title: string;
  order: number;
  completed: boolean;
  has_video: boolean;
  has_pdf: boolean;
  has_content: boolean;
  section_label?: string;
  created_by?: string | null;
};

const LessonsPage: React.FC = () => {
  const { grade: gradeParam, subject: subjectSlug } = useParams<{ grade: string; subject: string }>();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [courseName, setCourseName] = useState("");
  const [loading, setLoading] = useState(true);

  const grade = gradeParam ? Number(gradeParam) : null;

  useEffect(() => {
    async function load() {
      if (!grade || !subjectSlug) return;
      try {
        const course = await getCourseBySlug(grade, subjectSlug);
        setCourseName(course.title);
        const data = await apiGet<LessonItem[]>(`/courses/${course.id}/lessons/`);
        setLessons(data);
      } catch (err) {
        console.error("Lessons load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [grade, subjectSlug]);

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
      <TopBar title={courseName || "Lessons"} />
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
              className={`assessment-row ${lesson.completed ? 'assessment-row--completed' : ''}`}
              onClick={() => navigate(lesson.type === 'section' ? `/lessons/section/${lesson.id}` : `/lessons/${lesson.id}`)}
              style={{ opacity: lesson.completed ? 0.7 : 1 }}
            >
              <div className="assessment-row__icon">
                 {lesson.completed ? '✓' : idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div className="assessment-row__title">{lesson.title}</div>
                <div className="assessment-row__meta">
                  <span style={{ color: lesson.type === 'section' ? 'var(--role-teacher)' : 'inherit' }}>
                    {lesson.type === 'section' ? 'SUPPLEMENTAL' : `MODULE ${idx + 1}`}
                  </span>
                  {lesson.completed && <span style={{ color: 'var(--role-student)' }}>● COMPLETED</span>}
                </div>
              </div>
              <button className="assessment-row__btn">
                {lesson.completed ? 'REVIEW' : 'STUDY'}
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
            <button className="btn--primary" style={{ width: '100%', borderRadius: 'var(--radius-xl)' }} onClick={() => navigate(`/assessments/take/${subjectSlug}`)}>
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
