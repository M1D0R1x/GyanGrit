import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../services/api";
import LessonItem from "../components/LessonItem";

type Lesson = {
  id: number;
  title: string;
  order: number;
};

export default function LessonsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);

  useEffect(() => {
    apiGet<Lesson[]>(`/api/courses/${courseId}/lessons/`)
      .then(setLessons);
  }, [courseId]);

  return (
    <div>
      <h2>Lessons</h2>
      <ul>
        {lessons.map((l) => (
          <LessonItem
            key={l.id}
            id={l.id}
            title={l.title}
            order={l.order}
            onSelect={() => navigate(`/lessons/${l.id}`)}
          />
        ))}
      </ul>

      <button onClick={() => navigate("/")}>Back to courses</button>
    </div>
  );
}
