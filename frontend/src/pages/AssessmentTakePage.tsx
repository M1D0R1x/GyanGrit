import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAssessment,
  startAssessment,
  submitAssessment,
  type AssessmentDetail,
  type AssessmentQuestion,
} from "../services/assessments";

const DURATION_MINUTES = 30;
const DURATION_SECONDS = DURATION_MINUTES * 60;

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ── Option button ──────────────────────────────────────────────────────────

function OptionButton({
  label,
  text,
  selected,
  onSelect,
}: {
  label: string;
  text: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onSelect}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        width: "100%",
        padding: "var(--space-4)",
        borderRadius: "var(--radius-lg)",
        border: `2px solid ${selected ? "var(--brand-primary)" : "var(--border-default)"}`,
        background: selected
          ? "var(--brand-primary-glow)"
          : pressed
          ? "var(--bg-elevated)"
          : "var(--bg-surface)",
        cursor: "pointer",
        textAlign: "left",
        transform: pressed ? "scale(0.98)" : "scale(1)",
        transition: "all 0.12s ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Letter circle */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: selected ? "var(--brand-primary)" : "var(--bg-elevated)",
        border: `2px solid ${selected ? "var(--brand-primary)" : "var(--border-subtle)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: "var(--text-sm)",
        color: selected ? "#fff" : "var(--text-muted)",
        flexShrink: 0,
        transition: "all 0.12s",
      }}>
        {label}
      </div>

      <span style={{
        fontSize: "var(--text-base)",
        lineHeight: 1.5,
        color: selected ? "var(--brand-primary)" : "var(--text-primary)",
        fontWeight: selected ? 600 : 400,
        paddingTop: "var(--space-1)",
        transition: "color 0.12s",
      }}>
        {text}
      </span>

      {selected && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="var(--brand-primary)" strokeWidth="2.5" strokeLinecap="round"
          strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: "auto", paddingTop: "var(--space-1)" }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
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
  isFirst,
  isLast,
}: {
  question: AssessmentQuestion;
  index: number;
  total: number;
  selected: number | undefined;
  onSelect: (optionId: number) => void;
  onPrev: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const letters = ["A", "B", "C", "D", "E"];

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "calc(100vh - 120px)",
      padding: "var(--space-5)",
    }}>
      {/* Question number + marks */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "var(--space-4)",
      }}>
        <span style={{
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}>
          Question {index + 1} of {total}
        </span>
        <span style={{
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          padding: "var(--space-1) var(--space-2)",
          borderRadius: "var(--radius-full)",
          background: "var(--brand-primary-glow)",
          color: "var(--brand-primary)",
        }}>
          {question.marks} {question.marks === 1 ? "mark" : "marks"}
        </span>
      </div>

      {/* Question text */}
      <div style={{
        fontSize: "var(--text-lg)",
        fontWeight: 700,
        color: "var(--text-primary)",
        fontFamily: "var(--font-display)",
        lineHeight: 1.5,
        marginBottom: "var(--space-6)",
        letterSpacing: "-0.01em",
        flex: "0 0 auto",
      }}>
        {question.text}
      </div>

      {/* Options */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        flex: 1,
      }}>
        {question.options.map((opt, i) => (
          <OptionButton
            key={opt.id}
            label={letters[i] ?? String(i + 1)}
            text={opt.text}
            selected={selected === opt.id}
            onSelect={() => onSelect(opt.id)}
          />
        ))}
      </div>

      {/* Prev / Next navigation */}
      <div style={{
        display: "flex",
        gap: "var(--space-3)",
        marginTop: "var(--space-6)",
        paddingBottom: "var(--space-4)",
      }}>
        <button
          onClick={onPrev}
          disabled={isFirst}
          style={{
            flex: 1,
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
            border: "1.5px solid var(--border-default)",
            background: isFirst ? "transparent" : "var(--bg-elevated)",
            color: isFirst ? "var(--text-muted)" : "var(--text-secondary)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            cursor: isFirst ? "not-allowed" : "pointer",
            opacity: isFirst ? 0.4 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            transition: "all 0.12s",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Previous
        </button>

        <button
          onClick={onNext}
          disabled={isLast}
          style={{
            flex: 1,
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
            border: "none",
            background: isLast ? "var(--bg-elevated)" : "var(--brand-primary)",
            color: isLast ? "var(--text-muted)" : "#fff",
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            cursor: isLast ? "default" : "pointer",
            opacity: isLast ? 0.4 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            transition: "all 0.12s",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Next
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Submit confirmation screen ─────────────────────────────────────────────

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
  const answeredCount  = Object.keys(answers).length;
  const totalQuestions = assessment.questions.length;
  const unanswered     = totalQuestions - answeredCount;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "calc(100vh - 120px)",
      padding: "var(--space-6) var(--space-5)",
    }}>
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: "var(--space-4)",
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: unanswered === 0 ? "rgba(63,185,80,0.12)" : "rgba(245,158,11,0.12)",
          border: `2px solid ${unanswered === 0 ? "var(--success)" : "var(--warning)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
        }}>
          {unanswered === 0 ? "✓" : "!"}
        </div>

        <div>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl)",
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: "var(--space-2)",
          }}>
            Ready to submit?
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", lineHeight: 1.6 }}>
            You answered{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {answeredCount} of {totalQuestions}
            </strong>{" "}
            questions.
          </p>
        </div>

        {/* Answer summary grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "var(--space-2)",
          width: "100%",
          maxWidth: 280,
        }}>
          {assessment.questions.map((q, i) => {
            const answered = answers[q.id] !== undefined;
            return (
              <div
                key={q.id}
                style={{
                  aspectRatio: "1",
                  borderRadius: "var(--radius-sm)",
                  background: answered ? "rgba(63,185,80,0.12)" : "var(--bg-elevated)",
                  border: `2px solid ${answered ? "var(--success)" : "var(--border-default)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "var(--text-xs)",
                  color: answered ? "var(--success)" : "var(--text-muted)",
                }}
              >
                {i + 1}
              </div>
            );
          })}
        </div>

        {unanswered > 0 && (
          <div className="alert alert--warning" style={{ textAlign: "left", width: "100%" }}>
            {unanswered} unanswered question{unanswered !== 1 ? "s" : ""} will score 0.
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-4)" }}>
        <button
          onClick={onConfirm}
          disabled={submitting}
          style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
            border: "none",
            background: "var(--brand-primary)",
            color: "#fff",
            fontSize: "var(--text-base)",
            fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {submitting ? (
            <><span className="btn__spinner" aria-hidden="true" /> Submitting…</>
          ) : (
            "Submit Assessment"
          )}
        </button>
        <button
          onClick={onBack}
          disabled={submitting}
          style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
            border: "1.5px solid var(--border-default)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: "var(--text-base)",
            fontWeight: 600,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Review Answers
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function AssessmentTakePage() {
  const { assessmentId } = useParams();
  const navigate         = useNavigate();

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

  const answersRef    = useRef(answers);
  const attemptRef    = useRef(attemptId);
  const assessRef     = useRef(assessment);
  const submittingRef = useRef(false);
  answersRef.current  = answers;
  attemptRef.current  = attemptId;
  assessRef.current   = assessment;

  const storageKey = `gg_assessment_${assessmentId ?? ""}`;

  useEffect(() => {
    if (!assessmentId) return;
    const id = Number(assessmentId);

    async function init() {
      try {
        const [a, attempt] = await Promise.all([
          getAssessment(id),
          startAssessment(id),
        ]);
        setAssessment(a);
        setAttemptId(attempt.attempt_id);

        try {
          const saved = sessionStorage.getItem(storageKey);
          if (saved) setAnswers(JSON.parse(saved) as Record<number, number>);
        } catch { /* silent */ }

        setTimerActive(true);
      } catch {
        setError("Failed to load assessment. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  useEffect(() => {
    if (Object.keys(answers).length === 0) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(answers)); }
    catch { /* silent */ }
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
      navigate("/assessment-result", { state: { ...result, assessment_id: a.id } });
    } catch {
      submittingRef.current = false;
      setSubmitting(false);
      setError("Submission failed. Please try again.");
    }
  }, [navigate, storageKey]);

  useEffect(() => {
    if (!timerActive) return;
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          void doSubmit(answersRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timerActive, doSubmit]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-base)" }}>
        <div style={{
          height: 56,
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
        }} />
        <div style={{ padding: "var(--space-5)" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{
              height: 60,
              borderRadius: "var(--radius-lg)",
              marginBottom: "var(--space-3)",
            }} />
          ))}
        </div>
      </div>
    );
  }

  if (error && !assessment) {
    return (
      <div style={{ padding: "var(--space-6)" }}>
        <div className="alert alert--error">{error}</div>
        <button className="btn btn--secondary" style={{ marginTop: "var(--space-4)" }}
          onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }

  if (!assessment) return null;

  const totalQuestions = assessment.questions.length;
  const answeredCount  = Object.keys(answers).length;
  const isWarning      = timeLeft <= 300;
  const isCritical     = timeLeft <= 60;
  const currentQ       = assessment.questions[currentIdx];

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      background: "var(--bg-base)",
      maxWidth: 600,
      margin: "0 auto",
    }}>
      {/* ── Top bar ── */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 var(--space-4)",
        height: 56,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
      }}>
        {/* Progress dots */}
        <div style={{
          flex: 1,
          display: "flex",
          gap: 4,
          alignItems: "center",
          overflow: "hidden",
        }}>
          {assessment.questions.map((q, i) => {
            const answered = answers[q.id] !== undefined;
            const isCurrent = i === currentIdx;
            return (
              <button
                key={q.id}
                onClick={() => { setCurrentIdx(i); setShowSubmit(false); }}
                style={{
                  flexShrink: 0,
                  width: isCurrent ? 24 : 8,
                  height: 8,
                  borderRadius: 99,
                  background: isCurrent
                    ? "var(--brand-primary)"
                    : answered
                    ? "var(--success)"
                    : "var(--bg-elevated)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  WebkitTapHighlightColor: "transparent",
                }}
                aria-label={`Question ${i + 1}`}
              />
            );
          })}
        </div>

        {/* Timer */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-1)",
          padding: "var(--space-1) var(--space-2)",
          borderRadius: "var(--radius-md)",
          background: isCritical
            ? "rgba(239,68,68,0.12)"
            : isWarning
            ? "rgba(245,158,11,0.10)"
            : "transparent",
          transition: "background 0.3s",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke={isCritical ? "var(--error)" : isWarning ? "var(--warning)" : "var(--text-muted)"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-sm)",
            fontWeight: 800,
            color: isCritical ? "var(--error)" : isWarning ? "var(--warning)" : "var(--text-primary)",
            letterSpacing: "0.04em",
            transition: "color 0.3s",
          }}>
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Submit trigger */}
        <button
          onClick={() => setShowSubmit(true)}
          style={{
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-md)",
            border: "1.5px solid var(--brand-primary)",
            background: answeredCount === totalQuestions ? "var(--brand-primary)" : "transparent",
            color: answeredCount === totalQuestions ? "#fff" : "var(--brand-primary)",
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s",
            WebkitTapHighlightColor: "transparent",
            whiteSpace: "nowrap",
          }}
        >
          Submit
        </button>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ height: 3, background: "var(--bg-elevated)" }}>
        <div style={{
          height: "100%",
          width: `${totalQuestions ? (answeredCount / totalQuestions) * 100 : 0}%`,
          background: answeredCount === totalQuestions ? "var(--success)" : "var(--brand-primary)",
          transition: "width 0.3s ease",
        }} />
      </div>

      {/* ── Content ── */}
      {error && (
        <div className="alert alert--warning" style={{ margin: "var(--space-4)" }}>{error}</div>
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
          total={totalQuestions}
          selected={answers[currentQ.id]}
          onSelect={(optId) => {
            setAnswers((prev) => ({ ...prev, [currentQ.id]: optId }));
            // Auto-advance to next question after short delay
            if (currentIdx < totalQuestions - 1) {
              setTimeout(() => setCurrentIdx((i) => i + 1), 300);
            } else {
              // Last question — show submit screen
              setTimeout(() => setShowSubmit(true), 400);
            }
          }}
          onPrev={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          onNext={() => {
            if (currentIdx < totalQuestions - 1) {
              setCurrentIdx((i) => i + 1);
            } else {
              setShowSubmit(true);
            }
          }}
          isFirst={currentIdx === 0}
          isLast={currentIdx === totalQuestions - 1}
        />
      ) : null}
    </div>
  );
}