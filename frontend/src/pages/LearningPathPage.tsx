// pages.LearningPathPage
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getLearningPath,
  getLearningPathProgress,
  type LearningPathDetail,
  type LearningPathProgress,
} from "../services/learningPaths";

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
    <>

        <button className="back-btn" onClick={() => navigate("/learning")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All Learning Paths
        </button>

        {error && (
          <div className="alert alert--error">{error}</div>
        )}

        {loading ? (
          <div>
            <div className="skeleton skeleton-line" style={{ height: 32, width: "60%", marginBottom: "var(--space-4)" }} />
            <div className="skeleton skeleton-line skeleton-line--full" style={{ marginBottom: "var(--space-6)" }} />
            <div className="skeleton" style={{ height: 72, borderRadius: "var(--radius-md)", marginBottom: "var(--space-6)" }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 60, borderRadius: "var(--radius-md)", marginBottom: "var(--space-2)" }} />
            ))}
          </div>
        ) : !path ? (
          <div className="empty-state">
            <div className="empty-state__icon">❓</div>
            <h3 className="empty-state__title">Path not found</h3>
            <p className="empty-state__message">
              This learning path may have been removed or doesn't exist.
            </p>
            <button className="btn btn--secondary" onClick={() => navigate("/learning")}>
              Back to paths
            </button>
          </div>
        ) : (
          <>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-3xl)",
              fontWeight: 800,
              color: "var(--ink-primary)",
              letterSpacing: "-0.03em",
              marginBottom: "var(--space-3)",
            }}>
              {path.name}
            </h1>

            {path.description && (
              <p style={{
                fontSize: "var(--text-base)",
                color: "var(--ink-secondary)",
                marginBottom: "var(--space-6)",
                lineHeight: 1.7,
              }}>
                {path.description}
              </p>
            )}

            {/* Progress card */}
            {progress && (
              <div className="card" style={{ marginBottom: "var(--space-6)" }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "var(--space-2)",
                }}>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-secondary)" }}>
                    {progress.completed_courses} of {progress.total_courses} courses completed
                  </span>
                  <span style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    color: progress.percentage === 100
                      ? "var(--success)"
                      : "var(--saffron)",
                  }}>
                    {progress.percentage}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-bar__fill"
                    style={{
                      width: `${progress.percentage}%`,
                      background: progress.percentage === 100
                        ? "var(--success)"
                        : "var(--saffron)",
                    }}
                  />
                </div>
                {progress.percentage === 100 && (
                  <div style={{
                    textAlign: "center",
                    marginTop: "var(--space-3)",
                    fontSize: "var(--text-sm)",
                    color: "var(--success)",
                    fontWeight: 600,
                  }}>
                    🎉 Path complete!
                  </div>
                )}
              </div>
            )}

            {/* Course list */}
            <div className="section-header">
              <h3 className="section-header__title">
                Courses in this path
              </h3>
              <span style={{
                fontSize: "var(--text-xs)",
                color: "var(--ink-muted)",
              }}>
                {path.courses.length} course{path.courses.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {path.courses.map((c, i) => (
                <div
                  key={c.course_id}
                  className="card card--clickable page-enter"
                  style={{ animationDelay: `${i * 50}ms` }}
                  onClick={() => navigate(`/courses/${c.course_id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/courses/${c.course_id}`)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                    {/* Order badge */}
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-sm)",
                      background: "var(--saffron-glow)",
                      border: "1px solid var(--saffron)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-display)",
                      fontWeight: 800,
                      fontSize: "var(--text-sm)",
                      color: "var(--saffron)",
                      flexShrink: 0,
                    }}>
                      {c.order}
                    </div>

                    {/* Course info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600,
                        color: "var(--ink-primary)",
                        fontSize: "var(--text-sm)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>
                        {c.title}
                      </div>
                      {c.subject && (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>
                        {c.subject} · Class {c.grade}
                       </div>
                        )}
                    </div>

                    {/* Arrow */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="var(--ink-muted)" strokeWidth="2" strokeLinecap="round"
                      strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
    </>
  );
}