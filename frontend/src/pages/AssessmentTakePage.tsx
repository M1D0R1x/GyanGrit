import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAssessment,
  startAssessment,
  submitAssessment,
  type AssessmentDetail,
} from "../services/assessments";
import TopBar from "../components/TopBar";

const DURATION_MINUTES = 30;
const DURATION_SECONDS = DURATION_MINUTES * 60;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AssessmentTakePage() {
  const { assessmentId } = useParams();
  const navigate         = useNavigate();

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [attemptId, setAttemptId]   = useState<number | null>(null);
  const [answers, setAnswers]       = useState<Record<number, number>>({});
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [timeLeft, setTimeLeft]     = useState(DURATION_SECONDS);
  const [timerStarted, setTimerStarted] = useState(false);

  // Use ref for submit so timer callback always has latest state
  const answersRef  = useRef(answers);
  const attemptRef  = useRef(attemptId);
  const assessRef   = useRef(assessment);
  answersRef.current = answers;
  attemptRef.current = attemptId;
  assessRef.current  = assessment;

  const submittingRef = useRef(false);

  useEffect(() => {
    if (!assessmentId) return;
    const id = Number(assessmentId);

    async function init() {
      try {
        const [assessmentData, attempt] = await Promise.all([
          getAssessment(id),
          startAssessment(id),
        ]);
        setAssessment(assessmentData);
        setAttemptId(attempt.attempt_id);
        setTimerStarted(true);
      } catch {
        setError("Failed to load assessment. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [assessmentId]);

  // Countdown timer
  useEffect(() => {
    if (!timerStarted) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-submit when time runs out
          void handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStarted]);

  const handleAutoSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    const currentAssessment = assessRef.current;
    const currentAttemptId  = attemptRef.current;
    const currentAnswers    = answersRef.current;

    if (!currentAssessment || !currentAttemptId) return;

    try {
      const result = await submitAssessment(currentAssessment.id, {
        attempt_id: currentAttemptId,
        selected_options: currentAnswers,
      });
      navigate("/assessment-result", {
        state: { ...result, assessment_id: currentAssessment.id },
      });
    } catch {
      // If auto-submit fails, navigate to result with partial info
      navigate("/assessment-result", {
        state: {
          score: 0,
          passed: false,
          total_marks: currentAssessment.total_marks,
          pass_marks: currentAssessment.pass_marks,
          assessment_id: currentAssessment.id,
          attempt_id: currentAttemptId,
        },
      });
    }
  };

  const handleSubmit = async () => {
    if (!assessment || !attemptId || submitting) return;

    const unanswered = assessment.questions.filter((q) => answers[q.id] === undefined);
    if (unanswered.length > 0) {
      setError(`Please answer all questions. ${unanswered.length} question(s) remaining.`);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const result = await submitAssessment(assessment.id, {
        attempt_id: attemptId,
        selected_options: answers,
      });
      navigate("/assessment-result", {
        state: { ...result, assessment_id: assessment.id },
      });
    } catch {
      setError("Submission failed. Please try again.");
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const answeredCount  = Object.keys(answers).length;
  const totalQuestions = assessment?.questions.length ?? 0;
  const isWarning      = timeLeft <= 300; // last 5 mins
  const isCritical     = timeLeft <= 60;  // last 1 min

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar title="Assessment" />
        <main className="page-content page-content--narrow">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ marginBottom: "var(--space-4)" }}>
              <div className="skeleton skeleton-line skeleton-line--short" />
              <div className="skeleton skeleton-line skeleton-line--long" style={{ marginTop: "var(--space-3)" }} />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="skeleton" style={{ height: 44, borderRadius: "var(--radius-sm)", marginTop: "var(--space-2)" }} />
              ))}
            </div>
          ))}
        </main>
      </div>
    );
  }

  if (error && !assessment) {
    return (
      <div className="page-shell">
        <TopBar title="Assessment" />
        <main className="page-content page-content--narrow">
          <div className="alert alert--error">{error}</div>
          <button className="btn btn--secondary" onClick={() => navigate(-1)}>Go back</button>
        </main>
      </div>
    );
  }

  if (!assessment) return null;

  return (
    <div className="page-shell">
      <TopBar title={assessment.title} />
      <main className="page-content page-content--narrow page-enter">

        {/* Sticky timer + progress bar */}
        <div style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          padding: "var(--space-3) 0",
          marginBottom: "var(--space-6)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              {answeredCount} / {totalQuestions} answered
            </span>
            <span style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-lg)",
              fontWeight: 800,
              color: isCritical ? "var(--error)" : isWarning ? "var(--warning)" : "var(--text-primary)",
              letterSpacing: "0.05em",
              transition: "color 0.3s",
            }}>
              ⏱ {formatTime(timeLeft)}
            </span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 0 }}>
            <div
              className="progress-bar__fill"
              style={{
                width: `${totalQuestions ? (answeredCount / totalQuestions) * 100 : 0}%`,
                background: answeredCount === totalQuestions ? "var(--success)" : "var(--brand-primary)",
              }}
            />
          </div>
        </div>

        {error && (
          <div className="alert alert--error" style={{ marginBottom: "var(--space-4)" }}>
            {error}
          </div>
        )}

        {/* Questions */}
        {assessment.questions.map((q, idx) => (
          <div
            key={q.id}
            className="assessment-question page-enter"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="assessment-question__number">
              Question {idx + 1} · {q.marks} {q.marks === 1 ? "mark" : "marks"}
            </div>
            <div className="assessment-question__text">{q.text}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {q.options.map((opt) => (
                <label
                  key={opt.id}
                  className={`assessment-option ${answers[q.id] === opt.id ? "assessment-option--selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === opt.id}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                  />
                  <span className="assessment-option__label">{opt.text}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Sticky submit bar */}
        <div style={{
          position: "sticky",
          bottom: "var(--space-6)",
          marginTop: "var(--space-8)",
        }}>
          <div className="card" style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              {totalQuestions - answeredCount > 0
                ? `${totalQuestions - answeredCount} questions remaining`
                : "All questions answered ✓"}
            </span>
            <button
              className="btn btn--primary btn--lg"
              onClick={() => void handleSubmit()}
              disabled={submitting || answeredCount === 0}
            >
              {submitting ? (
                <><span className="btn__spinner" aria-hidden="true" /> Submitting…</>
              ) : (
                "Submit Assessment"
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}