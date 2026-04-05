// pages.TeacherClassDetailPage
// Used by both TEACHER (/teacher/classes/:classId) and PRINCIPAL (/principal/classes/:classId).
// URL prefix is detected from location.pathname to generate correct back/gradebook/student links.
import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getTeacherClassStudents,
  type TeacherClassStudent,
} from "../services/teacherAnalytics";
import {
  getClassEngagement,
  type StudentEngagement,
} from "../services/analytics";

// ── Progress pill ──────────────────────────────────────────────────────────

function LessonProgress({ completed, total }: { completed: number; total: number }) {
  const pct   = total > 0 ? Math.round((completed / total) * 100) : 0;
  const color =
    pct >= 70 ? "var(--success)" :
    pct >= 30 ? "var(--warning)" :
    total > 0 ? "var(--error)" :
    "var(--ink-muted)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color, minWidth: 36, textAlign: "right" }}>
        {total > 0 ? `${pct}%` : "—"}
      </span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function TeacherClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate    = useNavigate();
  const location    = useLocation();

  // Detect which role's URL prefix we're under so back/child links stay consistent.
  // e.g. /principal/classes/3 → prefix = "/principal"
  // e.g. /teacher/classes/3   → prefix = "/teacher"
  const prefix = location.pathname.startsWith("/principal") ? "/principal"
    : location.pathname.startsWith("/official") ? "/official"
    : "/teacher";

  const [students, setStudents] = useState<TeacherClassStudent[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [heatmapStudents, setHeatmapStudents] = useState<StudentEngagement[]>([]);
  const [loadingHeatmap, setLoadingHeatmap] = useState(true);

  useEffect(() => {
    if (!classId) return;
    getTeacherClassStudents(Number(classId))
      .then(setStudents)
      .catch(() => setError("Failed to load student data."))
      .finally(() => setLoading(false));

    setLoadingHeatmap(true);
    getClassEngagement(undefined, 7, Number(classId))
      .then((data) => {
        const riskVal = { high: 3, medium: 2, low: 1 };
        const sorted = (data.students || []).sort((a, b) => {
          const rA = riskVal[a.risk_level as keyof typeof riskVal] ?? 0;
          const rB = riskVal[b.risk_level as keyof typeof riskVal] ?? 0;
          if (rA !== rB) return rB - rA;
          return b.total_min - a.total_min;
        });
        setHeatmapStudents(sorted);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingHeatmap(false));
  }, [classId]);

  const totalStudents  = students.length;
  const activeStudents = students.filter((s) => s.completed_lessons > 0).length;
  const avgProgress    = totalStudents > 0
    ? Math.round(
        students.reduce((sum, s) =>
          sum + (s.total_lessons > 0 ? s.completed_lessons / s.total_lessons * 100 : 0), 0
        ) / totalStudents
      )
    : 0;

  return (
    <>

        {/* Nav row — back + gradebook shortcut */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: "var(--space-6)", flexWrap: "wrap", gap: "var(--space-3)",
        }}>
          <button className="back-btn" style={{ marginBottom: 0 }} onClick={() => navigate(prefix)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Dashboard
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => navigate(`${prefix}/classes/${classId}/gradebook`)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Gradebook
          </button>
        </div>

        {/* Summary strip */}
        {!loading && !error && totalStudents > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "var(--space-3)",
            marginBottom: "var(--space-6)",
          }}>
            {[
              { label: "Students",   value: totalStudents,  color: "var(--ink-primary)" },
              { label: "Active",     value: activeStudents, color: "var(--success)" },
              { label: "Avg Progress", value: `${avgProgress}%`,
                color: avgProgress >= 70 ? "var(--success)" : avgProgress >= 30 ? "var(--warning)" : "var(--error)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ padding: "var(--space-4)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-2xl)", color }}>
                  {value}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Engagement Heatmap ─────────────────────────────────────── */}
        <div className="section-header">
          <div>
            <h2 className="section-header__title">Weekly Engagement stats</h2>
            <p className="section-header__subtitle">7-day activity per student — minutes spent this week</p>
          </div>
        </div>

        {loadingHeatmap ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-8)" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 40, borderRadius: "var(--radius-md)" }} />
            ))}
          </div>
        ) : heatmapStudents.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: "var(--space-8)" }}>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", fontStyle: "italic" }}>
              No engagement data for this class yet.
            </p>
          </div>
        ) : (
          <div style={{
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-light)",
            overflow: "hidden",
            marginBottom: "var(--space-8)"
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr repeat(5, 80px)",
              gap: 0,
              padding: "var(--space-3) var(--space-4)",
              borderBottom: "1px solid var(--border-light)",
              background: "var(--bg-surface)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Student</div>
              {["Lessons", "Live", "Quiz", "AI", "Total"].map((col) => (
                <div key={col} style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>{col}</div>
              ))}
            </div>
            {heatmapStudents.map((s, i) => {
              const maxMin = Math.max(...heatmapStudents.map((x) => x.total_min), 1);
              const intensity = Math.min(s.total_min / maxMin, 1);
              const riskColor =
                s.risk_level === "high"   ? "#dc2626" :
                s.risk_level === "medium" ? "#d97706" : "var(--success)";
              return (
                <div
                  key={s.user_id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr repeat(5, 80px)",
                    gap: 0,
                    padding: "var(--space-3) var(--space-4)",
                    borderBottom: i < heatmapStudents.length - 1 ? "1px solid var(--border-light)" : "none",
                    background: `rgba(99,102,241,${intensity * 0.08})`,
                    transition: "background 0.2s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
                    {s.risk_level && s.risk_level !== "low" && (
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: riskColor, flexShrink: 0,
                      }} />
                    )}
                    <span style={{
                      fontSize: "var(--text-sm)", fontWeight: 500,
                      color: "var(--ink-primary)", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {s.name || s.username}
                    </span>
                  </div>
                  {[s.lesson_min, s.live_min, s.assessment_min, s.ai_messages, s.total_min].map((val, ci) => (
                    <div key={ci} style={{
                      textAlign: "center",
                      fontSize: "var(--text-sm)",
                      fontWeight: ci === 4 ? 700 : 400,
                      color: ci === 4
                        ? (s.total_min >= 30 ? "var(--success)" : s.total_min >= 10 ? "var(--warning)" : "var(--error)")
                        : "var(--ink-secondary)",
                    }}>
                      {ci === 3 ? (val > 0 ? val : "—") : val > 0 ? `${val}m` : "—"}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div className="section-header">
          <div>
            <h2 className="section-header__title">Student Breakdown</h2>
            <p className="section-header__subtitle">
              Click a student to view their assessment history
            </p>
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        {loading ? (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52, margin: "var(--space-2)", borderRadius: "var(--radius-sm)" }} />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">👥</div>
            <h3 className="empty-state__title">No students yet</h3>
            <p className="empty-state__message">
              Students will appear here once they are enrolled in this class.
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Lessons</th>
                  <th style={{ minWidth: 160 }}>Progress</th>
                  <th>Risk Indicator</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr
                    key={s.id}
                    className="page-enter"
                    style={{ cursor: "pointer", animationDelay: `${i * 30}ms` }}
                    onClick={() => navigate(`${prefix}/classes/${classId}/students/${s.id}`)}
                  >
                    {/* Avatar + name */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border-light)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "var(--text-xs)", fontWeight: 700,
                          fontFamily: "var(--font-display)",
                          color: "var(--ink-secondary)", flexShrink: 0,
                        }}>
                          {(s.display_name || s.username).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--ink-primary)", fontSize: "var(--text-sm)" }}>
                            {s.display_name || s.username}
                          </div>
                          {s.display_name && s.display_name !== s.username && (
                            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                              @{s.username}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ color: "var(--ink-secondary)", fontSize: "var(--text-sm)" }}>
                      {s.completed_lessons}
                      {s.total_lessons > 0 && (
                        <span style={{ color: "var(--ink-muted)" }}> / {s.total_lessons}</span>
                      )}
                    </td>

                    <td>
                      <LessonProgress completed={s.completed_lessons} total={s.total_lessons} />
                    </td>

                    <td>
                      {s.risk_level && (
                        <div style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                          background: s.risk_level === "HIGH" ? "rgba(255, 59, 48, 0.15)" : 
                                      s.risk_level === "MEDIUM" ? "rgba(255, 149, 0, 0.15)" : 
                                      "rgba(52, 199, 89, 0.15)",
                          color: s.risk_level === "HIGH" ? "#ff3b30" : 
                                 s.risk_level === "MEDIUM" ? "#ff9500" : 
                                 "#34c759",
                          border: `1px solid ${
                            s.risk_level === "HIGH" ? "rgba(255, 59, 48, 0.3)" : 
                            s.risk_level === "MEDIUM" ? "rgba(255, 149, 0, 0.3)" : 
                            "rgba(52, 199, 89, 0.3)"
                          }`
                        }}>
                          {s.risk_level.charAt(0).toUpperCase() + s.risk_level.slice(1).toLowerCase()}
                        </div>
                      )}
                      {!s.risk_level && (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                          Unknown
                        </div>
                      )}
                    </td>

                    <td>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--saffron)" }}>
                        View history →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}
