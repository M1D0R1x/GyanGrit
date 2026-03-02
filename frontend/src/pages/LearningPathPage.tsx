import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";

type LearningPathDetail = {
  id: number;
  name: string;
  description: string;
  courses: {
    course_id: number;
    title: string;
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

  const [path, setPath] = useState<LearningPathDetail | null>(null);
  const [progress, setProgress] = useState<LearningPathProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pathId) return;

    const load = async () => {
      try {
        const [pathData, progressData] = await Promise.all([
          apiGet<LearningPathDetail>(`/learning/paths/${pathId}/`),
          apiGet<LearningPathProgress>(`/learning/paths/${pathId}/progress/`),
        ]);
        setPath(pathData);
        setProgress(progressData);
      } catch (err) {
        console.error("Failed to load learning path", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [pathId]);

  if (loading) return <p>Loading path...</p>;
  if (!path) return <p>Path not found.</p>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <TopBar title={path.name} />

      <p style={{ opacity: 0.7, marginBottom: 24 }}>
        {path.description || "No description available."}
      </p>

      {progress && (
        <div
          style={{
            background: "#f0f0f0",
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <strong>Progress: {progress.percentage}%</strong> —{" "}
          {progress.completed_courses}/{progress.total_courses} courses completed
        </div>
      )}

      <h3>Courses in this path</h3>
      <ul style={{ paddingLeft: 0 }}>
        {path.courses.map((c) => (
          <li
            key={c.course_id}
            style={{
              padding: 12,
              border: "1px solid #ddd",
              marginBottom: 8,
              borderRadius: 6,
            }}
          >
            <button
              onClick={() => navigate(`/courses/${c.course_id}`)}
              style={{ fontSize: "1.1rem" }}
            >
              {c.order}. {c.title}
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={() => navigate("/learning")}
        style={{ marginTop: 24 }}
      >
        ← Back to All Paths
      </button>
    </div>
  );
}