import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getLearningPath,
  type LearningPathDetail,
} from "../services/learningPaths";
import {
  getEnrollments,
  enrollCourse,
  type Enrollment,
} from "../services/learningEnrollments";

export default function LearningPathPage() {
  const { pathId } = useParams();
  const navigate = useNavigate();

  const [path, setPath] = useState<LearningPathDetail | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  useEffect(() => {
    if (!pathId) return;

    getLearningPath(Number(pathId)).then(setPath);
    getEnrollments().then(setEnrollments);
  }, [pathId]);

  function isEnrolled(courseId: number) {
    return enrollments.some(
      (e) => e.course__id === courseId && e.status === "ENROLLED"
    );
  }

  async function handleEnroll(courseId: number) {
    await enrollCourse(courseId);
    const updated = await getEnrollments();
    setEnrollments(updated);
  }

  if (!path) {
    return <p style={{ padding: 24 }}>Loading learning path…</p>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <button onClick={() => navigate(-1)}>← Back</button>

      <h1 style={{ marginTop: 16 }}>{path.name}</h1>
      <p style={{ opacity: 0.7 }}>{path.description}</p>

      <ul style={{ marginTop: 24 }}>
        {path.courses.map((course) => {
          const enrolled = isEnrolled(course.course_id);

          return (
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

              {enrolled ? (
                <button
                  onClick={() =>
                    navigate(`/courses/${course.course_id}`)
                  }
                >
                  Go to course
                </button>
              ) : (
                <button onClick={() => handleEnroll(course.course_id)}>
                  Enroll
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
