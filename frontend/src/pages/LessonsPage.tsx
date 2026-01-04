import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../services/api";
import { updateLessonProgress } from "../services/progress";
import LessonItem from "../components/LessonItem";

/**
 * Lesson shape returned by backend.
 */
type Lesson = {
  id: number;
  title: string;
  order: number;
  completed: boolean;
};

export default function LessonsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Load lessons for selected course.
   */
  useEffect(() => {
    if (!courseId) return;

    apiGet<Lesson[]>(`/courses/${courseId}/lessons/`)
      .then(setLessons)
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return <p>Loading lessons…</p>;
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h2>Lessons</h2>

      <ul style={{ paddingLeft: 0 }}>
        {lessons.map((lesson) => (
          <LessonItem
            key={lesson.id}
            title={lesson.title}
            order={lesson.order}
            completed={lesson.completed}
            onSelect={() => navigate(`/lessons/${lesson.id}`)}
            onComplete={() =>
              updateLessonProgress(lesson.id, { completed: true })
            }
          />
        ))}
      </ul>

      <button onClick={() => navigate("/courses")}>
        ← Back to courses
      </button>
    </div>
  );
}
