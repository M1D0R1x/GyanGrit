import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../services/api';
import { type AssessmentWithStatus } from '../services/assessments';
import { assessmentPath } from '../utils/slugs';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { History, Search, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import './AssessmentsPage.css';

const CircularScore: React.FC<{ pct: number; size?: number }> = ({ pct, size = 44 }) => {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * pct;
  const color = pct >= 0.8 ? 'var(--success)' : pct >= 0.5 ? 'var(--warning)' : 'var(--error)';

  return (
    <div className="circular-score" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth={4} />
        <circle 
          cx={size/2} cy={size/2} r={r} 
          fill="none" 
          stroke={color}
          strokeWidth={4}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
        />
      </svg>
      <span className="circular-score__text" style={{ color, fontSize: 10 }}>{Math.round(pct * 100)}</span>
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
      
      <main className="page-content page-enter has-bottom-nav">
        <header className="editorial-header animate-fade-up">
           <div className="role-tag role-tag--student">🏆 Evaluation Center</div>
           <h1 className="text-gradient">My Assessments.</h1>
           <p className="hero-subtitle">Test your mastery across subjects and track your progress in real-time.</p>
        </header>

        <button className="glass-card history-hero animate-fade-up" onClick={() => navigate('/assessments/history')}>
          <div className="history-hero__content">
            <History size={20} color="var(--brand-primary)" />
            <span>Review Previous Attempts</span>
          </div>
          <ChevronRight size={18} />
        </button>

        <section className="filter-system animate-fade-up" style={{ animationDelay: '100ms' }}>
           <div className="filter-scroll">
             {subjects.map(s => (
               <button 
                 key={s} 
                 className={`pill-btn ${subjectFilter === s ? 'pill-btn--active' : ''}`}
                 onClick={() => setSubjectFilter(s)}
               >
                 {s === 'all' ? 'All Subjects' : s}
               </button>
             ))}
           </div>

           <div className="status-toggle glass">
             {(['all', 'pending', 'passed'] as const).map(f => (
               <button 
                 key={f} 
                 className={`status-toggle__btn ${statusFilter === f ? 'active' : ''}`}
                 onClick={() => setStatusFilter(f)}
               >
                 {f}
               </button>
             ))}
           </div>
        </section>

        <section className="assessments-list">
          {filtered.length === 0 ? (
            <div className="glass-card empty-well animate-fade-up">
              <AlertCircle size={48} color="var(--text-muted)" />
              <p>No assessments matching your criteria.</p>
            </div>
          ) : filtered.map((a, i) => {
            const isAttempted = (a.attempt_count ?? 0) > 0;
            const pct = (a.best_score || 0) / (a.total_marks || 1);

            return (
              <div 
                key={a.id} 
                className={`glass-card assessment-row animate-fade-up ${a.passed ? 'assessment-row--passed' : ''}`}
                style={{ animationDelay: `${(i + 4) * 50}ms` }}
                onClick={() => navigate(assessmentPath(a.grade, a.subject, a.id))}
              >
                <div className="assessment-row__score">
                  {isAttempted ? <CircularScore pct={pct} /> : <div className="unattempted-ring" />}
                </div>

                <div className="assessment-row__body">
                  <div className="meta">
                    <span className="subject-tag">{a.subject}</span>
                    <span className="dot" />
                    <span>Grade {a.grade}</span>
                  </div>
                  <h3>{a.title}</h3>
                  <div className="stats">
                    <span>{a.total_marks} Marks</span>
                    <span className="dot" />
                    <span>{a.attempt_count} Attempts</span>
                  </div>
                </div>

                <div className="assessment-row__status">
                   {a.passed ? (
                     <div className="pass-indicator"><CheckCircle2 size={20} /> Mastered</div>
                   ) : (
                     <ChevronRight size={20} className="arrow" />
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
