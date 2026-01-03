import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";

type Course = {
  id: number;
  title: string;
  description: string;
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    apiGet<Course[]>("/api/courses/")
      .then(setCourses)
      .catch((err) => {
        console.error("Failed to load courses", err);
      });
  }, []);

  return (
    <div>
      <h1>Courses</h1>

      <ul>
        {courses.map((c) => (
          <li key={c.id}>
            <button onClick={() => navigate(`/courses/${c.id}`)}>
              {c.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
