import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import { type AssessmentWithStatus } from "../services/assessments";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

function ScoreRing({ score, total, size = 44 }: { score: number; total: number; size?: number }) {
  const pct    = total > 0 ? score / total : 0;
  const r      = (size - 6) / 2;
  const circ   = 2 * Math.PI * r;
  const filled = circ * pct;
  const color  = pct >= 0.6 ? "var(--success)" : pct >= 0.4 ? "var(--warning)" : "var(--error)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="score-ring">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round" />
      <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill={color}
        style={{ fontSize: size * 0.22, fontWeight: 800, fontFamily: "var(--font-display)" }}>
        {Math.round(pct * 100)}
      </text>
    </svg>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: "flex", gap: "var(--space-4)", padding: "var(--space-4)", borderBottom: "1px solid var(--border-subtle)", alignItems: "center" }}>
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-line skeleton-line--medium" />
        <div className="skeleton skeleton-line skeleton-line--short" style={{ marginTop: "var(--space-2)" }} />
      </div>
    </div>
  );
}

export default function AssessmentsPage() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<AssessmentWithStatus[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter]   = useState<"all" | "passed" | "pending">("all");

  useEffect(() => {
    apiGet<AssessmentWithStatus[]>("/assessments/my/")
      .then(setAssessments)
      .catch(() => setError("Failed to load assessments."))
      .finally(() => setLoading(false));
  }, []);

  const subjects = ["all", ...Array.from(new Set(assessments.map((a) => a.subject))).sort()];

  const filtered = assessments.filter((a) => {
    const matchSubject = subjectFilter === "all" || a.subject === subjectFilter;
    const matchStatus  = statusFilter === "all" ? true : statusFilter === "passed" ? a.passed : !a.passed;
    return matchSubject && matchStatus;
  });

  const attempted = assessments.filter((a) => (a.attempt_count ?? 0) > 0).length;
  const passed    = assessments.filter((a) => a.passed).length;

  return (
    <div className="page-shell">
      <TopBar title="Assessments" />
      <main className="page-enter has-bottom-nav" style={{ flex: 1 }}>

        {/* Header */}
        <div className="page-header">
          <h2 className="page-header__title">My Assessments</h2>
          <p className="page-header__sub">Tap any assessment to view and attempt it</p>
          {!loading && (
            <div className="stats-row">
              <div className="stats-row__item">
                <div className="stats-row__value">{assessments.length}</div>
                <div className="stats-row__label">Total</div>
              </div>
              <div className="stats-row__item">
                <div className="stats-row__value" style={{ color: "var(--brand-primary)" }}>{attempted}</div>
                <div className="stats-row__label">Attempted</div>
              </div>
              <div className="stats-row__item">
                <div className="stats-row__value" style={{ color: "var(--success)" }}>{passed}</div>
                <div className="stats-row__label">Passed</div>
              </div>
            </div>
          )}
        </div>

        {/* History shortcut */}
        <button className="history-shortcut" onClick={() => navigate("/assessments/history")}>
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l4 2" />
            </svg>
            View all attempt history
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Subject filter */}
        {!loading && subjects.length > 2 && (
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

        {/* Status tabs */}
        {!loading && (
          <div className="status-tabs">
            {(["all", "pending", "passed"] as const).map((f) => (
              <button
                key={f}
                className={`status-tab${statusFilter === f ? " status-tab--active" : ""}`}
                onClick={() => setStatusFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {error && <div className="alert alert--error" style={{ margin: "var(--space-4)" }}>{error}</div>}

        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <h3 className="empty-state__title">No assessments found</h3>
            <p className="empty-state__message">
              {statusFilter !== "all"
                ? `No ${statusFilter} assessments in this subject.`
                : "No assessments available yet."}
            </p>
          </div>
        ) : (
          filtered.map((a, i) => {
            const isAttempted = (a.attempt_count ?? 0) > 0;
            return (
              <button
                key={a.id}
                className="assessment-row page-enter"
                style={{ animationDelay: `${i * 25}ms` }}
                onClick={() => navigate(`/assessments/${a.id}`)}
              >
                <div className={`assessment-row__icon${isAttempted && a.best_score !== null ? " assessment-row__icon--scored" : ""}`}>
                  {isAttempted && a.best_score !== null
                    ? <ScoreRing score={a.best_score} total={a.total_marks} />
                    : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    )
                  }
                </div>

                <div className="assessment-row__body">
                  <div className="assessment-row__subject">
                    {a.subject} · Class {a.grade}
                  </div>
                  <div className="assessment-row__title">{a.title}</div>
                  <div className="assessment-row__meta">
                    <span>{a.total_marks} marks · pass {a.pass_marks}</span>
                    {isAttempted && (
                      <span style={{ color: a.passed ? "var(--success)" : "var(--warning)" }}>
                        {a.passed ? "✓ Passed" : `${a.attempt_count ?? 0} attempt${(a.attempt_count ?? 0) !== 1 ? "s" : ""}`}
                      </span>
                    )}
                  </div>
                </div>

                <svg className="assessment-row__chevron" width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            );
          })
        )}
      </main>
      <BottomNav />
    </div>
  );
}