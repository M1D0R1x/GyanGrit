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
import TopBar from "../components/TopBar";

export default function TeacherStudentDetailPage() {
  const { classId, studentId } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();

  // Detect role prefix so back-link stays within the correct URL namespace
  const prefix = location.pathname.startsWith("/principal") ? "/principal"
    : location.pathname.startsWith("/official") ? "/official"
    : "/teacher";

  const [data, setData]       = useState<TeacherStudentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!classId || !studentId) return;
    getTeacherStudentAssessments(Number(classId), Number(studentId))
      .then(setData)
      .catch(() => setError("Failed to load student data."))
      .finally(() => setLoading(false));
  }, [classId, studentId]);

  return (
    <div className="page-shell">
      <TopBar title={data ? data.username : "Student Detail"} />
      <main className="page-content page-content--narrow page-enter">

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
              marginBottom: "var(--space-8)",
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-display)", fontWeight: 800,
                fontSize: "var(--text-lg)", color: "var(--text-secondary)", flexShrink: 0,
              }}>
                {data.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.03em",
                }}>
                  {data.username}
                </h1>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                  {data.attempts.length} assessment{data.attempts.length !== 1 ? "s" : ""} completed
                </p>
              </div>
            </div>

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
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
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
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>pts</div>
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
      </main>
    </div>
  );
}
