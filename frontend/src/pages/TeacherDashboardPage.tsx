import { useEffect, useState } from "react";
import { apiGet } from "../services/api";

type Course = {
  id: number;
  title: string;
};

export default function TeacherDashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    apiGet<Course[]>("/api/courses/").then(setCourses);
  }, []);

  return (
    <div>
      <h1>Teacher Dashboard</h1>

      <ul>
        {courses.map((c) => (
          <li key={c.id}>
            {c.title}
            {/* later: progress analytics */}
          </li>
        ))}
      </ul>
    </div>
  );
}
