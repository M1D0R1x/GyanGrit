import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  getLearningPath, 
  getLearningPathProgress, 
  type LearningPathDetail, 
  type LearningPathProgress 
} from '../services/learningPaths';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { ChevronLeft, ChevronRight, PlayCircle, CheckCircle } from 'lucide-react';
import './LearningPathPage.css';

const LearningPathPage: React.FC = () => {
  const { pathId } = useParams();
  const navigate = useNavigate();

  const [path, setPath] = useState<LearningPathDetail | null>(null);
  const [progress, setProgress] = useState<LearningPathProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pathId) return;
    let cancelled = false;

    async function load() {
      try {
        const [pathData, progressData] = await Promise.all([
          getLearningPath(Number(pathId)),
          getLearningPathProgress(Number(pathId)),
        ]);
        if (cancelled) return;
        setPath(pathData);
        setProgress(progressData);
      } catch {
        if (!cancelled) setError("Failed to load learning roadmap.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [pathId]);

  if (loading) return (
    <div className="page-shell">
      <TopBar title="Roadmap" />
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn__spinner" style={{ width: 40, height: 40 }} />
      </div>
      <BottomNav />
    </div>
  );

  if (!path) return (
    <div className="page-shell">
      <TopBar title="Error" />
      <div className="page-content empty-well">
        <h3>Roadmap not found</h3>
        <button className="btn--primary" onClick={() => navigate('/learning')}>Back to Roadmaps</button>
      </div>
      <BottomNav />
    </div>
  );

  return (
    <div className="page-shell">
      <TopBar title={path.name} />
      
      <main className="page-content page-enter has-bottom-nav">
        <button className="back-btn" onClick={() => navigate('/learning')}>
          <ChevronLeft size={16} /> Back to Roadmaps
        </button>

        <header className="path-detail-header animate-fade-up">
          <h1 className="text-gradient md-display">{path.name}</h1>
          <p className="hero-subtitle">{path.description}</p>
          
          {progress && (
            <div className="glass-card path-progress-card">
              <div className="progress-header">
                <span className="progress-label">YOUR JOURNEY PROGRESS</span>
                <span className="progress-value">{progress.percentage}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-bar__fill" 
                  style={{ width: `${progress.percentage}%`, background: progress.percentage === 100 ? 'var(--success)' : 'var(--brand-primary)' }} 
                />
              </div>
              <p className="progress-stats">
                {progress.completed_courses} of {progress.total_courses} courses mastered
              </p>
            </div>
          )}
        </header>

        <section className="course-list animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="section-header">
             <h2 className="section-title">Milestones</h2>
          </div>

          <div className="course-stack">
            {path.courses.map((c, i) => (
              <div 
                key={c.course_id}
                className="glass-card course-strip animate-fade-up"
                style={{ animationDelay: `${(i + 3) * 100}ms` }}
                onClick={() => navigate(`/courses/${c.course_id}`)}
              >
                <div className="course-strip__order">{c.order}</div>
                <div className="course-strip__info">
                  <h3>{c.title}</h3>
                  <div className="course-strip__meta">
                    <span className="subject-tag">{c.subject}</span>
                    <span className="dot" />
                    <span>Grade {c.grade}</span>
                  </div>
                </div>
                <div className="course-strip__action">
                   <ChevronRight size={20} className="arrow" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default LearningPathPage;
