import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAssessment,
  startAssessment,
  submitAssessment,
  type AssessmentDetail,
} from "../services/assessments";
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import './AssessmentTakePage.css';

const DURATION_MINUTES = 30;
const DURATION_SECONDS = DURATION_MINUTES * 60;
const LETTERS = ["A", "B", "C", "D", "E"];

const formatTime = (s: number): string => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// ── Option Component ──────────────────────────────────────────────────────────

const OptionBtn: React.FC<{
  letter: string;
  text: string;
  selected: boolean;
  onSelect: () => void;
}> = ({ letter, text, selected, onSelect }) => (
  <button
    onClick={onSelect}
    className={`assessment-option-btn glass-card ${selected ? "selected" : ""}`}
  >
    <div className="option-letter">{letter}</div>
    <div className="option-text">{text}</div>
    {selected && <CheckCircle2 size={16} className="option-check" />}
  </button>
);

// ── Submit Screen Component ──────────────────────────────────────────────────

const SubmitScreen: React.FC<{
  assessment: AssessmentDetail;
  answers: Record<number, number>;
  submitting: boolean;
  onConfirm: () => void;
  onBack: () => void;
}> = ({ assessment, answers, submitting, onConfirm, onBack }) => {
  const answered = Object.keys(answers).length;
  const total = assessment.questions.length;
  const unanswered = total - answered;
  const allDone = unanswered === 0;

  return (
    <div className="submit-overlay page-enter">
       <div className="submit-card glass-card">
          <div className={`status-icon ${allDone ? 'ready' : 'warn'}`}>
            {allDone ? <ShieldCheck size={40} /> : <AlertTriangle size={40} />}
          </div>
          
          <h2 className="display-sm">FINALIZE TRANSMISSION?</h2>
          <p className="submit-stats">
            Addressed <strong className="text-gradient">{answered} of {total}</strong> logical units.
          </p>

          <div className="answer-grid">
            {assessment.questions.map((q, i) => (
              <div 
                key={q.id} 
                className={`grid-box ${answers[q.id] ? 'filled' : ''}`}
                title={`Question ${i+1}`}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {unanswered > 0 && (
            <div className="unanswered-warning">
               <AlertTriangle size={14} /> {unanswered} units remain unaddressed (Score equivalent to VOID).
            </div>
          )}

          <div className="submit-actions">
             <button className="btn--primary lg full" onClick={onConfirm} disabled={submitting}>
                {submitting ? "ENCRYPTING..." : "COMMIT TO LEDGER"}
             </button>
             <button className="btn--ghost lg full" onClick={onBack} disabled={submitting}>
                RETURN TO REVIEW
             </button>
          </div>
       </div>
    </div>
  );
};

// ── Main Page Component ──────────────────────────────────────────────────────

const AssessmentTakePage: React.FC = () => {
  const { grade: gradeParam, subject: subjectSlug, assessmentId } = useParams<{
    grade: string;
    subject: string;
    assessmentId: string;
  }>();
  const navigate = useNavigate();
  const grade = gradeParam ? Number(gradeParam) : null;

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showSubmit, setShowSubmit] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS);
  const [timerActive, setTimerActive] = useState(false);

  const answersRef = useRef(answers);
  const attemptRef = useRef(attemptId);
  const assessRef = useRef(assessment);
  const submittingRef = useRef(false);

  answersRef.current = answers;
  attemptRef.current = attemptId;
  assessRef.current = assessment;

  const storageKey = `gg_sync_${assessmentId ?? ""}`;

  useEffect(() => {
    if (!assessmentId) return;
    const id = Number(assessmentId);
    
    const init = async () => {
      try {
        const [a, attempt] = await Promise.all([getAssessment(id), startAssessment(id)]);
        setAssessment(a);
        setAttemptId(attempt.attempt_id);
        
        const saved = sessionStorage.getItem(storageKey);
        if (saved) setAnswers(JSON.parse(saved));
        
        setTimerActive(true);
      } catch {
        setError("SIGNAL INTERFERENCE: Failed to initialize evaluation vectors.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [assessmentId, storageKey]);

  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      sessionStorage.setItem(storageKey, JSON.stringify(answers));
    }
  }, [answers, storageKey]);

  const doSubmit = useCallback(async (finalAnswers: Record<number, number>) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    
    const a = assessRef.current;
    const id = attemptRef.current;
    if (!a || !id) return;

    try {
      sessionStorage.removeItem(storageKey);
      const result = await submitAssessment(a.id, {
        attempt_id: id,
        selected_options: finalAnswers,
      });
      
      navigate("/assessment-result", {
        state: {
          ...result,
          assessment_id: a.id,
          grade: grade,
          subject_slug: subjectSlug,
        },
      });
    } catch {
      submittingRef.current = false;
      setSubmitting(false);
      setError("TRANSMISSION ERROR: Failed to synchronize results.");
      setShowSubmit(false);
    }
  }, [navigate, storageKey, grade, subjectSlug]);

  useEffect(() => {
    if (!timerActive) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(t);
          doSubmit(answersRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timerActive, doSubmit]);

  const handleSelect = (qId: number, oId: number) => {
    setAnswers(prev => ({ ...prev, [qId]: oId }));
    const total = assessment?.questions.length ?? 0;
    if (currentIdx < total - 1) {
      setTimeout(() => setCurrentIdx(prev => prev + 1), 300);
    }
  };

  if (loading) {
    return (
      <div className="take-shell">
        <div className="take-hud skeleton animate-pulse-subtle" />
        <main className="take-main">
           <div className="skeleton-box" style={{ height: '200px', marginBottom: '40px' }} />
           <div className="skeleton-box" style={{ height: '80px', marginBottom: '12px' }} />
           <div className="skeleton-box" style={{ height: '80px', marginBottom: '12px' }} />
        </main>
      </div>
    );
  }

  if (!assessment) return null;

  const total = assessment.questions.length;
  const answeredCount = Object.keys(answers).length;
  const currentQ = assessment.questions[currentIdx];
  const isCritical = timeLeft <= 60;
  const isWarning = timeLeft <= 300;

  return (
    <div className="take-shell">
      {/* HUD Bar */}
      <nav className="take-hud glass-card">
         <div className="hud-progress">
            {assessment.questions.map((q, i) => (
              <button 
                key={q.id}
                className={`hud-dot ${i === currentIdx ? 'active' : ''} ${answers[q.id] ? 'filled' : ''}`}
                onClick={() => { setCurrentIdx(i); setShowSubmit(false); }}
              />
            ))}
         </div>

         <div className={`hud-timer ${isCritical ? 'critical' : isWarning ? 'warning' : ''}`}>
            <Clock size={16} />
            <span>{formatTime(timeLeft)}</span>
         </div>

         <button 
           className={`hud-finalize ${answeredCount === total ? 'ready' : ''}`}
           onClick={() => setShowSubmit(true)}
         >
           FINALIZE
         </button>
      </nav>

      {/* Main content */}
      <main className="take-main page-enter">
         {error && (
           <div className="glass-card error-dock animate-fade-up">
              <ShieldAlert size={16} /> {error}
           </div>
         )}

         {showSubmit ? (
           <SubmitScreen 
             assessment={assessment}
             answers={answers}
             submitting={submitting}
             onConfirm={() => doSubmit(answers)}
             onBack={() => setShowSubmit(false)}
           />
         ) : (
            <div className="question-view">
               <header className="q-header">
                  <div className="role-tag role-tag--student">UNIT {currentIdx + 1} OF {total}</div>
                  <div className="points-badge">{currentQ.marks} PTS</div>
               </header>

               <h2 className="q-text">{currentQ.text}</h2>

               <div className="options-stack">
                  {currentQ.options.map((opt, i) => (
                    <OptionBtn 
                      key={opt.id}
                      letter={LETTERS[i] || String(i+1)}
                      text={opt.text}
                      selected={answers[currentQ.id] === opt.id}
                      onSelect={() => handleSelect(currentQ.id, opt.id)}
                    />
                  ))}
               </div>

               <footer className="take-nav">
                  <button className="btn--ghost" disabled={currentIdx === 0} onClick={() => setCurrentIdx(prev => prev - 1)}>
                     <ChevronLeft size={18} /> PREVIOUS UNIT
                  </button>
                  <button className="btn--ghost" disabled={currentIdx === total - 1} onClick={() => setCurrentIdx(prev => prev + 1)}>
                     NEXT UNIT <ChevronRight size={18} />
                  </button>
               </footer>
            </div>
         )}
      </main>

      {/* Progress Tape */}
      {!showSubmit && (
        <div className="progress-tape">
           <div className="progress-fill" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
      )}
    </div>
  );
};

export default AssessmentTakePage;
