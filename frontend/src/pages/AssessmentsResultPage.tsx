import { useLocation, useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";

type ResultState = {
  score: number;
  passed: boolean;
  total_marks: number;
  pass_marks: number;
  assessment_id: number;
  attempt_id: number;
};

export default function AssessmentResultPage() {
  const { state } = useLocation() as { state: ResultState | null };
  const navigate = useNavigate();

  if (!state) {
    return (
      <div className="page-shell">
        <TopBar title="Result" />
        <main className="page-content">
          <div className="empty-state">
            <div className="empty-state__icon">❓</div>
            <h3 className="empty-state__title">No result data</h3>
            <p className="empty-state__message">
              This page must be reached by submitting an assessment.
            </p>
            <button
              className="btn btn--secondary"
              onClick={() => navigate("/dashboard")}
            >
              Go to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  const percentage = state.total_marks
    ? Math.round((state.score / state.total_marks) * 100)
    : 0;

  return (
    <div className="page-shell">
      <TopBar title="Result" />
      <main
        className="page-content page-enter"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "var(--space-16)",
        }}
      >
        <div className="result-card">
          <div className="result-card__icon">
            {state.passed ? "🎉" : "📖"}
          </div>

          <div
            className={`result-card__score ${
              state.passed
                ? "result-card__score--pass"
                : "result-card__score--fail"
            }`}
          >
            {percentage}%
          </div>

          <div className="result-card__label">
            {state.passed ? "Assessment Passed" : "Assessment Failed"}
          </div>

          <div
            style={{
              display: "flex",
              gap: "var(--space-8)",
              justifyContent: "center",
              marginBottom: "var(--space-8)",
              padding: "var(--space-5)",
              background: "var(--bg-elevated)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                }}
              >
                {state.score}
              </div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Your Score
              </div>
            </div>

            <div style={{ width: 1, background: "var(--border-subtle)" }} />

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                }}
              >
                {state.pass_marks}
              </div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Pass Mark
              </div>
            </div>

            <div style={{ width: 1, background: "var(--border-subtle)" }} />

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                }}
              >
                {state.total_marks}
              </div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Total Marks
              </div>
            </div>
          </div>

          <div className="result-card__actions">
            <button
              className="btn btn--secondary"
              onClick={() =>
                navigate(`/assessments/${state.assessment_id}/history`)
              }
            >
              View History
            </button>
            <button
              className="btn btn--primary"
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}