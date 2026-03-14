import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLearningPaths,
  getLearningPathProgress,
  type LearningPath,
  type LearningPathProgress,
} from "../services/learningPaths";
import TopBar from "../components/TopBar";

function PathSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-line skeleton-line--title" />
      <div className="skeleton skeleton-line skeleton-line--long" style={{ marginTop: "var(--space-3)" }} />
      <div className="skeleton" style={{ height: 6, borderRadius: "var(--radius-full)", marginTop: "var(--space-5)" }} />
    </div>
  );
}

export default function LearningPathsPage() {
  const navigate = useNavigate();

  const [paths, setPaths]               = useState<LearningPath[]>([]);
  const [progress, setProgress]         = useState<Record<number, LearningPathProgress>>({});
  const [loading, setLoading]           = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(false);

  useEffect(() => {
    getLearningPaths()
      .then(setPaths)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (paths.length === 0) return;
    setLoadingProgress(true);

    Promise.all(
      paths.map(async (path) => ({
        pathId: path.id,
        progress: await getLearningPathProgress(path.id),
      }))
    )
      .then((results) => {
        const map: Record<number, LearningPathProgress> = {};
        results.forEach(({ pathId, progress: p }) => { map[pathId] = p; });
        setProgress(map);
      })
      .catch(console.error)
      .finally(() => setLoadingProgress(false));
  }, [paths]);

  return (
    <div className="page-shell">
      <TopBar title="Learning Paths" />
      <main className="page-content page-enter">

        <div className="section-header">
          <div>
            <h2 className="section-header__title">Learning Paths</h2>
            <p className="section-header__subtitle">
              Structured collections of courses for your grade
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-4)",
          }}>
            {Array.from({ length: 4 }).map((_, i) => <PathSkeleton key={i} />)}
          </div>
        ) : paths.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🗺️</div>
            <h3 className="empty-state__title">No learning paths yet</h3>
            <p className="empty-state__message">
              Learning paths will appear here once they are created for your grade.
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-4)",
          }}>
            {paths.map((path, i) => {
              const p = progress[path.id];
              return (
                <div
                  key={path.id}
                  className="card card--clickable page-enter"
                  style={{ animationDelay: `${i * 60}ms` }}
                  onClick={() => navigate(`/learning/${path.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/learning/${path.id}`)}
                >
                  <div className="card__title">{path.name}</div>
                  <p className="card__description" style={{ marginTop: "var(--space-2)" }}>
                    {path.description || "No description provided."}
                  </p>

                  {loadingProgress && !p ? (
                    <div className="skeleton" style={{ height: 6, borderRadius: "var(--radius-full)", marginTop: "var(--space-5)" }} />
                  ) : p ? (
                    <>
                      <div className="progress-bar" style={{ marginTop: "var(--space-5)" }}>
                        <div
                          className="progress-bar__fill"
                          style={{
                            width: `${p.percentage}%`,
                            background: p.percentage === 100 ? "var(--success)" : "var(--brand-primary)",
                          }}
                        />
                      </div>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: "var(--space-1)",
                        fontSize: "var(--text-xs)",
                        color: "var(--text-muted)",
                      }}>
                        <span>{p.completed_courses}/{p.total_courses} courses</span>
                        <span style={{
                          fontWeight: 700,
                          color: p.percentage === 100 ? "var(--success)" : "var(--text-secondary)",
                        }}>
                          {p.percentage}%
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}