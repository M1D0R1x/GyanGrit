import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import { getCourseProgress } from "../services/courseProgress.ts";
import type { CourseProgress } from "../services/courseProgress.ts";

type Course = {
  id: number;
  title: string;
  description: string;
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Record<number, CourseProgress>>({});
  const navigate = useNavigate();

  // Load courses
  useEffect(() => {
    apiGet<Course[]>("/api/courses/").then(setCourses);
  }, []);

  // Load progress per course
  useEffect(() => {
    courses.forEach((c: Course) => {
      getCourseProgress(c.id).then((p) =>
        setProgress((prev) => ({ ...prev, [c.id]: p }))
      );
    });
  }, [courses]);

  return (
    <div>
      <h1>Courses</h1>

      <ul>
        {courses.map((c: Course) => (
          <li key={c.id}>
            <button onClick={() => navigate(`/courses/${c.id}`)}>
              {c.title}
            </button>

            {progress[c.id] && (
              <small>
                {" "}
                — {progress[c.id].percentage}% complete
              </small>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
