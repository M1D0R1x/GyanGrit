import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../services/api";
import { updateLessonProgress } from "../services/progress";
import LessonItem from "../components/LessonItem";

/**
 * Lesson shape returned by backend.
 * `completed` comes from LessonProgress aggregation.
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

  // Fetch lessons for the selected course
  useEffect(() => {
    if (!courseId) return;

    apiGet<Lesson[]>(`/api/courses/${courseId}/lessons/`)
      .then(setLessons);
  }, [courseId]);

  return (
    <div>
      <header>
        <h2>Lessons</h2>
      </header>

      <main>
        <ul>
          {lessons.map((lesson) => (
            <LessonItem
              key={lesson.id}
              id={lesson.id}
              order={lesson.order}
              title={lesson.title}
              completed={lesson.completed}
              onSelect={() => navigate(`/lessons/${lesson.id}`)}
              onComplete={() =>
                updateLessonProgress(lesson.id, { completed: true })
              }
            />
          ))}
        </ul>
      </main>

      <footer>
        <button onClick={() => navigate("/")}>
          Back to courses
        </button>
      </footer>
    </div>
  );
}
