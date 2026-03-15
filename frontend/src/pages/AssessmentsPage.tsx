import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";

type AssessmentWithStatus = {
  id: number;
  title: string;
  description: string;
  total_marks: number;
  pass_marks: number;
  course_title: string;
  subject: string;
  grade: number;
  best_score: number | null;
  passed: boolean;
  attempt_count: number;
};

function AssessmentSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-line skeleton-line--short" />
      <div className="skeleton skeleton-line skeleton-line--title" style={{ marginTop: "var(--space-2)" }} />
      <div className="skeleton skeleton-line skeleton-line--medium" style={{ marginTop: "var(--space-3)" }} />
    </div>
  );
}

function statusBadge(a: AssessmentWithStatus) {
  if (a.attempt_count === 0) {
    return <span className="badge">Not Started</span>;
  }
  if (a.passed) {
    return <span className="badge badge--success">Passed</span>;
  }
  return <span className="badge badge--warning">Not Passed</span>;
}

export default function AssessmentsPage() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<AssessmentWithStatus[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [filter, setFilter]           = useState<"all" | "passed" | "pending">("all");

  useEffect(() => {
    apiGet<AssessmentWithStatus[]>("/assessments/my/")
      .then(setAssessments)
      .catch(() => setError("Failed to load assessments."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = assessments.filter((a) => {
    if (filter === "passed")  return a.passed;
    if (filter === "pending") return !a.passed;
    return true;
  });

  const passedCount  = assessments.filter((a) => a.passed).length;
  const pendingCount = assessments.filter((a) => !a.passed).length;

  return (
    <div className="page-shell">
      <TopBar title="Assessments" />
      <main className="page-content page-enter">

        <div className="section-header">
          <div>
            <h2 className="section-header__title">My Assessments</h2>
            <p className="section-header__subtitle">
              All assessments across your enrolled courses
            </p>
          </div>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="stat-grid" style={{ marginBottom: "var(--space-6)" }}>
            <div className="card">
              <div className="card__label">Total</div>
              <div className="card__value">{assessments.length}</div>
            </div>
            <div className="card">
              <div className="card__label">Passed</div>
              <div className="card__value" style={{ color: "var(--success)" }}>{passedCount}</div>
            </div>
            <div className="card">
              <div className="card__label">Pending</div>
              <div className="card__value" style={{ color: "var(--warning)" }}>{pendingCount}</div>
            </div>
          </div>
        )}

        {/* Filter pills */}
        {!loading && (
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
            {(["all", "passed", "pending"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "var(--space-1) var(--space-4)",
                  borderRadius: "var(--radius-full)",
                  border: "1px solid",
                  borderColor: filter === f ? "var(--brand-primary)" : "var(--border-default)",
                  background: filter === f ? "var(--brand-primary-glow)" : "transparent",
                  color: filter === f ? "var(--brand-primary)" : "var(--text-muted)",
                  fontSize: "var(--text-sm)",
                  fontWeight: filter === f ? 600 : 400,
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                  textTransform: "capitalize",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {error && <div className="alert alert--error">{error}</div>}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {Array.from({ length: 6 }).map((_, i) => <AssessmentSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <h3 className="empty-state__title">
              {filter === "all" ? "No assessments yet" : `No ${filter} assessments`}
            </h3>
            <p className="empty-state__message">
              {filter === "all"
                ? "Assessments will appear here once your teacher publishes them."
                : `You have no ${filter} assessments right now.`}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {filtered.map((a, i) => (
              <div
                key={a.id}
                className="card card--clickable page-enter"
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => navigate(`/assessments/${a.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/assessments/${a.id}`)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
                      {statusBadge(a)}
                      <span className="badge badge--info">Class {a.grade}</span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", alignSelf: "center" }}>
                        {a.subject}
                      </span>
                    </div>
                    <div className="card__title">{a.title}</div>
                    <div style={{
                      display: "flex",
                      gap: "var(--space-4)",
                      marginTop: "var(--space-3)",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-muted)",
                      flexWrap: "wrap",
                    }}>
                      <span>Total: <strong style={{ color: "var(--text-secondary)" }}>{a.total_marks}</strong> marks</span>
                      <span>Pass: <strong style={{ color: "var(--success)" }}>{a.pass_marks}</strong></span>
                      {a.best_score !== null && (
                        <span>Best: <strong style={{ color: a.passed ? "var(--success)" : "var(--warning)" }}>
                          {a.best_score}/{a.total_marks}
                        </strong></span>
                      )}
                      {a.attempt_count > 0 && (
                        <span>{a.attempt_count} attempt{a.attempt_count !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: "var(--space-4)" }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}