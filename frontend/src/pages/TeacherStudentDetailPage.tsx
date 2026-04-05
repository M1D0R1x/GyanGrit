// pages.TeacherStudentDetailPage
// Used by TEACHER (/teacher/classes/:classId/students/:studentId)
//   and PRINCIPAL (/principal/classes/:classId/students/:studentId).
// URL prefix detected from location.pathname for correct back-navigation.
import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getTeacherStudentAssessments,
  type TeacherStudentDetailResponse,
} from "../services/teacherAnalytics";
import { getClassEngagement, type StudentEngagement } from "../services/analytics";

// ── Risk badge ──────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string; border: string }> = {
    HIGH:   { label: "High Risk",   bg: "rgba(239,68,68,0.12)",  color: "#dc2626", border: "rgba(239,68,68,0.35)" },
    MEDIUM: { label: "Medium Risk", bg: "rgba(245,158,11,0.12)", color: "#d97706", border: "rgba(245,158,11,0.35)" },
    LOW:    { label: "Low Risk",    bg: "rgba(34,197,94,0.10)",  color: "#16a34a", border: "rgba(34,197,94,0.3)" },
  };
  const key = level.toUpperCase();
  const c = cfg[key] ?? cfg.LOW;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: "var(--text-xs)", fontWeight: 700,
      padding: "3px 10px", borderRadius: 20,
      background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
      {c.label}
    </span>
  );
}

// ── Risk score gauge ─────────────────────────────────────────────────────────

function RiskGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 60 ? "#dc2626" : pct >= 30 ? "#d97706" : "#16a34a";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <div style={{
        height: 8, background: "var(--bg-elevated)",
        borderRadius: 4, overflow: "hidden", width: "100%",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: color,
          borderRadius: 4, transition: "width 0.5s ease",
        }} />
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", textAlign: "right" }}>
        Risk score: <strong style={{ color }}>{Math.round(pct)}/100</strong>
      </div>
    </div>
  );
}

// ── Risk factor pills ─────────────────────────────────────────────────────────

function FactorPill({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
      background: "rgba(239,68,68,0.08)", color: "#b91c1c",
      border: "1px solid rgba(239,68,68,0.2)",
    }}>
      {label}
    </span>
  );
}

// ── Engagement mini-stats ─────────────────────────────────────────────────────

function EngagementRow({ eng }: { eng: StudentEngagement }) {
  const stats = [
    { label: "Lessons", value: eng.lesson_min > 0 ? `${eng.lesson_min}m` : "—" },
    { label: "Live",    value: eng.live_min > 0 ? `${eng.live_min}m` : "—" },
    { label: "Quiz",    value: eng.assessment_min > 0 ? `${eng.assessment_min}m` : "—" },
    { label: "AI Chat", value: eng.ai_messages > 0 ? `${eng.ai_messages} msg` : "—" },
    { label: "Total",   value: eng.total_min > 0 ? `${eng.total_min}m` : "—", bold: true },
  ];
  const totalColor = eng.total_min >= 30 ? "var(--success)" : eng.total_min >= 10 ? "var(--warning)" : "var(--error)";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
      gap: "var(--space-2)", marginTop: "var(--space-3)",
    }}>
      {stats.map(({ label, value, bold }) => (
        <div key={label} style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--font-display)", fontWeight: bold ? 800 : 600,
            fontSize: "var(--text-base)",
            color: bold ? totalColor : "var(--ink-secondary)",
          }}>
            {value}
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function TeacherStudentDetailPage() {
  const { classId, studentId } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();

  const prefix = location.pathname.startsWith("/principal") ? "/principal"
    : location.pathname.startsWith("/official") ? "/official"
    : "/teacher";

  const [data, setData]       = useState<TeacherStudentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Engagement & risk data for this specific student from class-summary
  const [eng, setEng]           = useState<StudentEngagement | null>(null);
  const [loadingEng, setLoadingEng] = useState(true);

  useEffect(() => {
    if (!classId || !studentId) return;

    getTeacherStudentAssessments(Number(classId), Number(studentId))
      .then(setData)
      .catch(() => setError("Failed to load student data."))
      .finally(() => setLoading(false));

    // Pull class engagement and filter to this student
    getClassEngagement(undefined, 7, Number(classId))
      .then((d) => {
        const found = (d.students || []).find((s) => s.user_id === Number(studentId));
        setEng(found ?? null);
      })
      .catch(() => {/* non-fatal */})
      .finally(() => setLoadingEng(false));
  }, [classId, studentId]);

  // Risk data comes from the engagement response
  const riskLevel = eng?.risk_level?.toUpperCase() ?? null;
  const riskScore = eng?.risk_score ?? null;

  return (
    <div style={{ maxWidth: "var(--content-max-narrow)", margin: "0 auto" }}>

        <button className="back-btn" onClick={() => navigate(`${prefix}/classes/${classId}`)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Class
        </button>

        {error && <div className="alert alert--error">{error}</div>}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton skeleton-line skeleton-line--title" />
                <div className="skeleton skeleton-line skeleton-line--medium" style={{ marginTop: "var(--space-3)" }} />
              </div>
            ))}
          </div>
        ) : !data ? null : (
          <>
            {/* Student header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-4)",
              marginBottom: "var(--space-6)",
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-medium)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-display)", fontWeight: 800,
                fontSize: "var(--text-lg)", color: "var(--ink-secondary)", flexShrink: 0,
              }}>
                {data.username.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  color: "var(--ink-primary)",
                  letterSpacing: "-0.03em",
                  marginBottom: "var(--space-1)",
                }}>
                  {data.username}
                </h1>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
                  {data.attempts.length} assessment{data.attempts.length !== 1 ? "s" : ""} completed
                </p>
              </div>
            </div>

            {/* ── Risk Profile Card ──────────────────────────────────────── */}
            {!loadingEng && (
              <div className="card" style={{
                marginBottom: "var(--space-6)",
                background: riskLevel === "HIGH"
                  ? "linear-gradient(135deg, rgba(239,68,68,0.05) 0%, var(--bg-surface) 100%)"
                  : riskLevel === "MEDIUM"
                  ? "linear-gradient(135deg, rgba(245,158,11,0.05) 0%, var(--bg-surface) 100%)"
                  : "var(--bg-surface)",
                borderColor: riskLevel === "HIGH"
                  ? "rgba(239,68,68,0.2)"
                  : riskLevel === "MEDIUM"
                  ? "rgba(245,158,11,0.2)"
                  : "var(--border-light)",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-3)",
                }}>
                  <div>
                    <div style={{
                      fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.08em", color: "var(--ink-muted)", marginBottom: "var(--space-1)",
                    }}>
                      Risk Profile · Last 7 Days
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      {riskLevel
                        ? <RiskBadge level={riskLevel} />
                        : <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontStyle: "italic" }}>No risk data yet</span>
                      }
                    </div>
                  </div>
                </div>

                {/* Score gauge */}
                {riskScore !== null && <RiskGauge score={riskScore} />}

                {/* Risk factors */}
                {eng && Object.keys(eng).length > 0 && riskLevel && riskLevel !== "LOW" && (
                  <div style={{ marginTop: "var(--space-4)" }}>
                    <div style={{
                      fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)",
                      marginBottom: "var(--space-2)",
                    }}>
                      Contributing Factors
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                      {/* Infer factors from engagement data since class-summary doesn't return factors */}
                      {eng.total_min < 10 && <FactorPill label="Low engagement this week" />}
                      {eng.lesson_min === 0 && <FactorPill label="No lessons viewed" />}
                      {eng.live_min === 0 && <FactorPill label="No live sessions attended" />}
                      {eng.assessment_min === 0 && <FactorPill label="No assessments attempted" />}
                    </div>
                  </div>
                )}

                {/* Engagement mini-stats */}
                {eng && (
                  <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border-light)" }}>
                    <div style={{
                      fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)",
                      marginBottom: "var(--space-1)",
                    }}>
                      7-Day Activity Breakdown
                    </div>
                    <EngagementRow eng={eng} />
                  </div>
                )}

                {!eng && !loadingEng && (
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontStyle: "italic", marginTop: "var(--space-2)" }}>
                    No engagement data recorded for this student in the last 7 days.
                  </p>
                )}
              </div>
            )}

            {/* ── Assessment History ─────────────────────────────────────── */}
            <div className="section-header">
              <h2 className="section-header__title">Assessment History</h2>
            </div>

            {data.attempts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">📋</div>
                <h3 className="empty-state__title">No attempts yet</h3>
                <p className="empty-state__message">
                  This student has not completed any assessments.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {data.attempts.map((a, i) => (
                  <div
                    key={i}
                    className="card page-enter"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div className="card__title" style={{ marginBottom: "var(--space-2)" }}>
                          {a.assessment_title}
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                          {new Date(a.submitted_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexShrink: 0 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "var(--text-xl)",
                            fontWeight: 800,
                            color: a.passed ? "var(--success)" : "var(--error)",
                          }}>
                            {a.score}
                          </div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>pts</div>
                        </div>
                        <span className={`badge ${a.passed ? "badge--success" : "badge--error"}`}>
                          {a.passed ? "PASS" : "FAIL"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
    </div>
  );
}
