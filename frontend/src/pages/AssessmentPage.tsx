import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAssessment,
  getMyAttempts,
  type AssessmentDetail,
  type MyAttempt,
} from "../services/assessments";
import TopBar from "../components/TopBar";

const DURATION_MINUTES = 30;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AssessmentPage() {
  const { assessmentId } = useParams();
  const navigate         = useNavigate();

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [attempts, setAttempts]     = useState<MyAttempt[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!assessmentId) return;
    const id = Number(assessmentId);

    Promise.all([
      getAssessment(id),
      getMyAttempts(id),
    ])
      .then(([a, att]) => {
        setAssessment(a);
        setAttempts(att);
      })
      .catch(() => setError("Failed to load assessment. Please go back and try again."))
      .finally(() => setLoading(false));
  }, [assessmentId]);

  const bestAttempt = attempts.length > 0
    ? attempts.reduce((best, a) => a.score > best.score ? a : best, attempts[0])
    : null;

  const hasPassedBefore = attempts.some((a) => a.passed);

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar title="Assessment" />
        <main className="page-content page-content--narrow">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ marginBottom: "var(--space-4)" }}>
              <div className="skeleton skeleton-line skeleton-line--title" />
              <div className="skeleton skeleton-line skeleton-line--medium" style={{ marginTop: "var(--space-3)" }} />
            </div>
          ))}
        </main>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="page-shell">
        <TopBar title="Assessment" />
        <main className="page-content page-content--narrow">
          <div className="alert alert--error">{error ?? "Assessment not found."}</div>
          <button className="btn btn--secondary" onClick={() => navigate(-1)}>Go back</button>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title="Assessment" />
      <main className="page-content page-content--narrow page-enter">

        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        {/* Assessment info card */}
        <div className="card" style={{ marginBottom: "var(--space-4)" }}>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: "var(--space-2)",
          }}>
            {assessment.title}
          </h1>
          {assessment.description && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
              {assessment.description}
            </p>
          )}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "var(--space-3)",
            padding: "var(--space-4)",
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-md)",
          }}>
            {[
              { label: "Questions", value: assessment.questions.length },
              { label: "Total Marks", value: assessment.total_marks },
              { label: "Pass Marks", value: assessment.pass_marks },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                }}>
                  {value}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best score badge */}
        {bestAttempt && (
          <div className={`alert ${hasPassedBefore ? "alert--success" : "alert--warning"}`} style={{ marginBottom: "var(--space-4)" }}>
            {hasPassedBefore
              ? `✓ You passed this assessment. Best score: ${bestAttempt.score}/${assessment.total_marks}`
              : `Your best score so far: ${bestAttempt.score}/${assessment.total_marks} — keep trying!`}
          </div>
        )}

        {/* Rules card */}
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-base)",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "var(--space-4)",
          }}>
            Instructions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {[
              `This assessment has ${assessment.questions.length} questions worth ${assessment.total_marks} marks total.`,
              `You need ${assessment.pass_marks} marks to pass.`,
              `Time allowed: ${DURATION_MINUTES} minutes. The assessment will auto-submit when time runs out.`,
              "Each question has exactly one correct answer. Select carefully.",
              "You can attempt this assessment multiple times. Only your best score is shown on the leaderboard.",
              "Do not refresh or close the page during the assessment — your progress may be lost.",
            ].map((rule, i) => (
              <div key={i} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--brand-primary-glow)",
                  color: "var(--brand-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  flexShrink: 0,
                  fontFamily: "var(--font-display)",
                }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {rule}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          className="btn btn--primary btn--lg"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => navigate(`/assessments/${assessmentId}/take`)}
        >
          {attempts.length === 0 ? "Start Assessment" : "Attempt Again"}
        </button>

        {/* History */}
        {attempts.length > 0 && (
          <div style={{ marginTop: "var(--space-8)" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-4)",
            }}>
              <h3 style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-base)",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}>
                Your Attempts
              </h3>
              <button
                className="btn btn--ghost"
                style={{ fontSize: "var(--text-xs)" }}
                onClick={() => navigate(`/assessments/${assessmentId}/history`)}
              >
                View all
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {attempts.slice(0, 3).map((attempt, i) => (
                <div
                  key={attempt.id}
                  className="card page-enter"
                  style={{ animationDelay: `${i * 50}ms`, padding: "var(--space-3) var(--space-4)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <span className={`badge ${attempt.passed ? "badge--success" : "badge--error"}`}>
                        {attempt.passed ? "Passed" : "Failed"}
                      </span>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                        {attempt.score} / {assessment.total_marks} marks
                      </span>
                    </div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      {timeAgo(attempt.submitted_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}