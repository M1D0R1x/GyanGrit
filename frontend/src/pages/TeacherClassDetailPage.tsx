import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getTeacherClassStudents,
  type TeacherClassStudentAnalytics,
} from "../services/teacherAnalytics";
import TopBar from "../components/TopBar";

export default function TeacherClassDetailPage() {
  const { classId } = useParams();
  const navigate    = useNavigate();

  const [students, setStudents] = useState<TeacherClassStudentAnalytics[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!classId) return;
    getTeacherClassStudents(Number(classId))
      .then(setStudents)
      .catch(() => setError("Failed to load student data."))
      .finally(() => setLoading(false));
  }, [classId]);

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

        <div className="section-header">
          <div>
            <h2 className="section-header__title">Student Breakdown</h2>
            <p className="section-header__subtitle">
              Click a student to view their full assessment history
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
                  <th>Attempts</th>
                  <th>Avg Score</th>
                  <th>Pass Rate</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const passColor = s.pass_rate >= 70
                    ? "var(--success)"
                    : s.pass_rate >= 40
                    ? "var(--warning)"
                    : s.pass_rate > 0
                    ? "var(--error)"
                    : "var(--text-muted)";

                  return (
                    <tr
                      key={s.student_id}
                      style={{ cursor: "pointer", animationDelay: `${i * 30}ms` }}
                      className="page-enter"
                      onClick={() => navigate(`/teacher/classes/${classId}/students/${s.student_id}`)}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-subtle)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "var(--text-xs)",
                            fontWeight: 700,
                            fontFamily: "var(--font-display)",
                            color: "var(--text-secondary)",
                            flexShrink: 0,
                          }}>
                            {s.username.slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                            {s.username}
                          </span>
                        </div>
                      </td>
                      <td>{s.total_attempts}</td>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {s.average_score}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: passColor }}>
                          {s.pass_rate > 0 ? `${s.pass_rate}%` : "—"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--brand-primary)" }}>
                          View →
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}