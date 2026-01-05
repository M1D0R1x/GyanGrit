import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getLearningPath,
    type LearningPathDetail,
} from "../services/learningPaths";

export default function LearningPathPage() {
  const { pathId } = useParams();
  const navigate = useNavigate();

  const [path, setPath] = useState<LearningPathDetail | null>(null);

  useEffect(() => {
    if (!pathId) return;
    getLearningPath(Number(pathId)).then(setPath);
  }, [pathId]);

  if (!path) {
    return <p style={{ padding: 24 }}>Loading learning path…</p>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <button onClick={() => navigate(-1)}>← Back</button>

      <h1 style={{ marginTop: 16 }}>{path.name}</h1>
      <p style={{ opacity: 0.7 }}>{path.description}</p>

      <ul style={{ marginTop: 24 }}>
        {path.courses.map(
          (course: LearningPathDetail["courses"][number]) => (
            <li
              key={course.course_id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <span>
                {course.order}. {course.title}
              </span>

              <button
                onClick={() =>
                  navigate(`/courses/${course.course_id}`)
                }
              >
                Go to course
              </button>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
