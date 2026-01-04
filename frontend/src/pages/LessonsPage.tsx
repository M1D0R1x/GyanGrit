import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../services/api";
import { updateLessonProgress } from "../services/progress";
import LessonItem from "../components/LessonItem";

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

  useEffect(() => {
    if (!courseId) return;

    // ✅ RELATIVE to /api/v1
    apiGet<Lesson[]>(`/courses/${courseId}/lessons/`)
      .then(setLessons);
  }, [courseId]);

  return (
    <div>
      <h2>Lessons</h2>

      <ul>
        {lessons.map((lesson) => (
          <LessonItem
            key={lesson.id}                 // React-only, OK
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
      <button onClick={() => navigate("/")}>
        Back to courses
      </button>
    </div>
  );
}
