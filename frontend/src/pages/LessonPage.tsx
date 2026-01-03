import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../services/api";
import { updateLessonProgress } from "../services/progress";

type Lesson = {
  id: number;
  title: string;
  content: string;
};

export default function LessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    apiGet<Lesson>(`/api/lessons/${lessonId}/`).then(setLesson);
  }, [lessonId]);

  if (!lesson) return <p>Loading…</p>;

  return (
    <div>
      <button onClick={() => navigate(-1)}>← Back</button>

      <h2>{lesson.title}</h2>
      <p>{lesson.content || "Lesson content coming soon."}</p>

      <button
        onClick={() =>
          updateLessonProgress(lesson.id, { completed: true })
        }
      >
        Mark as completed
      </button>
    </div>
  );
}
