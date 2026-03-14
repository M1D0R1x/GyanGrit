import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMyAttempts, type AttemptHistoryItem } from "../services/assessments";
import TopBar from "../components/TopBar";

export default function AssessmentHistoryPage() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!assessmentId) return;
    getMyAttempts(Number(assessmentId))
      .then(setAttempts)
      .catch(() => setError("Failed to load attempt history."))
      .finally(() => setLoading(false));
  }, [assessmentId]);

  return (
    <div className="page-shell">
      <TopBar title="Attempt History" />
      <main className="page-content page-content--narrow page-enter">

        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        <div className="section-header">
          <div>
            <h2 className="section-header__title">Attempt History</h2>
            <p className="section-header__subtitle">
              Your past attempts for this assessment
            </p>
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton skeleton-line skeleton-line--short" />
                <div className="skeleton skeleton-line skeleton-line--medium" style={{ marginTop: "var(--space-3)" }} />
              </div>
            ))}
          </div>
        ) : attempts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <h3 className="empty-state__title">No attempts yet</h3>
            <p className="empty-state__message">
              Complete the assessment to see your history here.
            </p>
            <button className="btn btn--primary" onClick={() => navigate(-1)}>
              Take Assessment
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {attempts.map((a, i) => (
              <div
                key={a.id}
                className="card page-enter"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--text-xl)",
                      fontWeight: 800,
                      color: a.passed ? "var(--success)" : "var(--error)",
                      letterSpacing: "-0.02em",
                    }}>
                      {a.score} pts
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                      {new Date(a.submitted_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <span className={`badge ${a.passed ? "badge--success" : "badge--error"}`}>
                    {a.passed ? "PASSED" : "FAILED"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}