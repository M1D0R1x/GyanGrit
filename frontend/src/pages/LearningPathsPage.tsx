import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLearningPaths,
  getLearningPathProgress,
  type LearningPath,
  type LearningPathProgress,
} from "../services/learningPaths";

export default function LearningPathsPage() {
  const navigate = useNavigate();

  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [progress, setProgress] = useState<
    Record<number, LearningPathProgress>
  >({});
  const [loadingProgress, setLoadingProgress] = useState(false);

  // --------------------------------------------------
  // Load all learning paths
  // --------------------------------------------------
  useEffect(() => {
    getLearningPaths().then(setPaths);
  }, []);

  // --------------------------------------------------
  // Load progress safely (Promise.all)
  // --------------------------------------------------
  useEffect(() => {
    if (paths.length === 0) return;

    let cancelled = false;
    setLoadingProgress(true);

    Promise.all(
      paths.map(async (path) => ({
        pathId: path.id,
        progress: await getLearningPathProgress(path.id),
      }))
    ).then((results) => {
      if (cancelled) return;

      const map: Record<number, LearningPathProgress> = {};
      results.forEach(({ pathId, progress }) => {
        map[pathId] = progress;
      });

      setProgress(map);
      setLoadingProgress(false);
    });

    return () => {
      cancelled = true;
    };
  }, [paths]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1>Learning Paths</h1>

      {paths.length === 0 && (
        <p>No learning paths available yet.</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
          marginTop: 24,
        }}
      >
        {paths.map((path) => {
          const p = progress[path.id];

          return (
            <div
              key={path.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 16,
                background: "#fff",
              }}
            >
              <h3>{path.name}</h3>
              <p style={{ opacity: 0.7 }}>
                {path.description || "No description"}
              </p>

              {loadingProgress && !p ? (
                <p>Loading progress…</p>
              ) : (
                p && (
                  <>
                    <div
                      style={{
                        height: 6,
                        background: "#eee",
                        borderRadius: 4,
                        overflow: "hidden",
                        margin: "12px 0",
                      }}
                    >
                      <div
                        style={{
                          width: `${p.percentage}%`,
                          height: "100%",
                          background: "#4caf50",
                        }}
                      />
                    </div>
                    <small>
                      {p.completed_courses}/{p.total_courses} completed
                    </small>
                  </>
                )
              )}

              <button
                style={{ marginTop: 12 }}
                onClick={() => navigate(`/learning/${path.id}`)}
              >
                View path
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
