import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getLearningPaths, 
  getLearningPathProgress, 
  type LearningPath, 
  type LearningPathProgress 
} from '../services/learningPaths';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { Map, ChevronRight, BookOpen } from 'lucide-react';
import './LearningPathsPage.css';

const LearningPathsPage: React.FC = () => {
  const navigate = useNavigate();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [progress, setProgress] = useState<Record<number, LearningPathProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const pathList = await getLearningPaths();
        if (cancelled) return;
        setPaths(pathList || []);

        if (pathList?.length > 0) {
          const res = await Promise.allSettled(pathList.map(p => getLearningPathProgress(p.id)));
          if (cancelled) return;
          const map: Record<number, LearningPathProgress> = {};
          res.forEach((r, idx) => {
            if (r.status === 'fulfilled' && r.value) {
              map[pathList[idx].id] = r.value as LearningPathProgress;
            }
          });
          setProgress(map);
        }
      } catch (err) {
        console.error("LearningPaths load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return (
    <div className="page-shell">
      <TopBar title="Roadmaps" />
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn__spinner" style={{ width: 40, height: 40 }} />
      </div>
      <BottomNav />
    </div>
  );

  return (
    <div className="page-shell">
      <TopBar title="Learning Paths" />
      
      <main className="page-content page-enter has-bottom-nav">
        <header className="editorial-header animate-fade-up">
          <div className="role-tag role-tag--student">🗺️ Curated Journeys</div>
          <h1 className="text-gradient">Learning Roadmaps.</h1>
          <p className="hero-subtitle">
            Structured collections of knowledge tailored for your current grade and level.
          </p>
        </header>

        <section className="paths-grid">
          {paths.length === 0 ? (
            <div className="glass-card empty-well">
              <Map size={48} color="var(--text-muted)" />
              <p>No learning paths curated for you yet. Check back soon!</p>
            </div>
          ) : paths.map((path, i) => {
            const p = progress[path.id];
            return (
              <div 
                key={path.id} 
                className="glass-card path-card animate-fade-up"
                style={{ animationDelay: `${i * 100}ms` }}
                onClick={() => navigate(`/learning/${path.id}`)}
              >
                <div className="path-card__header">
                  <div className="path-card__icon"><BookOpen size={24} color="var(--brand-primary)" /></div>
                  <h3 className="path-card__title">{path.name}</h3>
                </div>
                
                <p className="path-card__desc">{path.description || "Embark on this guided learning experience."}</p>
                
                {p ? (
                  <div className="path-card__progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-bar__fill" 
                        style={{ width: `${p.percentage}%`, background: p.percentage === 100 ? 'var(--success)' : 'var(--brand-primary)' }} 
                      />
                    </div>
                    <div className="progress-details">
                      <span>{p.completed_courses}/{p.total_courses} Courses</span>
                      <span className="progress-p">{p.percentage}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="skeleton-line" style={{ height: 4, width: '100%', marginTop: 'auto' }} />
                )}
                
                <ChevronRight size={20} className="path-card__arrow" />
              </div>
            );
          })}
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default LearningPathsPage;
