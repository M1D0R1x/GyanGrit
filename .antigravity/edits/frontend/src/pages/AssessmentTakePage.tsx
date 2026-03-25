import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAssessment,
  startAssessment,
  submitAssessment,
  type AssessmentDetail,
  type AssessmentQuestion,
} from "../services/assessments";
import TopBar from "../components/TopBar";

const DURATION_MINUTES = 30;
const DURATION_SECONDS = DURATION_MINUTES * 60;
const LETTERS = ["A", "B", "C", "D", "E"];

const formatTime = (s: number): string => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const AssessmentTakePage: React.FC = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS);
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    if (assessmentId) {
       Promise.all([getAssessment(Number(assessmentId)), startAssessment(Number(assessmentId))])
         .then(([a]) => setAssessment(a))
         .finally(() => setLoading(false));
    }
  }, [assessmentId]);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(prev => prev > 0 ? prev - 1 : 0), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSelect = (qId: number, oId: number) => {
    setAnswers({ ...answers, [qId]: oId });
  };

  if (loading) return <div className="page-shell"><TopBar /><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="btn__spinner" /></main></div>;

  const currentQ = assessment?.questions[currentIdx];

  return (
    <div className="page-shell" style={{ background: '#000' }}>
      {/* Cinematic HUD */}
      <nav style={{ padding: 'var(--space-6) var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
         <div style={{ display: 'flex', gap: '8px' }}>
            {assessment?.questions.map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === currentIdx ? 'var(--role-student)' : answers[assessment.questions[i].id] ? 'var(--text-primary)' : 'var(--text-dim)', transition: 'all 0.3s' }} />
            ))}
         </div>
         <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'var(--text-xl)', color: timeLeft < 300 ? '#ff6b6b' : 'var(--text-primary)' }}>
            {formatTime(timeLeft)}
         </div>
         <button className="btn--primary" onClick={() => setShowSubmit(true)} style={{ fontSize: '11px', padding: '0 var(--space-6)' }}>FINALIZE</button>
      </nav>

      <main className="page-content page-enter" style={{ maxWidth: '720px', margin: '0 auto', padding: 'var(--space-12) var(--space-6)' }}>
         
         {!showSubmit ? (
            <div className="animate-fade-up">
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
                  <div className="role-tag role-tag--student">QUESTION {currentIdx + 1} OF {assessment?.questions.length}</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>{currentQ?.marks} POINTS</div>
               </div>
               <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, lineHeight: 1.4, marginBottom: 'var(--space-12)' }}>{currentQ?.text}</h2>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {currentQ?.options.map((opt, i) => (
                    <button 
                      key={opt.id} 
                      onClick={() => handleSelect(currentQ.id, opt.id)}
                      className="glass-card" 
                      style={{ padding: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', border: answers[currentQ.id] === opt.id ? '2px solid var(--role-student)' : '1px solid var(--glass-border)', textAlign: 'left', transition: 'all 0.2s' }}
                    >
                       <div style={{ width: 28, height: 28, borderRadius: '6px', background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900 }}>{LETTERS[i]}</div>
                       <div style={{ fontWeight: 600 }}>{opt.text}</div>
                    </button>
                  ))}
               </div>

               <div style={{ marginTop: 'var(--space-20)', display: 'flex', justifyContent: 'space-between' }}>
                  <button className="btn--ghost" disabled={currentIdx === 0} onClick={() => setCurrentIdx(currentIdx - 1)}>PREVIOUS</button>
                  <button className="btn--ghost" disabled={currentIdx === (assessment?.questions.length || 0) - 1} onClick={() => setCurrentIdx(currentIdx + 1)}>NEXT UNIT</button>
               </div>
            </div>
         ) : (
            <div className="animate-fade-up text-center" style={{ textAlign: 'center' }}>
               <h1 className="text-gradient" style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-6)' }}>Finalize Intelligence.</h1>
               <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-12)' }}>You have addressed {Object.keys(answers).length} of {assessment?.questions.length} units. Proceed to official submission?</p>
               
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-3)', maxWidth: '300px', margin: '0 auto var(--space-12)' }}>
                  {assessment?.questions.map((q, i) => (
                    <div key={i} style={{ aspectRatio: '1/1', borderRadius: '8px', background: answers[q.id] ? 'var(--role-student)' : 'var(--bg-elevated)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '12px' }}>{i + 1}</div>
                  ))}
               </div>

               <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
                  <button className="btn--primary" onClick={() => navigate(-1)} style={{ padding: '0 var(--space-10)' }}>SUBMIT TO LEDGER</button>
                  <button className="btn--ghost" onClick={() => setShowSubmit(false)}>RETURN TO REVIEW</button>
               </div>
            </div>
         )}

      </main>
    </div>
  );
};

export default AssessmentTakePage;
