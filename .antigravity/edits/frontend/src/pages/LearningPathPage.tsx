// pages.LearningPathPage
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getLearningPath,
  getLearningPathProgress,
  type LearningPathDetail,
  type LearningPathProgress,
} from "../services/learningPaths";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

export default function LearningPathPage() {
  const { pathId } = useParams();
  const navigate   = useNavigate();

  const [path, setPath]         = useState<LearningPathDetail | null>(null);
  const [progress, setProgress] = useState<LearningPathProgress | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!pathId) return;
    let cancelled = false;

    async function load() {
      try {
        const [pathData, progressData] = await Promise.all([
          getLearningPath(Number(pathId)),
          getLearningPathProgress(Number(pathId)),
        ]);
        if (cancelled) return;
        setPath(pathData);
        setProgress(progressData);
      } catch {
        if (!cancelled) setError("Failed to load learning path.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [pathId]);

  return (
    <div className="page-shell">
      <TopBar title={path?.name ?? "Learning Path"} />
      <main className="page-content page-content--narrow page-enter has-bottom-nav">

        <button
          className="btn--ghost"
          style={{ marginBottom: "var(--space-6)", display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "12px", fontWeight: 800, letterSpacing: "0.05em" }}
          onClick={() => navigate("/learning")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          ALL LEARNING PATHS
        </button>

        {error && (
          <div className="alert alert--error animate-fade-up">{error}</div>
        )}

        {loading ? (
          <div>
            <div className="skeleton-box" style={{ height: 32, width: "60%", marginBottom: "var(--space-4)", borderRadius: 6 }} />
            <div className="skeleton-box" style={{ height: 14, width: "100%", marginBottom: "var(--space-6)", borderRadius: 4 }} />
            <div className="skeleton-box" style={{ height: 72, borderRadius: "var(--radius-lg)", marginBottom: "var(--space-6)" }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-box" style={{ height: 60, borderRadius: "var(--radius-md)", marginBottom: "var(--space-2)" }} />
            ))}
          </div>
        ) : !path ? (
          <div className="glass-card empty-well animate-fade-up">
            <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>❓</span>
            <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>PATH NOT FOUND</p>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>This learning path may have been removed or doesn't exist.</span>
            <button className="btn--secondary" style={{ marginTop: "var(--space-4)" }} onClick={() => navigate("/learning")}>
              Back to paths
            </button>
          </div>
        ) : (
          <>
            {/* Path header */}
            <div className="animate-fade-up" style={{ marginBottom: "var(--space-6)" }}>
              <div className="role-tag role-tag--teacher" style={{ marginBottom: "var(--space-3)" }}>
                🗺️ LEARNING PATH
              </div>
              <h1 style={{
                fontFamily:    "var(--font-display)",
                fontSize:      "var(--text-3xl)",
                fontWeight:    800,
                color:         "var(--text-primary)",
                letterSpacing: "-0.03em",
                marginBottom:  "var(--space-3)",
              }}>
                {path.name}
              </h1>
              {path.description && (
                <p style={{
                  fontSize:   "var(--text-base)",
                  color:      "var(--text-secondary)",
                  lineHeight: 1.7,
                }}>
                  {path.description}
                </p>
              )}
            </div>

            {/* Progress card */}
            {progress && (
              <div className="glass-card animate-fade-up" style={{ marginBottom: "var(--space-6)", padding: "var(--space-5)" }}>
                <div style={{
                  display:       "flex",
                  justifyContent: "space-between",
                  marginBottom:  "var(--space-2)",
                }}>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                    {progress.completed_courses} of {progress.total_courses} courses completed
                  </span>
                  <span style={{
                    fontFamily:    "var(--font-display)",
                    fontWeight:    800,
                    letterSpacing: "-0.02em",
                    color: progress.percentage === 100
                      ? "var(--role-student)"
                      : "var(--role-teacher)",
                  }}>
                    {progress.percentage}%
                  </span>
                </div>
                {/* Progress track */}
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height:     "100%",
                    width:      `${progress.percentage}%`,
                    background: progress.percentage === 100
                      ? "var(--role-student)"
                      : "linear-gradient(90deg, var(--role-teacher), var(--role-student))",
                    borderRadius: 99,
                    transition:   "width 0.6s ease",
                  }} />
                </div>
                {progress.percentage === 100 && (
                  <div style={{
                    textAlign:  "center",
                    marginTop:  "var(--space-3)",
                    fontSize:   "var(--text-sm)",
                    color:      "var(--role-student)",
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                  }}>
                    🎉 PATH COMPLETE!
                  </div>
                )}
              </div>
            )}

            {/* Course list */}
            <div className="section-header animate-fade-up" style={{ marginBottom: "var(--space-4)" }}>
              <h3 className="section-title">Courses in this path</h3>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 600 }}>
                {path.courses.length} course{path.courses.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {path.courses.map((c, i) => (
                <div
                  key={c.course_id}
                  className="glass-card animate-fade-up"
                  style={{ animationDelay: `${i * 50}ms`, cursor: "pointer" }}
                  onClick={() => navigate(`/courses/${c.course_id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/courses/${c.course_id}`)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                    {/* Order badge */}
                    <div style={{
                      width:          36,
                      height:         36,
                      borderRadius:   "var(--radius-sm)",
                      background:     "rgba(61,214,140,0.1)",
                      border:         "1px solid rgba(61,214,140,0.3)",
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      fontFamily:     "var(--font-display)",
                      fontWeight:     800,
                      fontSize:       "var(--text-sm)",
                      color:          "var(--role-student)",
                      flexShrink:     0,
                      letterSpacing:  "-0.02em",
                    }}>
                      {c.order}
                    </div>

                    {/* Course info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight:   700,
                        color:        "var(--text-primary)",
                        fontSize:     "var(--text-sm)",
                        whiteSpace:   "nowrap",
                        overflow:     "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: "0.01em",
                      }}>
                        {c.title}
                      </div>
                      {c.subject && (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                          {c.subject} · Class {c.grade}
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
                      strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
