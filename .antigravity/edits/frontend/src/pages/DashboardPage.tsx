import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiGet } from '../services/api';
import { getMySummary, type MySummary } from '../services/gamification';
import { getCourseProgress, type CourseProgress } from '../services/content';
import { assessmentPath } from '../utils/slugs';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { 
  Trophy, 
  Flame, 
  Medal, 
  BookOpen, 
  Clock,
  AlertCircle,
  Zap,
  Activity,
  ArrowUpRight
} from 'lucide-react';
import './DashboardPage.css';

// ── Types ──────────────────────────────────────────────────────────────────

type StudentSubject = {
  id:                number;
  name:              string;
  total_lessons:     number;
  completed_lessons: number;
  progress:          number;
  course_id:         number | null;
};

type AssessmentWithStatus = {
  id: number;
  title: string;
  grade: number;
  subject: string;
  total_marks: number;
  best_score: number | null;
  attempt_count: number;
  passed: boolean;
};

type ResumeMap = Record<number, number | null>;

// ── Components ──────────────────────────────────────────────────────────────

const CircularScore: React.FC<{ pct: number; size?: number }> = ({ pct, size = 48 }) => {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * pct;
  const color = pct >= 0.8 ? 'var(--role-student)' : pct >= 0.5 ? 'var(--warning)' : 'var(--error)';

  return (
    <div className="circular-score" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} className="circular-score__bg" strokeWidth={4} />
        <circle 
          cx={size/2} cy={size/2} r={r} 
          className="circular-score__fill" 
          stroke={color}
          strokeWidth={4}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
        />
      </svg>
      <span className="circular-score__text" style={{ color }}>{Math.round(pct * 100)}</span>
    </div>
  );
};

const SubjectCardSkeleton = () => (
  <div className="glass-card skeleton-card">
    <div className="skeleton skeleton--overline" />
    <div className="skeleton skeleton--title" />
    <div className="skeleton skeleton--progress" />
    <div className="skeleton skeleton--button" />
  </div>
);

const AssessmentRowSkeleton = () => (
  <div className="assessment-row-skeleton">
    <div className="skeleton skeleton--circle" />
    <div className="skeleton-info">
      <div className="skeleton skeleton--line-md" />
      <div className="skeleton skeleton--line-sm" />
    </div>
  </div>
);

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const [assessments, setAssessments] = useState<AssessmentWithStatus[]>([]);
  const [gamification, setGamification] = useState<MySummary | null>(null);
  const [resumeMap, setResumeMap] = useState<ResumeMap>({});
  
  const [loadingSubj, setLoadingSubj] = useState(true);
  const [loadingAssess, setLoadingAssess] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const [subjRes, gamRes, assessRes] = await Promise.allSettled([
          apiGet<StudentSubject[]>("/academics/subjects/"),
          getMySummary(),
          apiGet<AssessmentWithStatus[]>("/assessments/my/"),
        ]);

        if (cancelled) return;

        if (subjRes.status === 'fulfilled') setSubjects(subjRes.value);
        else setError("Failed to initialize subjects.");

        if (gamRes.status === 'fulfilled') setGamification(gamRes.value);
        if (assessRes.status === 'fulfilled') setAssessments(assessRes.value);

      } catch (err) {
        setError("Network encryption failure.");
      } finally {
        if (!cancelled) {
          setLoadingSubj(false);
          setLoadingAssess(false);
        }
      }
    }

    loadInitial();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (subjects.length === 0) return;
    const coursedSubjs = subjects.filter(s => s.course_id != null);
    if (coursedSubjs.length === 0) return;

    let cancelled = false;
    async function loadResume() {
      const results = await Promise.allSettled(
        coursedSubjs.map(s => getCourseProgress(s.course_id!))
      );
      if (cancelled) return;

      const map: ResumeMap = {};
      results.forEach((res, idx) => {
        const cid = coursedSubjs[idx].course_id!;
        if (res.status === 'fulfilled') {
          map[cid] = (res.value as CourseProgress).resume_lesson_id;
        }
      });
      setResumeMap(map);
    }
    loadResume();
    return () => { cancelled = true; };
  }, [subjects]);

  const prioritisedAssessments = [
    ...assessments.filter(a => !a.passed),
    ...assessments.filter(a => a.passed)
  ].slice(0, 4);

  const pendingCount = assessments.filter(a => !a.passed).length;

  return (
    <div className="page-shell">
      <TopBar title="Dashboard" />
      
      <main className="page-content page-enter has-bottom-nav">
        {/* Editorial Welcome */}
        <header className="dashboard-hero animate-fade-up">
          <div className="role-tag role-tag--student" style={{ marginBottom: 'var(--space-4)' }}>
            ✨ Scholar Identity
          </div>
          <h1 className="text-gradient md-display">
            Welcome back,<br/>
            {user?.first_name || 'Scholar'}.
          </h1>
          <p className="hero-subtitle">
            Neural link established. You are currently tracking <strong>{subjects.length}</strong> subject vectors.
          </p>
        </header>

        {/* Gamification Strip */}
        <section className="gamification-strip animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="glass-card stat-pill" onClick={() => navigate('/leaderboard')}>
            <div className="stat-pill__icon"><Trophy size={20} color="var(--role-student)" /></div>
            <div className="stat-pill__info">
              <span className="stat-value">{gamification?.total_points || 0} XP</span>
              <span className="stat-label">RANK #{gamification?.class_rank || '--'}</span>
            </div>
          </div>

          <div className="glass-card stat-pill">
            <div className="stat-pill__icon">
              {Number(gamification?.current_streak || 0) >= 3 ? <Flame size={20} color="var(--warning)" /> : <Clock size={20} color="var(--text-muted)" />}
            </div>
            <div className="stat-pill__info">
              <span className="stat-value">{gamification?.current_streak || 0} DAYS</span>
              <span className="stat-label">ACTIVE STREAK</span>
            </div>
          </div>

          <div className="glass-card stat-pill" onClick={() => navigate('/profile')}>
            <div className="stat-pill__icon"><Medal size={20} color="var(--success)" /></div>
            <div className="stat-pill__info">
              <span className="stat-value">{gamification?.badge_count || 0} BADGES</span>
              <span className="stat-label">ACHIEVEMENTS</span>
            </div>
          </div>
        </section>

        {/* Assessments Section */}
        <section className="dashboard-section animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="section-header">
            <h2 className="section-title">
              Validation Matrix
              {pendingCount > 0 && !loadingAssess && (
                <span className="pending-badge">{pendingCount} PENDING</span>
              )}
            </h2>
            <button className="btn--ghost sm" onClick={() => navigate('/assessments')}>View All <ArrowUpRight size={14} /></button>
          </div>
          
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {loadingAssess ? (
              <div className="assessment-stack-skeleton">
                {[1,2,3].map(i => <AssessmentRowSkeleton key={i} />)}
              </div>
            ) : prioritisedAssessments.length === 0 ? (
              <div className="empty-well" style={{ padding: 'var(--space-12)' }}>
                <Zap size={40} style={{ opacity: 0.2, marginBottom: 'var(--space-4)' }} />
                <p style={{ fontWeight: 800, fontSize: 'var(--text-xs)' }}>NO PENDING ASSESSMENTS DETECTED</p>
              </div>
            ) : (
              <div className="assessment-stack">
                {prioritisedAssessments.map((a, i) => (
                  <div 
                    key={a.id} 
                    className="assessment-row animate-fade-up"
                    style={{ animationDelay: `${i * 50}ms` }}
                    onClick={() => navigate(assessmentPath(a.grade, a.subject, a.id))}
                  >
                    <CircularScore pct={(a.best_score || 0) / (a.total_marks || 1)} size={44} />
                    <div className="assessment-row__content">
                      <div className="assessment-row__subject">{a.subject.toUpperCase()}</div>
                      <div className="assessment-row__title">{a.title}</div>
                    </div>
                    <div className="assessment-row__status">
                       {a.passed ? 
                         <span className="status-tag status-tag--pass">VALIDATED</span> : 
                         <span className="status-tag status-tag--pending">INCOMPLETE</span>
                       }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Subjects Grid */}
        <section className="dashboard-section animate-fade-up" style={{ animationDelay: '300ms' }}>
          <div className="section-header">
            <h2 className="section-title">Curriculum Grid</h2>
          </div>

          <div className="subject-grid">
            {loadingSubj ? (
              Array.from({ length: 4 }).map((_, i) => <SubjectCardSkeleton key={i} />)
            ) : subjects.length === 0 ? (
              <div className="glass-card empty-well" style={{ gridColumn: '1 / -1' }}>
                <Activity size={40} style={{ opacity: 0.2, marginBottom: 'var(--space-4)' }} />
                <p style={{ fontWeight: 800, fontSize: 'var(--text-xs)' }}>NO SUBJECT VECTORS FOUND</p>
              </div>
            ) : (
              subjects.map((s, i) => {
                const resumeId = resumeMap[s.course_id || -1];
                const isStarted = s.progress > 0;
                
                return (
                  <div 
                    key={s.id} 
                    className="glass-card subject-card animate-fade-up"
                    style={{ animationDelay: `${i * 100}ms` }}
                    onClick={() => navigate(`/courses?subject_id=${s.id}`)}
                  >
                    <div className="subject-card__overline">{s.completed_lessons}/{s.total_lessons} NODES COMPLETED</div>
                    <h3 className="subject-card__title">{s.name}</h3>
                    
                    <div className="subject-card__progress-container">
                      <div className="progress-bar">
                        <div 
                          className="progress-bar__fill" 
                          style={{ width: `${s.progress}%`, background: 'var(--role-student)' }} 
                        />
                      </div>
                      <span className="progress-percent">{s.progress}%</span>
                    </div>

                    <div className="subject-card__actions">
                      {s.course_id && s.total_lessons > 0 && (
                        <button 
                          className="btn--primary sm" 
                          style={{ width: '100%' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (typeof resumeId === 'number') navigate(`/lessons/${resumeId}`);
                            else navigate(`/courses?subject_id=${s.id}`);
                          }}
                        >
                          {typeof resumeId === 'number' ? 'CONTINUE SEQUENCE' : (isStarted ? 'RESUME SYNC' : 'INITIATE SYNC')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {error && (
          <div className="glass-card error-toast animate-fade-up" style={{ borderColor: 'var(--error)' }}>
             <AlertCircle size={14} color="var(--error)" /> {error}
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  );
};

export default DashboardPage;
