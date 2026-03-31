// pages.LearningPathsPage
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLearningPaths,
  getLearningPathProgress,
  type LearningPath,
  type LearningPathProgress,
} from "../services/learningPaths";

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

  const [paths, setPaths]         = useState<LearningPath[]>([]);
  const [progress, setProgress]   = useState<Record<number, LearningPathProgress>>({});
  const [loading, setLoading]     = useState(true);

  // ESLint fix: single useEffect with async function + cancelled flag.
  // Fetches paths first, then all progress in parallel — no cascading setState.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const pathList = await getLearningPaths();
        if (cancelled) return;
        setPaths(pathList ?? []);

        if (!pathList || pathList.length === 0) return;

        const results = await Promise.allSettled(
          pathList.map((p) => getLearningPathProgress(p.id))
        );
        if (cancelled) return;

        const map: Record<number, LearningPathProgress> = {};
        results.forEach((r, idx) => {
          if (r.status === "fulfilled" && r.value) {
            map[pathList[idx].id] = r.value;
          }
        });
        setProgress(map);
      } catch (err) {
        if (!cancelled) console.error("[LearningPathsPage] load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <>

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

                  {p ? (
                    <>
                      <div className="progress-bar" style={{ marginTop: "var(--space-5)" }}>
                        <div
                          className="progress-bar__fill"
                          style={{
                            width: `${p.percentage}%`,
                            background: p.percentage === 100
                              ? "var(--success)"
                              : "var(--saffron)",
                          }}
                        />
                      </div>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: "var(--space-1)",
                        fontSize: "var(--text-xs)",
                        color: "var(--ink-muted)",
                      }}>
                        <span>{p.completed_courses}/{p.total_courses} courses</span>
                        <span style={{
                          fontWeight: 700,
                          color: p.percentage === 100
                            ? "var(--success)"
                            : "var(--ink-secondary)",
                        }}>
                          {p.percentage}%
                        </span>
                      </div>
                    </>
                  ) : (
                    /* progress not yet loaded for this path */
                    <div
                      className="skeleton"
                      style={{ height: 6, borderRadius: "var(--radius-full)", marginTop: "var(--space-5)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
    </>
  );
}