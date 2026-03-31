// pages.AssessmentPage
import { useEffect, useState } from "react";
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

export default function AssessmentPage() {
  // Route: /assessments/:grade/:subject/:assessmentId
  const { grade: gradeParam, subject: subjectSlug, assessmentId } = useParams<{
    grade: string;
    subject: string;
    assessmentId: string;
  }>();
  const navigate    = useNavigate();
  const { user }    = useAuth();

  const grade   = gradeParam ? Number(gradeParam) : null;
  const role    = user?.role ?? "STUDENT";
  const isStaff = (STAFF_ROLES as readonly string[]).includes(role);

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [attempts, setAttempts]     = useState<AttemptHistoryItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!assessmentId) return;
    const id = Number(assessmentId);

    if (isStaff) {
      getAssessmentAdmin(id)
        .then(setAssessment)
        .catch(() => setError("Failed to load assessment."))
        .finally(() => setLoading(false));
    } else {
      Promise.all([getAssessment(id), getMyAttempts(id)])
        .then(([a, att]) => {
          setAssessment(a);
          setAttempts(att);
        })
        .catch(() => setError("Failed to load assessment. Please go back and try again."))
        .finally(() => setLoading(false));
    }
  }, [assessmentId, isStaff]);

  const bestAttempt     = attempts.length > 0
    ? attempts.reduce((best, a) => a.score > best.score ? a : best, attempts[0])
    : null;
  const hasPassedBefore = attempts.some((a) => a.passed);

  // Build slug-based take URL — fall back to /assessments if params missing
  const takePath = (grade && subjectSlug && assessmentId)
    ? assessmentTakePath(grade, subjectSlug, Number(assessmentId))
    : "/assessments";

  const historyPath = (grade && subjectSlug && assessmentId)
    ? assessmentHistoryPath(grade, subjectSlug, Number(assessmentId))
    : "/assessments/history";

  if (loading) {
    return (
      <div style={{ maxWidth: "var(--content-max-narrow)", margin: "0 auto" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-card" style={{ marginBottom: "var(--space-4)" }}>
            <div className="skeleton skeleton-line skeleton-line--title" />
            <div className="skeleton skeleton-line skeleton-line--medium" style={{ marginTop: "var(--space-3)" }} />
          </div>
        ))}
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div style={{ maxWidth: "var(--content-max-narrow)", margin: "0 auto" }}>
        <div className="alert alert--error">{error ?? "Assessment not found."}</div>
        <button className="btn btn--secondary" onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "var(--content-max-narrow)", margin: "0 auto" }}>

        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        {/* Staff banner */}
        {isStaff && (
          <div className="alert alert--info" style={{ marginBottom: "var(--space-4)" }}>
            <span>
              You are viewing this assessment as <strong>{role}</strong>.
              {!assessment.questions?.length
                ? " No questions added yet."
                : ` ${assessment.questions.length} question${assessment.questions.length !== 1 ? "s" : ""} · ${assessment.total_marks} marks total.`}
            </span>
          </div>
        )}

        {/* Assessment info card */}
        <div className="card" style={{ marginBottom: "var(--space-4)" }}>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            fontWeight: 800,
            color: "var(--ink-primary)",
            letterSpacing: "-0.02em",
            marginBottom: "var(--space-2)",
          }}>
            {assessment.title}
          </h1>
          {assessment.description && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginBottom: "var(--space-4)" }}>
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
              { label: "Questions",   value: assessment.questions.length },
              { label: "Total Marks", value: assessment.total_marks },
              { label: "Pass Marks",  value: assessment.pass_marks },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  color: "var(--ink-primary)",
                }}>
                  {value}
                </div>
                <div style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--ink-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best score badge — students only */}
        {!isStaff && bestAttempt && (
          <div
            className={`alert ${hasPassedBefore ? "alert--success" : "alert--warning"}`}
            style={{ marginBottom: "var(--space-4)" }}
          >
            {hasPassedBefore
              ? `✓ You passed this assessment. Best score: ${bestAttempt.score}/${assessment.total_marks}`
              : `Your best score so far: ${bestAttempt.score}/${assessment.total_marks} — keep trying!`}
          </div>
        )}

        {/* Instructions — students only */}
        {!isStaff && (
          <div className="card" style={{ marginBottom: "var(--space-6)" }}>
            <h2 style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-base)",
              fontWeight: 700,
              color: "var(--ink-primary)",
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
                "You can attempt this assessment multiple times. Only your best score counts.",
                "Do not refresh or close the page during the assessment — your progress may be lost.",
              ].map((rule, i) => (
                <div key={i} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: "var(--saffron-glow)", color: "var(--saffron)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "var(--text-xs)", fontWeight: 700, flexShrink: 0,
                    fontFamily: "var(--font-display)",
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-secondary)", lineHeight: 1.6 }}>
                    {rule}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Start button — students only */}
        {!isStaff && (
          <button
            className="btn btn--primary btn--lg"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => navigate(takePath)}
          >
            {attempts.length === 0 ? "Start Assessment" : "Attempt Again"}
          </button>
        )}

        {/* Staff back button */}
        {isStaff && (
          <button
            className="btn btn--secondary btn--lg"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => navigate(-1)}
          >
            ← Back to Assessment Builder
          </button>
        )}

        {/* Attempt history — students only */}
        {!isStaff && attempts.length > 0 && (
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
                color: "var(--ink-primary)",
              }}>
                Your Attempts
              </h3>
              <button
                className="btn btn--ghost"
                style={{ fontSize: "var(--text-xs)" }}
                onClick={() => navigate(historyPath)}
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
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-secondary)" }}>
                        {attempt.score} / {assessment.total_marks} marks
                      </span>
                    </div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                      {timeAgo(attempt.submitted_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      
      {!isStaff && }
    </div>
  );
}
