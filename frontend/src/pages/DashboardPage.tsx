import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import { getCourseProgress } from "../services/courseProgress";

type Course = {
  id: number;
  title: string;
  description: string;
};

type CourseProgress = {
  completed: number;
  total: number;
  percentage: number;
  resume_lesson_id: number | null;
};

export default function DashboardPage() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Record<number, CourseProgress>>({});

  // Load all courses
  useEffect(() => {
    apiGet<Course[]>("/courses/").then(setCourses);
  }, []);

  // Load progress per course
  useEffect(() => {
    courses.forEach(async (course) => {
      const prog = await getCourseProgress(course.id);
      setProgress((prev) => ({ ...prev, [course.id]: prog }));
    });
  }, [courses]);

  return (
    <div>
      <h1>Student Dashboard</h1>

      <ul>
        {courses.map((course) => {
          const prog = progress[course.id];

          return (
            <li key={course.id} style={{ marginBottom: "16px" }}>
              <h3>{course.title}</h3>

              {prog ? (
                <>
                  <p>
                    Progress: {prog.percentage}% ({prog.completed}/{prog.total})
                  </p>

                  {prog.resume_lesson_id !== null ? (
                    <button
                      onClick={() =>
                        navigate(`/lessons/${prog.resume_lesson_id}`)
                      }
                    >
                      Resume
                    </button>
                  ) : prog.percentage === 100 ? (
                    <span>✅ Completed</span>
                  ) : (
                    <button
                      onClick={() =>
                        navigate(`/courses/${course.id}`)
                      }
                    >
                      Start course
                    </button>
                  )}
                </>
              ) : (
                <p>Loading progress…</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
