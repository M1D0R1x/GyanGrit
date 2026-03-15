import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import { type AssessmentWithStatus } from "../services/assessments";
import TopBar from "../components/TopBar";

function AssessmentSkeleton() {
  return (
    <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton skeleton-line skeleton-line--medium" />
          <div className="skeleton skeleton-line skeleton-line--short" style={{ marginTop: "var(--space-2)" }} />
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score, total, size = 44 }: { score: number; total: number; size?: number }) {
  const pct    = total > 0 ? score / total : 0;
  const r      = (size - 6) / 2;
  const circ   = 2 * Math.PI * r;
  const filled = circ * pct;
  const color  = pct >= 0.6 ? "var(--success)" : pct >= 0.4 ? "var(--warning)" : "var(--error)";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--bg-elevated)" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x={size / 2} y={size / 2 + 1}
        textAnchor="middle" dominantBaseline="middle"
        fill={color}
        style={{ fontSize: size * 0.22, fontWeight: 800, fontFamily: "var(--font-display)" }}>
        {Math.round(pct * 100)}
      </text>
    </svg>
  );
}

export default function AssessmentsPage() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<AssessmentWithStatus[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
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
    const matchStatus  =
      statusFilter === "all" ? true :
      statusFilter === "passed" ? a.passed :
      !a.passed;
    return matchSubject && matchStatus;
  });

  const totalAttempted = assessments.filter((a) => (a.attempt_count ?? 0) > 0).length;
  const passedCount    = assessments.filter((a) => a.passed).length;

  return (
    <div className="page-shell">
      <TopBar title="Assessments" />
      <main className="page-content page-enter" style={{ padding: 0 }}>

        {/* Header summary */}
        <div style={{
          padding: "var(--space-5) var(--space-5) var(--space-4)",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)",
        }}>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: "var(--space-1)",
          }}>
            My Assessments
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
            Tap any assessment to view details and attempt it
          </p>

          {!loading && (
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              {[
                { label: "Total", value: assessments.length, color: "var(--text-primary)" },
                { label: "Attempted", value: totalAttempted, color: "var(--brand-primary)" },
                { label: "Passed", value: passedCount, color: "var(--success)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  flex: 1,
                  padding: "var(--space-3)",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-md)",
                  textAlign: "center",
                }}>
                  <div style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-2xl)",
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
        </div>

        {/* History shortcut */}
        <button
          onClick={() => navigate("/assessments/history")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "var(--space-3) var(--space-5)",
            background: "var(--bg-elevated)",
            border: "none",
            borderBottom: "1px solid var(--border-subtle)",
            cursor: "pointer",
            color: "var(--brand-primary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h6l3 9 4-6h5" /><path d="M21 21H3" />
            </svg>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>View all attempt history</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

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
                  textTransform: subjectFilter === s ? "none" : "none",
                }}
              >
                {s === "all" ? "All Subjects" : s}
              </button>
            ))}
          </div>
        )}

        {/* Status tabs */}
        {!loading && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            borderBottom: "1px solid var(--border-subtle)",
          }}>
            {(["all", "pending", "passed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                style={{
                  padding: "var(--space-3)",
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${statusFilter === f ? "var(--brand-primary)" : "transparent"}`,
                  color: statusFilter === f ? "var(--brand-primary)" : "var(--text-muted)",
                  fontSize: "var(--text-sm)",
                  fontWeight: statusFilter === f ? 700 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textTransform: "capitalize",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="alert alert--error" style={{ margin: "var(--space-4)" }}>{error}</div>
        )}

        {/* List */}
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <AssessmentSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: "var(--space-16) var(--space-6)" }}>
            <div className="empty-state__icon">📋</div>
            <h3 className="empty-state__title">No assessments found</h3>
            <p className="empty-state__message">
              {statusFilter !== "all"
                ? `No ${statusFilter} assessments in this subject.`
                : "No assessments available yet."}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((a, i) => {
              const attempted = (a.attempt_count ?? 0) > 0;
              return (
                <button
                  key={a.id}
                  onClick={() => navigate(`/assessments/${a.id}`)}
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
                  {/* Score ring or status icon */}
                  {attempted && a.best_score !== null ? (
                    <ScoreRing score={a.best_score} total={a.total_marks} />
                  ) : (
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-elevated)",
                      border: "1.5px dashed var(--border-default)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"
                        strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                  )}

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      marginBottom: "var(--space-1)",
                      flexWrap: "wrap",
                    }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--brand-primary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}>
                        {a.subject}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>·</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Class {a.grade}</span>
                    </div>
                    <div style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      lineHeight: 1.3,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {a.title}
                    </div>
                    <div style={{
                      display: "flex",
                      gap: "var(--space-3)",
                      marginTop: "var(--space-1)",
                      fontSize: 11,
                      color: "var(--text-muted)",
                      flexWrap: "wrap",
                    }}>
                      <span>{a.total_marks} marks · pass {a.pass_marks}</span>
                      {attempted && (
                        <span style={{ color: a.passed ? "var(--success)" : "var(--warning)" }}>
                          {a.passed ? "✓ Passed" : `${a.attempt_count} attempt${(a.attempt_count ?? 0) !== 1 ? "s" : ""}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}