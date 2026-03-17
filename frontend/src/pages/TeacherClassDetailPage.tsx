// pages.TeacherClassDetailPage
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getTeacherClassStudents,
  type TeacherClassStudent,
} from "../services/teacherAnalytics";
import TopBar from "../components/TopBar";

// ── Progress pill ──────────────────────────────────────────────────────────

function LessonProgress({ completed, total }: { completed: number; total: number }) {
  const pct   = total > 0 ? Math.round((completed / total) * 100) : 0;
  const color =
    pct >= 70 ? "var(--success)" :
    pct >= 30 ? "var(--warning)" :
    total > 0 ? "var(--error)" :
    "var(--text-muted)";

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

  // FIX 2026-03-18: use TeacherClassStudent (id, username, display_name,
  // total_lessons, completed_lessons) — not the old TeacherClassStudentAnalytics
  // which assumed backend returned attempt stats that it never sent.
  const [students, setStudents] = useState<TeacherClassStudent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!classId) return;
    getTeacherClassStudents(Number(classId))
      .then(setStudents)
      .catch(() => setError("Failed to load student data."))
      .finally(() => setLoading(false));
  }, [classId]);

  const totalStudents    = students.length;
  const activeStudents   = students.filter((s) => s.completed_lessons > 0).length;
  const avgProgress      = totalStudents > 0
    ? Math.round(
        students.reduce((sum, s) =>
          sum + (s.total_lessons > 0 ? s.completed_lessons / s.total_lessons * 100 : 0), 0
        ) / totalStudents
      )
    : 0;

  return (
    <div className="page-shell">
      <TopBar title="Class Detail" />
      <main className="page-content page-enter">

        <button className="back-btn" onClick={() => navigate("/teacher")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Dashboard
        </button>

        {/* Summary strip */}
        {!loading && !error && totalStudents > 0 && (
          <div style={{
            display:             "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap:                 "var(--space-3)",
            marginBottom:        "var(--space-6)",
          }}>
            {[
              { label: "Students",   value: totalStudents,  color: "var(--text-primary)" },
              { label: "Active",     value: activeStudents, color: "var(--brand-primary)" },
              { label: "Avg Progress", value: `${avgProgress}%`, color: avgProgress >= 70 ? "var(--success)" : "var(--warning)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ textAlign: "center", padding: "var(--space-4)" }}>
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontSize:   "var(--text-2xl)",
                  fontWeight: 800,
                  color,
                  lineHeight: 1,
                }}>
                  {value}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                  {label}
                </div>
              </div>
            ))}
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr
                    key={s.id}
                    className="page-enter"
                    style={{ cursor: "pointer", animationDelay: `${i * 30}ms` }}
                    onClick={() => navigate(`/teacher/classes/${classId}/students/${s.id}`)}
                  >
                    {/* Avatar + name */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <div style={{
                          width:          28,
                          height:         28,
                          borderRadius:   "50%",
                          background:     "var(--bg-elevated)",
                          border:         "1px solid var(--border-subtle)",
                          display:        "flex",
                          alignItems:     "center",
                          justifyContent: "center",
                          fontSize:       "var(--text-xs)",
                          fontWeight:     700,
                          fontFamily:     "var(--font-display)",
                          color:          "var(--text-secondary)",
                          flexShrink:     0,
                        }}>
                          {(s.display_name || s.username).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                            {s.display_name || s.username}
                          </div>
                          {s.display_name && s.display_name !== s.username && (
                            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                              @{s.username}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Lesson count */}
                    <td style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                      {s.completed_lessons}
                      {s.total_lessons > 0 && (
                        <span style={{ color: "var(--text-muted)" }}> / {s.total_lessons}</span>
                      )}
                    </td>

                    {/* Progress bar */}
                    <td>
                      <LessonProgress completed={s.completed_lessons} total={s.total_lessons} />
                    </td>

                    {/* CTA */}
                    <td>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--brand-primary)" }}>
                        View history →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
