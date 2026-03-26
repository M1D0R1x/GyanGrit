import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAssessment,
  getAssessmentAdmin,
  getMyAttempts,
  type AssessmentDetail,
  type AttemptHistoryItem,
} from "../services/assessments";
import { assessmentTakePath, assessmentHistoryPath } from "../utils/slugs";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { 
  ChevronLeft, 
  Target, 
  HelpCircle, 
  Trophy, 
  History, 
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import './AssessmentPage.css';

const DURATION_MINUTES = 30;
const STAFF_ROLES = ["ADMIN", "TEACHER", "PRINCIPAL", "OFFICIAL"] as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const AssessmentPage: React.FC = () => {
  const { grade: gradeParam, subject: subjectSlug, assessmentId } = useParams<{
    grade: string;
    subject: string;
    assessmentId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const grade = gradeParam ? Number(gradeParam) : null;
  const role = user?.role ?? "STUDENT";
  const isStaff = (STAFF_ROLES as readonly string[]).includes(role);

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assessmentId) return;
    const id = Number(assessmentId);

    if (isStaff) {
      getAssessmentAdmin(id)
        .then(setAssessment)
        .catch(() => setError("SIGNAL LOST: Assessment unreachable."))
        .finally(() => setLoading(false));
    } else {
      Promise.all([getAssessment(id), getMyAttempts(id)])
        .then(([a, att]) => {
          setAssessment(a);
          setAttempts(att);
        })
        .catch(() => setError("SIGNAL LOST: Assessment unreachable."))
        .finally(() => setLoading(false));
    }
  }, [assessmentId, isStaff]);

  const bestAttempt = attempts.length > 0
    ? attempts.reduce((best, a) => a.score > best.score ? a : best, attempts[0])
    : null;
  const hasPassedBefore = attempts.some((a) => a.passed);

  const takePath = (grade && subjectSlug && assessmentId)
    ? assessmentTakePath(grade, subjectSlug, Number(assessmentId))
    : "/assessments";

  const historyPath = (grade && subjectSlug && assessmentId)
    ? assessmentHistoryPath(grade, subjectSlug, Number(assessmentId))
    : "/assessments/history";

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar title="Assessment" />
        <main className="page-content has-bottom-nav">
          <div className="skeleton-stack animate-pulse-subtle">
             <div className="skeleton-box" style={{ height: '120px' }} />
             <div className="skeleton-box" style={{ height: '300px' }} />
          </div>
        </main>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="page-shell">
        <TopBar title="Assessment" />
        <main className="page-content">
          <div className="glass-card error-dock">
             <AlertCircle size={16} /> {error || "DATA VOID: Assessment not found."}
          </div>
          <button className="btn--ghost sm" onClick={() => navigate(-1)} style={{ marginTop: 'var(--space-6)' }}>
            <ChevronLeft size={14} /> BACK TO ARCHIVE
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title="Intelligence Test" />
      <main className="page-content page-enter has-bottom-nav assessment-list-layout">
        
        <button className="nav-back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} /> BACK
        </button>

        {/* Staff Banner */}
        {isStaff && (
          <div className="alert-nexus glass-card animate-fade-up">
             <ShieldCheck size={16} color="var(--role-teacher)" />
             <div className="alert-text">
                <span className="alert-label">AUTHORITY OVERRIDE</span>
                <p>Viewing as <strong>{role}</strong>. {assessment.questions.length} Units · {assessment.total_marks} Marks total.</p>
             </div>
          </div>
        )}

        {/* Assessment Card */}
        <section className="assessment-hero glass-card animate-fade-up">
           <div className="hero-status">
              <div className="role-tag role-tag--student">TECHNICAL EVALUATION</div>
              {hasPassedBefore && <div className="status-pill passed"><Trophy size={10} /> MASTERY VALIDATED</div>}
           </div>
           <h1 className="text-gradient display-md">{assessment.title}</h1>
           {assessment.description && <p className="hero-desc">{assessment.description}</p>}
           
           <div className="specs-grid">
              <div className="spec-item">
                 <span className="spec-val">{assessment.questions.length}</span>
                 <span className="spec-label">UNITS</span>
              </div>
              <div className="spec-item">
                 <span className="spec-val">{assessment.total_marks}</span>
                 <span className="spec-label">MARKS</span>
              </div>
              <div className="spec-item">
                 <span className="spec-val">{assessment.pass_marks}</span>
                 <span className="spec-label">PASS</span>
              </div>
           </div>
        </section>

        {/* Best Score Badge */}
        {!isStaff && bestAttempt && (
          <div className={`score-badge animate-fade-up ${hasPassedBefore ? 'passed' : 'failed'}`}>
             <div className="badge-icon">
                {hasPassedBefore ? <Trophy size={18} /> : <Target size={18} />}
             </div>
             <div className="badge-content">
                <span className="badge-status">{hasPassedBefore ? "UNIT MASTERED" : "INSUFFICIENT PROGRESS"}</span>
                <p>Peak performance at <strong>{bestAttempt.score}/{assessment.total_marks}</strong>.</p>
             </div>
          </div>
        )}

        {/* Instructions */}
        {!isStaff && (
          <section className="instructions-well glass-card animate-fade-up" style={{ animationDelay: '100ms' }}>
             <div className="section-header">
                <HelpCircle size={14} /> <span>PROTOCOLS</span>
             </div>
             <ul className="protocol-list">
                <li><div className="p-dot" /> Evaluates {assessment.questions.length} nodal points worth {assessment.total_marks} marks total.</li>
                <li><div className="p-dot" /> Mastery threshold set at {assessment.pass_marks} marks.</li>
                <li><div className="p-dot" /> Time limit: {DURATION_MINUTES} Minutes. Autonomous submission active.</li>
                <li><div className="p-dot" /> Each unit possesses one unique correct vector.</li>
                <li><div className="p-dot" /> Peak performance synchronization active: only highest score is registered.</li>
             </ul>
          </section>
        )}

        {/* Primary Action */}
        {!isStaff ? (
          <button 
            className="btn--primary lg full animate-fade-up" 
            onClick={() => navigate(takePath)}
            style={{ animationDelay: '200ms' }}
          >
            {attempts.length === 0 ? "INITIALIZE EVALUATION" : "RE-SYNCHRONIZE EVALUATION"}
          </button>
        ) : (
          <button 
            className="btn--ghost lg full animate-fade-up" 
            onClick={() => navigate(-1)}
            style={{ animationDelay: '200ms' }}
          >
            CHALLENGE DISABLED FOR AUTHORITY
          </button>
        )}

        {/* Attempt History */}
        {!isStaff && attempts.length > 0 && (
          <section className="history-nexus animate-fade-up" style={{ animationDelay: '300ms' }}>
             <div className="nexus-header">
                <h3><History size={14} /> ATTEMPT LOGS</h3>
                <button className="btn--ghost xs" onClick={() => navigate(historyPath)}>VIEW FULL LOG</button>
             </div>
             <div className="history-stack">
                {attempts.slice(0, 3).map((att) => (
                  <div key={att.id} className="history-item glass-card sm">
                     <div className="history-item__main">
                        <span className={`h-badge ${att.passed ? 'pass' : 'fail'}`}>
                          {att.passed ? "VALID" : "VOID"}
                        </span>
                        <span className="h-score">{att.score} / {assessment.total_marks}</span>
                     </div>
                     <span className="h-time">{timeAgo(att.submitted_at).toUpperCase()}</span>
                  </div>
                ))}
             </div>
          </section>
        )}

      </main>
      <BottomNav />
    </div>
  );
};

export default AssessmentPage;
