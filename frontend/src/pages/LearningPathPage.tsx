import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";

type LearningPathDetail = {
  id: number;
  name: string;
  description: string;
  courses: {
    course_id: number;
    title: string;
    grade: number;
    subject: string;
    order: number;
  }[];
};

type LearningPathProgress = {
  path_id: number;
  total_courses: number;
  completed_courses: number;
  percentage: number;
};

export default function LearningPathPage() {
  const { pathId } = useParams();
  const navigate = useNavigate();

  const [path, setPath]         = useState<LearningPathDetail | null>(null);
  const [progress, setProgress] = useState<LearningPathProgress | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!pathId) return;

    Promise.all([
      apiGet<LearningPathDetail>(`/learning/paths/${pathId}/`),
      apiGet<LearningPathProgress>(`/learning/paths/${pathId}/progress/`),
    ])
      .then(([pathData, progressData]) => {
        setPath(pathData);
        setProgress(progressData);
      })
      .finally(() => setLoading(false));
  }, [pathId]);

  return (
    <div className="page-shell">
      <TopBar title={path?.name ?? "Learning Path"} />
      <main className="page-content page-content--narrow page-enter">

        <button className="back-btn" onClick={() => navigate("/learning")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All Learning Paths
        </button>

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
          </div>
        ) : (
          <>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-3xl)",
              fontWeight: 800,
              color: "var(--text-primary)",
              letterSpacing: "-0.03em",
              marginBottom: "var(--space-3)",
            }}>
              {path.name}
            </h1>

            {path.description && (
              <p style={{
                fontSize: "var(--text-base)",
                color: "var(--text-secondary)",
                marginBottom: "var(--space-6)",
                lineHeight: 1.7,
              }}>
                {path.description}
              </p>
            )}

            {progress && (
              <div className="card" style={{ marginBottom: "var(--space-6)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                    {progress.completed_courses} of {progress.total_courses} courses completed
                  </span>
                  <span style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    color: progress.percentage === 100 ? "var(--success)" : "var(--brand-primary)",
                  }}>
                    {progress.percentage}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-bar__fill"
                    style={{
                      width: `${progress.percentage}%`,
                      background: progress.percentage === 100 ? "var(--success)" : "var(--brand-primary)",
                    }}
                  />
                </div>
              </div>
            )}

            <div className="section-header">
              <h3 className="section-header__title">
                Courses in this path
              </h3>
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
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-sm)",
                      background: "var(--brand-primary-glow)",
                      border: "1px solid var(--brand-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-display)",
                      fontWeight: 800,
                      fontSize: "var(--text-sm)",
                      color: "var(--brand-primary)",
                      flexShrink: 0,
                    }}>
                      {c.order}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                        {c.title}
                      </div>
                      {c.subject && (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                          {c.subject} · Class {c.grade}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}