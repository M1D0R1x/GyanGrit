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

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Record<number, CourseProgress>>({});
  const navigate = useNavigate();

  // Load courses
  useEffect(() => {
    apiGet<Course[]>("/api/courses/").then(setCourses);
  }, []);

  // Load progress per course
  useEffect(() => {
    courses.forEach(async (course) => {
      const prog = await getCourseProgress(course.id);
      setProgress((p) => ({ ...p, [course.id]: prog }));
    });
  }, [courses]);

  return (
    <div>
      <h1>Student Dashboard</h1>

      <ul>
        {courses.map((course) => {
          const prog = progress[course.id];

          return (
            <li key={course.id}>
              <h3>{course.title}</h3>

              {prog && (
                <p>
                  Progress: {prog.percentage}% (
                  {prog.completed}/{prog.total})
                </p>
              )}

              {prog?.resume_lesson_id ? (
                <button
                  onClick={() =>
                    navigate(`/lessons/${prog.resume_lesson_id}`)
                  }
                >
                  Resume learning
                </button>
              ) : prog ? (
                <p>✅ Course completed</p>
              ) : (
                <p>Loading progress…</p>
              )}

              <button onClick={() => navigate(`/courses/${course.id}`)}>
                View lessons
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
