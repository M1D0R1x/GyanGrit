import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllMyAttempts, type AttemptWithContext } from "../services/assessments";
import TopBar from "../components/TopBar";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ScorePill({ score, total, passed }: { score: number; total: number; passed: boolean }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 52,
      padding: "var(--space-2)",
      borderRadius: "var(--radius-md)",
      background: passed ? "rgba(63,185,80,0.10)" : "rgba(239,68,68,0.08)",
      border: `1.5px solid ${passed ? "rgba(63,185,80,0.25)" : "rgba(239,68,68,0.2)"}`,
    }}>
      <span style={{
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-lg)",
        fontWeight: 800,
        color: passed ? "var(--success)" : "var(--error)",
        lineHeight: 1,
      }}>
        {score}
      </span>
      <span style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
        / {total}
      </span>
    </div>
  );
}

export default function AssessmentHistoryPage() {
  const navigate = useNavigate();

  const [attempts, setAttempts]         = useState<AttemptWithContext[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  useEffect(() => {
    getAllMyAttempts()
      .then(setAttempts)
      .catch(() => setError("Failed to load history."))
      .finally(() => setLoading(false));
  }, []);

  const subjects = ["all", ...Array.from(new Set(attempts.map((a) => a.subject))).sort()];
  const filtered = subjectFilter === "all"
    ? attempts
    : attempts.filter((a) => a.subject === subjectFilter);

  const passedCount  = filtered.filter((a) => a.passed).length;
  const failedCount  = filtered.filter((a) => !a.passed).length;
  const avgScore = filtered.length > 0
    ? Math.round(filtered.reduce((sum, a) => sum + (a.score / a.total_marks) * 100, 0) / filtered.length)
    : 0;

  return (
    <div className="page-shell">
      <TopBar title="History" />
      <main className="page-content page-enter" style={{ padding: 0 }}>

        {/* Back + header */}
        <div style={{
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <button className="back-btn" onClick={() => navigate("/assessments")}
            style={{ marginBottom: "var(--space-3)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Assessments
          </button>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}>
            Attempt History
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
            All your submitted attempts across all subjects
          </p>
        </div>

        {/* Stats row */}
        {!loading && filtered.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "var(--space-3)",
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--border-subtle)",
          }}>
            {[
              { label: "Attempts", value: filtered.length, color: "var(--text-primary)" },
              { label: "Passed", value: passedCount, color: "var(--success)" },
              { label: "Avg Score", value: `${avgScore}%`, color: "var(--brand-primary)" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                padding: "var(--space-3)",
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius-md)",
                textAlign: "center",
              }}>
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-xl)",
                  fontWeight: 800,
                  color,
                  lineHeight: 1,
                }}>
                  {value}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Subject filter — horizontal scroll */}
        {!loading && subjects.length > 2 && (
          <div style={{
            display: "flex",
            gap: "var(--space-2)",
            padding: "var(--space-3) var(--space-5)",
            overflowX: "auto",
            borderBottom: "1px solid var(--border-subtle)",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}>
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => setSubjectFilter(s)}
                style={{
                  flexShrink: 0,
                  padding: "var(--space-1) var(--space-3)",
                  borderRadius: "var(--radius-full)",
                  border: `1.5px solid ${subjectFilter === s ? "var(--brand-primary)" : "var(--border-default)"}`,
                  background: subjectFilter === s ? "var(--brand-primary-glow)" : "transparent",
                  color: subjectFilter === s ? "var(--brand-primary)" : "var(--text-muted)",
                  fontSize: "var(--text-xs)",
                  fontWeight: subjectFilter === s ? 700 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                {s === "all" ? "All Subjects" : s}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="alert alert--error" style={{ margin: "var(--space-4)" }}>{error}</div>
        )}

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
                <div className="skeleton" style={{ width: 52, height: 52, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-line skeleton-line--medium" />
                  <div className="skeleton skeleton-line skeleton-line--short" style={{ marginTop: "var(--space-2)" }} />
                </div>
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: "var(--space-16) var(--space-6)" }}>
            <div className="empty-state__icon">📋</div>
            <h3 className="empty-state__title">No attempts yet</h3>
            <p className="empty-state__message">
              {subjectFilter === "all"
                ? "Complete an assessment to see your history here."
                : `No attempts for ${subjectFilter} yet.`}
            </p>
            <button className="btn btn--primary" onClick={() => navigate("/assessments")}>
              View Assessments
            </button>
          </div>
        ) : (
          <div>
            {filtered.map((attempt, i) => (
              <button
                key={attempt.id}
                onClick={() => navigate(`/assessments/${attempt.assessment_id}`)}
                className="page-enter"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  width: "100%",
                  padding: "var(--space-4) var(--space-5)",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  textAlign: "left",
                  animationDelay: `${i * 30}ms`,
                  transition: "background 0.1s",
                }}
                onTouchStart={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
                }}
                onTouchEnd={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "none";
                }}
              >
                <ScorePill score={attempt.score} total={attempt.total_marks} passed={attempt.passed} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    marginBottom: "var(--space-1)",
                  }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--brand-primary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}>
                      {attempt.subject}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>· Class {attempt.grade}</span>
                  </div>
                  <div style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {attempt.assessment_title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                    {formatDate(attempt.submitted_at)}
                  </div>
                </div>

                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <span className={`badge ${attempt.passed ? "badge--success" : "badge--error"}`}
                    style={{ fontSize: 10 }}>
                    {attempt.passed ? "PASS" : "FAIL"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}