// pages.AssessmentHistoryPage
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAllMyAttempts, type AttemptWithContext } from "../services/assessments";
import { assessmentPath } from "../utils/slugs";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ScorePill({ score, total, passed }: { score: number; total: number; passed: boolean }) {
  return (
    <div className={`score-pill${passed ? " score-pill--pass" : " score-pill--fail"}`}>
      <span className={`score-pill__value${passed ? " score-pill__value--pass" : " score-pill__value--fail"}`}>
        {score}
      </span>
      <span className="score-pill__total">/ {total}</span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: "flex", gap: "var(--space-4)", padding: "var(--space-4)", borderBottom: "1px solid var(--border-light)", alignItems: "center" }}>
      <div className="skeleton" style={{ width: 52, height: 52, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-line skeleton-line--medium" />
        <div className="skeleton skeleton-line skeleton-line--short" style={{ marginTop: "var(--space-2)" }} />
      </div>
    </div>
  );
}

export default function AssessmentHistoryPage() {
  const navigate = useNavigate();

  // This page is used for two routes:
  //   1. /assessments/history           — all attempts across all assessments
  //   2. /assessments/:grade/:subject/:assessmentId/history — specific assessment history
  // In case 2 the URL params are present; we filter client-side since getAllMyAttempts
  // returns everything and the list is small enough.
  const { assessmentId: assessmentIdParam } = useParams<{ assessmentId?: string }>();
  const assessmentIdFilter = assessmentIdParam ? Number(assessmentIdParam) : null;

  const [attempts, setAttempts]           = useState<AttemptWithContext[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");

  useEffect(() => {
    getAllMyAttempts()
      .then(setAttempts)
      .catch(() => setError("Failed to load history."))
      .finally(() => setLoading(false));
  }, []);

  // If we're on a per-assessment history route, pre-filter
  const base = assessmentIdFilter
    ? attempts.filter((a) => a.assessment_id === assessmentIdFilter)
    : attempts;

  const subjects = ["all", ...Array.from(new Set(base.map((a) => a.subject))).sort()];
  const filtered = subjectFilter === "all" ? base : base.filter((a) => a.subject === subjectFilter);

  const passedCount = filtered.filter((a) => a.passed).length;
  const avgScore    = filtered.length > 0
    ? Math.round(filtered.reduce((s, a) => s + (a.score / a.total_marks) * 100, 0) / filtered.length)
    : 0;

  const pageTitle = assessmentIdFilter
    ? (base[0]?.assessment_title ?? "Assessment History")
    : "History";

  return (
    

        <div className="page-header">
          <button
            className="back-btn"
            onClick={() => navigate(assessmentIdFilter ? -1 as never : "/assessments")}
            style={{ marginBottom: "var(--space-3)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {assessmentIdFilter ? "Back to Assessment" : "Back to Assessments"}
          </button>
          <h2 className="page-header__title">
            {assessmentIdFilter ? "Attempt History" : "All Attempt History"}
          </h2>
          <p className="page-header__sub">
            {assessmentIdFilter
              ? "All your attempts for this assessment"
              : "All your submitted attempts across all subjects"}
          </p>

          {!loading && filtered.length > 0 && (
            <div className="stats-row">
              <div className="stats-row__item">
                <div className="stats-row__value">{filtered.length}</div>
                <div className="stats-row__label">Attempts</div>
              </div>
              <div className="stats-row__item">
                <div className="stats-row__value" style={{ color: "var(--success)" }}>{passedCount}</div>
                <div className="stats-row__label">Passed</div>
              </div>
              <div className="stats-row__item">
                <div className="stats-row__value" style={{ color: "var(--saffron)" }}>{avgScore}%</div>
                <div className="stats-row__label">Avg Score</div>
              </div>
            </div>
          )}
        </div>

        {/* Subject filter — only show when viewing all (not per-assessment) */}
        {!loading && !assessmentIdFilter && subjects.length > 2 && (
          <div className="filter-pills">
            {subjects.map((s) => (
              <button
                key={s}
                className={`filter-pill${subjectFilter === s ? " filter-pill--active" : ""}`}
                onClick={() => setSubjectFilter(s)}
              >
                {s === "all" ? "All Subjects" : s}
              </button>
            ))}
          </div>
        )}

        {error && <div className="alert alert--error" style={{ margin: "var(--space-4)" }}>{error}</div>}

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : filtered.length === 0 ? (
          <div className="empty-state">
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
          filtered.map((attempt, i) => (
            <button
              key={attempt.id}
              className="assessment-row page-enter"
              style={{ animationDelay: `${i * 25}ms` }}
              onClick={() => navigate(assessmentPath(attempt.grade, attempt.subject, attempt.assessment_id))}
            >
              <ScorePill score={attempt.score} total={attempt.total_marks} passed={attempt.passed} />

              <div className="assessment-row__body">
                <div className="assessment-row__subject">
                  {attempt.subject} · Class {attempt.grade}
                </div>
                <div className="assessment-row__title">{attempt.assessment_title}</div>
                <div className="assessment-row__meta">
                  <span>{formatDate(attempt.submitted_at)}</span>
                </div>
              </div>

              <span
                className={`badge${attempt.passed ? " badge--success" : " badge--error"}`}
                style={{ fontSize: 10, flexShrink: 0 }}
              >
                {attempt.passed ? "PASS" : "FAIL"}
              </span>
            </button>
          ))
        )}
    </>
  );
}
