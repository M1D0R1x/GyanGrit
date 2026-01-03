import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import { getCourseProgress } from "../services/courseProgress";
import type { CourseProgress } from "../services/courseProgress";

type Course = {
  id: number;
  title: string;
  description: string;
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Record<number, CourseProgress>>({});
  const navigate = useNavigate();

  useEffect(() => {
    apiGet<Course[]>("/api/courses/").then(setCourses);
  }, []);

  useEffect(() => {
    courses.forEach((c) => {
      getCourseProgress(c.id).then((p) =>
        setProgress((prev) => ({ ...prev, [c.id]: p }))
      );
    });
  }, [courses]);

  return (
    <div>
      <h1>Courses</h1>

      <ul>
        {courses.map((c) => (
          <li key={c.id}>
            <button onClick={() => navigate(`/courses/${c.id}`)}>
              {c.title}
            </button>

            {progress[c.id] && (
              <small> — {progress[c.id].percentage}% complete</small>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
