import { useEffect, useState } from "react";
import { apiGet } from "../services/api";

type CourseAnalytics = {
  course_id: number;
  title: string;
  total_lessons: number;
  completed_lessons: number;
  percentage: number;
};

export default function TeacherDashboardPage() {
  const [analytics, setAnalytics] = useState<CourseAnalytics[]>([]);

  useEffect(() => {
    apiGet<CourseAnalytics[]>("/api/teacher/analytics/")
      .then(setAnalytics);
  }, []);

  return (
    <div>
      <header>
        <h1>Teacher Dashboard</h1>
        <p>Course completion overview</p>
      </header>

      <main>
        <ul>
          {analytics.map((c) => (
            <li key={c.course_id}>
              <h3>{c.title}</h3>
              <p>
                Lessons: {c.completed_lessons}/{c.total_lessons}
              </p>
              <p>Completion: {c.percentage}%</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
