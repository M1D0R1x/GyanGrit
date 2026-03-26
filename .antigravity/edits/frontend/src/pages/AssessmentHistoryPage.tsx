import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAllMyAttempts, type AttemptWithContext } from '../services/assessments';
import { assessmentPath } from '../utils/slugs';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { ChevronLeft, History, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import './AssessmentHistoryPage.css';

const AssessmentHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { assessmentId: assessmentIdParam } = useParams<{ assessmentId?: string }>();
  const assessmentIdFilter = assessmentIdParam ? Number(assessmentIdParam) : null;

  const [attempts, setAttempts] = useState<AttemptWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    getAllMyAttempts()
      .then(data => {
        if (!cancelled) setAttempts(data);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load attempt history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const base = assessmentIdFilter
    ? attempts.filter((a) => a.assessment_id === assessmentIdFilter)
    : attempts;

  const subjects = ["all", ...Array.from(new Set(base.map((a) => a.subject))).sort()];
  const filtered = subjectFilter === "all" ? base : base.filter((a) => a.subject === subjectFilter);

  const passedCount = filtered.filter((a) => a.passed).length;
  const avgScore = filtered.length > 0
    ? Math.round(filtered.reduce((s, a) => s + (a.score / a.total_marks) * 100, 0) / filtered.length)
    : 0;

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  };

  if (loading) return (
    <div className="page-shell">
      <TopBar title="History" />
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn__spinner" style={{ width: 40, height: 40 }} />
      </div>
      <BottomNav />
    </div>
  );

  return (
    <div className="page-shell">
      <TopBar title={assessmentIdFilter ? "Attempt History" : "Assessment History"} />
      
      <main className="page-content page-enter has-bottom-nav">
        <button className="back-btn" onClick={() => navigate(assessmentIdFilter ? -1 : "/assessments")}>
          <ChevronLeft size={16} /> Back to {assessmentIdFilter ? "Assessment" : "Assessments"}
        </button>

        <header className="history-header animate-fade-up">
           <div className="role-tag role-tag--student">🕑 Academic Records</div>
           <h1 className="text-gradient md-display">Attempt History.</h1>
           <p className="hero-subtitle">
             {assessmentIdFilter 
               ? "Detailed timeline of your attempts for this specific assessment." 
               : "A comprehensive log of all your submitted assessments across GYANGRIT."}
           </p>

           {filtered.length > 0 && (
             <div className="history-stats animate-fade-up" style={{ animationDelay: '100ms' }}>
               <div className="glass-card stat-card">
                 <span className="stat-card__val">{filtered.length}</span>
                 <span className="stat-card__lbl">Attempts</span>
               </div>
               <div className="glass-card stat-card">
                 <span className="stat-card__val success">{passedCount}</span>
                 <span className="stat-card__lbl">Passed</span>
               </div>
               <div className="glass-card stat-card">
                 <span className="stat-card__val primary">{avgScore}%</span>
                 <span className="stat-card__lbl">Avg. Score</span>
               </div>
             </div>
           )}
        </header>

        {!assessmentIdFilter && subjects.length > 2 && (
          <div className="filter-scroll animate-fade-up" style={{ animationDelay: '200ms' }}>
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
        )}

        <section className="history-list">
          {filtered.length === 0 ? (
            <div className="glass-card empty-well animate-fade-up">
              <History size={48} color="var(--text-muted)" />
              <p>No attempts recorded yet. Your journey is just beginning.</p>
            </div>
          ) : filtered.map((attempt, i) => (
            <div 
              key={attempt.id}
              className="glass-card history-item animate-fade-up"
              style={{ animationDelay: `${(i + 4) * 50}ms` }}
              onClick={() => navigate(assessmentPath(attempt.grade, attempt.subject, attempt.assessment_id))}
            >
              <div className="history-item__score">
                <div className={`score-badge ${attempt.passed ? 'pass' : 'fail'}`}>
                  {Math.round((attempt.score / attempt.total_marks) * 100)}%
                </div>
              </div>

              <div className="history-item__body">
                <h3>{attempt.assessment_title}</h3>
                <div className="meta">
                   <span>{attempt.subject}</span>
                   <span className="dot" />
                   <span>{formatDate(attempt.submitted_at)}</span>
                </div>
              </div>

              <div className="history-item__status">
                {attempt.passed ? (
                  <CheckCircle size={20} color="var(--success)" />
                ) : (
                  <XCircle size={20} color="var(--error)" />
                )}
              </div>
            </div>
          ))}
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default AssessmentHistoryPage;
