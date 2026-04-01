// pages.AssessmentsPage — Glassmorphism 2.0
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import { type AssessmentWithStatus } from "../services/assessments";
import { assessmentPath } from "../utils/slugs";

function ScoreRing({ score, total, size = 44 }: { score: number; total: number; size?: number }) {
  const pct    = total > 0 ? score / total : 0;
  const r      = (size - 6) / 2;
  const circ   = 2 * Math.PI * r;
  const filled = circ * pct;
  const color  = pct >= 0.6 ? "var(--success)" : pct >= 0.4 ? "var(--warning)" : "var(--error)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="score-ring" aria-hidden="true">
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
    <div style={{
      display: "flex", gap: "var(--space-4)", padding: "var(--space-4)",
      borderBottom: "1px solid var(--border-light)", alignItems: "center",
    }}>
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-line skeleton-line--medium" />
        <div className="skeleton skeleton-line skeleton-line--short" style={{ marginTop: "var(--space-2)" }} />
      </div>
      <div className="skeleton" style={{ width: 48, height: 20, borderRadius: "var(--radius-full)" }} />
    </div>
  );
}

export default function AssessmentsPage() {
  const navigate = useNavigate();
  const [assessments, setAssessments]     = useState<AssessmentWithStatus[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter]   = useState<"all" | "passed" | "pending">("all");

  useEffect(() => {
    apiGet<AssessmentWithStatus[]>("/assessments/my/")
      .then(setAssessments)
      .catch(() => setError("Failed to load assessments."))
      .finally(() => setLoading(false));
  }, []);

  const subjects  = ["all", ...Array.from(new Set(assessments.map((a) => a.subject))).sort()];
  const filtered  = assessments.filter((a) => {
    const matchSubj   = subjectFilter === "all" || a.subject === subjectFilter;
    const matchStatus = statusFilter === "all" ? true : statusFilter === "passed" ? a.passed : !a.passed;
    return matchSubj && matchStatus;
  });

  const attempted = assessments.filter((a) => (a.attempt_count ?? 0) > 0).length;
  const passed    = assessments.filter((a) => a.passed).length;

  return (
    <>
        {/* Header */}
        <div style={{ marginBottom: "var(--space-6)" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "var(--text-2xl)", color: "var(--ink-primary)", letterSpacing: "-0.03em", margin: 0 }}>My Assessments</h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>Tap any test to attempt it and earn points</p>
        </div>

        {/* Stats — 3 inline cards */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
            {[
              { label: "Total",     value: assessments.length,                         color: "var(--ink-primary)" },
              { label: "Attempted", value: attempted,                                   color: "var(--saffron)" },
              { label: "Passed",    value: passed,                                      color: "var(--success)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ padding: "var(--space-4)", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "var(--text-2xl)", color, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontWeight: 600, marginTop: "var(--space-1)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* History shortcut */}
        <button className="history-shortcut" style={{ marginBottom: "var(--space-4)" }} onClick={() => navigate("/assessments/history")}>
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
            </svg>
            View attempt history
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Subject filter pills */}
        {!loading && subjects.length > 2 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => setSubjectFilter(s)}
                style={{
                  padding:      "5px 14px",
                  borderRadius: "var(--radius-full)",
                  border:       `1.5px solid ${subjectFilter === s ? "var(--saffron)" : "var(--border-medium)"}`,
                  background:   subjectFilter === s ? "var(--saffron)" : "var(--bg-elevated)",
                  color:        subjectFilter === s ? "#fff" : "var(--ink-secondary)",
                  fontSize:     "var(--text-xs)",
                  fontWeight:   subjectFilter === s ? 700 : 500,
                  fontFamily:   "var(--font-body)",
                  cursor:       "pointer",
                  whiteSpace:   "nowrap",
                  transition:   "all var(--duration-press) var(--ease-out-strong)",
                  boxShadow:    subjectFilter === s ? "0 2px 8px rgba(245,158,11,0.3)" : "none",
                }}
              >
                {s === "all" ? "All Subjects" : s}
              </button>
            ))}
          </div>
        )}

        {/* Status tabs */}
        {!loading && (
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-5)" }}>
            {(["all", "pending", "passed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                style={{
                  padding:      "6px 18px",
                  borderRadius: "var(--radius-full)",
                  border:       `1.5px solid ${statusFilter === f ? "var(--border-strong)" : "var(--border-medium)"}`,
                  background:   statusFilter === f ? "var(--ink-primary)" : "transparent",
                  color:        statusFilter === f ? "#fff" : "var(--ink-muted)",
                  fontSize:     "var(--text-xs)",
                  fontWeight:   statusFilter === f ? 700 : 500,
                  fontFamily:   "var(--font-body)",
                  cursor:       "pointer",
                  textTransform: "capitalize",
                  transition:   "all var(--duration-press) var(--ease-out-strong)",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {error && <div className="alert alert--error" style={{ marginBottom: "var(--space-4)" }}>{error}</div>}

        {/* List */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">📋</div>
                <h3 className="empty-state__title">No assessments found</h3>
                <p className="empty-state__message">
                  {statusFilter !== "all" ? `No ${statusFilter} assessments matching your filters.` : "No assessments available yet."}
                </p>
              </div>
            ) : filtered.map((a, i) => {
              const isAttempted = (a.attempt_count ?? 0) > 0;
              const detailPath  = assessmentPath(a.grade, a.subject, a.id);
              return (
                <button key={a.id} className="assessment-row page-enter" style={{ animationDelay: `${i * 25}ms` }} onClick={() => navigate(detailPath)}>
                  <div className={`assessment-row__icon${isAttempted && a.best_score !== null ? " assessment-row__icon--scored" : ""}`}>
                    {isAttempted && a.best_score !== null
                      ? <ScoreRing score={a.best_score} total={a.total_marks} />
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                  </div>
                  <div className="assessment-row__body">
                    <div className="assessment-row__subject">{a.subject} · Class {a.grade}</div>
                    <div className="assessment-row__title">{a.title}</div>
                    <div className="assessment-row__meta">
                      <span>{a.total_marks} marks · pass {a.pass_marks}</span>
                      {isAttempted && <span style={{ color: a.passed ? "var(--success)" : "var(--warning)" }}>{a.passed ? "✓ Passed" : `${a.attempt_count ?? 0}×`}</span>}
                    </div>
                  </div>
                  <svg className="assessment-row__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              );
            })}
        </div>
    </>
  );
}
