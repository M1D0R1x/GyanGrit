// pages.AssessmentTakePage
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAssessment,
  startAssessment,
  submitAssessment,
  type AssessmentDetail,
  type AssessmentQuestion,
} from "../services/assessments";
import { getOfflineAssessment, enqueueOfflineAction, isOnline } from "../services/offline";

const DURATION_MINUTES = 30;
const DURATION_SECONDS = DURATION_MINUTES * 60;
const LETTERS = ["A", "B", "C", "D", "E"];

function formatTime(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ── Option ─────────────────────────────────────────────────────────────────

function OptionBtn({
  letter,
  text,
  selected,
  onSelect,
}: {
  letter: string;
  text: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`assessment-option-btn${selected ? " assessment-option-btn--selected" : ""}`}
    >
      <span className="assessment-option-btn__letter">{letter}</span>
      <span className="assessment-option-btn__text">{text}</span>
      <svg
        className="assessment-option-btn__check"
        width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  );
}

// ── Question view ──────────────────────────────────────────────────────────

function QuestionView({
  question,
  index,
  total,
  selected,
  onSelect,
  onPrev,
  onNext,
}: {
  question: AssessmentQuestion;
  index: number;
  total: number;
  selected: number | undefined;
  onSelect: (optionId: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const isFirst = index === 0;
  const isLast  = index === total - 1;

  return (
    <>
      <div className="assessment-question-scroll">
        <div className="assessment-question-meta">
          <span className="assessment-question-label">
            Question {index + 1} of {total}
          </span>
          <span className="assessment-marks-badge">
            {question.marks} {question.marks === 1 ? "mark" : "marks"}
          </span>
        </div>

        <p className="assessment-question-text">{question.text}</p>

        <div className="assessment-options">
          {question.options.map((opt, i) => (
            <OptionBtn
              key={opt.id}
              letter={LETTERS[i] ?? String(i + 1)}
              text={opt.text}
              selected={selected === opt.id}
              onSelect={() => onSelect(opt.id)}
            />
          ))}
        </div>
      </div>

      <nav className="assessment-nav" aria-label="Question navigation">
        <button
          className="assessment-nav__btn"
          onClick={onPrev}
          disabled={isFirst}
          aria-label="Previous question"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Previous
        </button>
        <button
          className={`assessment-nav__btn${!isLast ? " assessment-nav__btn--next" : ""}`}
          onClick={onNext}
          disabled={isLast}
          aria-label="Next question"
        >
          Next
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </nav>
    </>
  );
}

// ── Submit confirmation ────────────────────────────────────────────────────

function SubmitScreen({
  assessment,
  answers,
  submitting,
  onConfirm,
  onBack,
}: {
  assessment: AssessmentDetail;
  answers: Record<number, number>;
  submitting: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const answered   = Object.keys(answers).length;
  const total      = assessment.questions.length;
  const unanswered = total - answered;
  const allDone    = unanswered === 0;

  return (
    <div className="assessment-submit-screen">
      <div className="assessment-submit-screen__center">
        <div className={`assessment-submit-screen__icon${allDone ? " assessment-submit-screen__icon--ready" : " assessment-submit-screen__icon--warn"}`}>
          {allDone ? "✓" : "!"}
        </div>

        <div>
          <h2 className="assessment-submit-screen__title">Ready to submit?</h2>
          <p className="assessment-submit-screen__sub">
            You answered <strong style={{ color: "var(--ink-primary)" }}>{answered} of {total}</strong> questions.
          </p>
        </div>

        <div className="assessment-answer-grid">
          {assessment.questions.map((q, i) => (
            <div
              key={q.id}
              className={`assessment-answer-box${answers[q.id] !== undefined ? " assessment-answer-box--answered" : ""}`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {unanswered > 0 && (
          <div className="alert alert--warning" style={{ marginBottom: 0 }}>
            {unanswered} unanswered question{unanswered !== 1 ? "s" : ""} will score 0.
          </div>
        )}
      </div>

      <div className="assessment-submit-screen__actions">
        <button
          className="btn btn--primary btn--full btn--lg"
          onClick={onConfirm}
          disabled={submitting}
        >
          {submitting
            ? <><span className="btn__spinner" aria-hidden="true" /> Submitting…</>
            : "Submit Assessment"}
        </button>
        <button
          className="btn btn--secondary btn--full btn--lg"
          onClick={onBack}
          disabled={submitting}
        >
          Review Answers
        </button>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function AssessmentTakePage() {
  // Route: /assessments/:grade/:subject/:assessmentId/take
  const { grade: gradeParam, subject: subjectSlug, assessmentId } = useParams<{
    grade: string;
    subject: string;
    assessmentId: string;
  }>();
  const navigate = useNavigate();

  const grade = gradeParam ? Number(gradeParam) : null;

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [attemptId, setAttemptId]   = useState<number | null>(null);
  const [answers, setAnswers]       = useState<Record<number, number>>({});
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showSubmit, setShowSubmit] = useState(false);
  const [timeLeft, setTimeLeft]     = useState(DURATION_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const answersRef    = useRef(answers);
  const attemptRef    = useRef(attemptId);
  const assessRef     = useRef(assessment);
  const submittingRef = useRef(false);
  answersRef.current  = answers;
  attemptRef.current  = attemptId;
  assessRef.current   = assessment;

  const storageKey = `gg_q_${assessmentId ?? ""}`;

  useEffect(() => {
    if (!assessmentId) return;
    const id = Number(assessmentId);
    async function init() {
      try {
        const [a, attempt] = await Promise.all([getAssessment(id), startAssessment(id)]);
        setAssessment(a);
        setAttemptId(attempt.attempt_id);
        try {
          const saved = sessionStorage.getItem(storageKey);
          if (saved) setAnswers(JSON.parse(saved) as Record<number, number>);
        } catch { /* silent */ }
        setTimerActive(true);
      } catch {
        // Offline fallback: try IndexedDB
        try {
          const offlineA = await getOfflineAssessment(id);
          if (offlineA) {
            // Convert OfflineAssessment to AssessmentDetail shape
            const detail: AssessmentDetail = {
              id: offlineA.id,
              title: offlineA.title,
              description: "",
              total_marks: offlineA.totalMarks,
              pass_marks: offlineA.passMarks,
              questions: offlineA.questions.map(q => ({
                id: q.id,
                text: q.text,
                marks: q.marks,
                order: q.order,
                options: q.options,
              })) as AssessmentQuestion[],
            };
            setAssessment(detail);
            setIsOfflineMode(true);
            try {
              const saved = sessionStorage.getItem(storageKey);
              if (saved) setAnswers(JSON.parse(saved) as Record<number, number>);
            } catch { /* silent */ }
            setTimerActive(true);
            return;
          }
        } catch { /* IndexedDB also failed */ }
        setError("Failed to load assessment. You may be offline — download it first to study offline.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  useEffect(() => {
    if (!Object.keys(answers).length) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(answers)); }
    catch { /* silent */ }
  }, [answers, storageKey]);

  const doSubmit = useCallback(async (finalAnswers: Record<number, number>) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const a  = assessRef.current;
    const id = attemptRef.current;
    if (!a) return;
    try {
      sessionStorage.removeItem(storageKey);
      if (isOfflineMode || !isOnline()) {
        // Queue submission for sync when back online
        await enqueueOfflineAction("assessment_submit", {
          assessmentId:    a.id,
          attemptId:       id,
          selectedOptions: finalAnswers,
        });
        // Show a friendly result page with offline notice
        navigate("/assessment-result", {
          state: {
            offline: true,
            assessment_id:  a.id,
            grade:          grade,
            subject_slug:   subjectSlug,
            score:          null,
            total_marks:    a.total_marks,
            pass_marks:     a.pass_marks,
            passed:         null,
          },
        });
        return;
      }
      const result = await submitAssessment(a.id, {
        attempt_id:       id!,
        selected_options: finalAnswers,
      });
      // Pass grade + subject slug in result state so AssessmentResultPage
      // can build the correct history URL
      navigate("/assessment-result", {
        state: {
          ...result,
          assessment_id:  a.id,
          grade:          grade,
          subject_slug:   subjectSlug,
        },
      });
    } catch {
      submittingRef.current = false;
      setSubmitting(false);
      setError("Submission failed. Please try again.");
      setShowSubmit(false);
    }
  }, [navigate, storageKey, grade, subjectSlug, isOfflineMode]);

  useEffect(() => {
    if (!timerActive) return;
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(t); void doSubmit(answersRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timerActive, doSubmit]);

  const handleSelect = (questionId: number, optionId: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    const total = assessment?.questions.length ?? 0;
    if (currentIdx < total - 1) {
      setTimeout(() => setCurrentIdx((i) => i + 1), 280);
    } else {
      setTimeout(() => setShowSubmit(true), 350);
    }
  };

  if (loading) {
    return (
      <div className="assessment-take-shell">
        <div className="assessment-topbar" />
        <div style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 60, borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (error && !assessment) {
    return (
      <div className="assessment-take-shell">
        <div style={{ padding: "var(--space-6)" }}>
          <div className="alert alert--error">{error}</div>
          <button className="btn btn--secondary" onClick={() => navigate(-1)}>Go back</button>
        </div>
      </div>
    );
  }

  if (!assessment) return null;

  const total         = assessment.questions.length;
  const answeredCount = Object.keys(answers).length;
  const progressPct   = total ? (answeredCount / total) * 100 : 0;
  const isWarning     = timeLeft <= 300;
  const isCritical    = timeLeft <= 60;
  const timerClass    = isCritical ? "critical" : isWarning ? "warning" : "normal";
  const currentQ      = assessment.questions[currentIdx];
  const allReady      = answeredCount === total;

  return (
    <div className="assessment-take-shell">
      {/* Top bar */}
      <div className="assessment-topbar">
        <div className="assessment-dots" role="tablist" aria-label="Question progress">
          {assessment.questions.map((q, i) => {
            const answered = answers[q.id] !== undefined;
            const active   = i === currentIdx && !showSubmit;
            return (
              <button
                key={q.id}
                role="tab"
                aria-selected={active}
                aria-label={`Question ${i + 1}${answered ? ", answered" : ""}`}
                className={`assessment-dot${active ? " assessment-dot--active" : answered ? " assessment-dot--answered" : " assessment-dot--unanswered"}`}
                onClick={() => { setCurrentIdx(i); setShowSubmit(false); }}
              />
            );
          })}
        </div>

        {isOfflineMode && (
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: "0.06em",
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444", borderRadius: "var(--radius-full)", padding: "1px 6px",
            flexShrink: 0,
          }}>OFFLINE</span>
        )}

        <div className={`assessment-timer assessment-timer--${timerClass}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: isCritical ? "var(--error)" : isWarning ? "var(--warning)" : "var(--ink-muted)" }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className={`assessment-timer__text assessment-timer__text--${timerClass}`}>
            {formatTime(timeLeft)}
          </span>
        </div>

        <button
          className={`assessment-submit-trigger${allReady ? " assessment-submit-trigger--ready" : ""}`}
          onClick={() => setShowSubmit(true)}
        >
          Submit
        </button>
      </div>

      {/* Progress bar */}
      <div className="assessment-topbar-progress">
        <div
          className={`assessment-topbar-progress__fill${allReady ? " assessment-topbar-progress__fill--complete" : ""}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {error && (
        <div className="alert alert--warning" style={{ margin: "var(--space-3) var(--space-4) 0" }}>
          {error}
        </div>
      )}

      {showSubmit ? (
        <SubmitScreen
          assessment={assessment}
          answers={answers}
          submitting={submitting}
          onConfirm={() => void doSubmit(answers)}
          onBack={() => setShowSubmit(false)}
        />
      ) : currentQ ? (
        <QuestionView
          question={currentQ}
          index={currentIdx}
          total={total}
          selected={answers[currentQ.id]}
          onSelect={(optId) => handleSelect(currentQ.id, optId)}
          onPrev={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          onNext={() => {
            if (currentIdx < total - 1) setCurrentIdx((i) => i + 1);
            else setShowSubmit(true);
          }}
        />
      ) : null}
    </div>
  );
}
