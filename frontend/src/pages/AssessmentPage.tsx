import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAssessment,
  startAssessment,
  submitAssessment,
  type AssessmentDetail,
} from "../services/assessments";
import TopBar from "../components/TopBar";

type StartResponse = { attempt_id: number; assessment_id: number; started_at: string };
type SubmitResponse = { attempt_id: number; score: number; passed: boolean; total_marks: number; pass_marks: number };

export default function AssessmentPage() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [attemptId, setAttemptId]   = useState<number | null>(null);
  const [answers, setAnswers]       = useState<Record<number, number>>({});
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!assessmentId) return;

    async function init() {
      try {
        const [assessmentData, attempt] = await Promise.all([
          getAssessment(Number(assessmentId)),
          startAssessment(Number(assessmentId)) as Promise<StartResponse>,
        ]);
        setAssessment(assessmentData);
        setAttemptId(attempt.attempt_id);
      } catch {
        setError("Failed to load assessment. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [assessmentId]);

  const handleSubmit = async () => {
    if (!assessment || !attemptId || submitting) return;

    const unanswered = assessment.questions.filter((q) => answers[q.id] === undefined);
    if (unanswered.length > 0) {
      setError(`Please answer all questions. ${unanswered.length} question(s) remaining.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Backend expects selected_options not answers
      const result = await submitAssessment(assessment.id, {
        attempt_id: attemptId,
        selected_options: answers,
      }) as SubmitResponse;

      navigate("/assessment-result", {
        state: {
          ...result,
          assessment_id: assessment.id,
        },
      });
    } catch {
      setError("Submission failed. Please try again.");
      setSubmitting(false);
    }
  };

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

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = assessment.questions.length;

  return (
    <div className="page-shell">
      <TopBar title={assessment.title} />
      <main className="page-content page-content--narrow page-enter">

        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        {/* Header */}
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl)",
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.03em",
            marginBottom: "var(--space-2)",
          }}>
            {assessment.title}
          </h1>
          {assessment.description && (
            <p className="card__description">{assessment.description}</p>
          )}
          <div style={{
            display: "flex",
            gap: "var(--space-6)",
            marginTop: "var(--space-4)",
            paddingTop: "var(--space-4)",
            borderTop: "1px solid var(--border-subtle)",
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
          }}>
            <span>Total marks: <strong style={{ color: "var(--text-primary)" }}>{assessment.total_marks}</strong></span>
            <span>Pass marks: <strong style={{ color: "var(--success)" }}>{assessment.pass_marks}</strong></span>
            <span>
              Answered:{" "}
              <strong style={{ color: answeredCount === totalQuestions ? "var(--success)" : "var(--text-primary)" }}>
                {answeredCount}/{totalQuestions}
              </strong>
            </span>
          </div>
          <div className="progress-bar" style={{ marginTop: "var(--space-3)", marginBottom: 0 }}>
            <div
              className="progress-bar__fill"
              style={{
                width: `${totalQuestions ? (answeredCount / totalQuestions) * 100 : 0}%`,
                background: answeredCount === totalQuestions ? "var(--success)" : "var(--brand-primary)",
              }}
            />
          </div>
        </div>

        {error && <div className="alert alert--error" style={{ marginBottom: "var(--space-4)" }}>{error}</div>}

        {/* Questions */}
        {assessment.questions.map((q, idx) => (
          <div
            key={q.id}
            className="assessment-question page-enter"
            style={{ animationDelay: `${idx * 80}ms` }}
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
                    onChange={() =>
                      setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))
                    }
                  />
                  <span className="assessment-option__label">{opt.text}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Submit */}
        <div style={{
          position: "sticky",
          bottom: "var(--space-6)",
          marginTop: "var(--space-8)",
        }}>
          <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              {totalQuestions - answeredCount > 0
                ? `${totalQuestions - answeredCount} questions remaining`
                : "All questions answered"}
            </span>
            <button
              className="btn btn--primary btn--lg"
              onClick={handleSubmit}
              disabled={submitting || answeredCount === 0}
            >
              {submitting ? (
                <>
                  <span className="btn__spinner" aria-hidden="true" />
                  Submitting…
                </>
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