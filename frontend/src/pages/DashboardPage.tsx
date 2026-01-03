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

  // Fetch all courses once on mount
  useEffect(() => {
    apiGet<Course[]>("/api/courses/").then(setCourses);
  }, []);

  // Fetch progress for each course
  useEffect(() => {
    courses.forEach(async (course) => {
      const prog = await getCourseProgress(course.id);
      setProgress((prev) => ({ ...prev, [course.id]: prog }));
    });
  }, [courses]);

  return (
    <div>
      <header>
        <h1>Student Dashboard</h1>
      </header>

      <main>
        <section>
          <h2>Your Courses</h2>

          <ul>
            {courses.map((course) => {
              const prog = progress[course.id];

              return (
                <li key={course.id} style={{ marginBottom: "16px" }}>
                  <h3>{course.title}</h3>

                  {/* Progress text */}
                  {prog && (
                    <p>
                      {prog.completed}/{prog.total} lessons completed
                    </p>
                  )}

                  {/* Progress bar */}
                  {prog && (
                    <div
                      style={{
                        width: "100%",
                        background: "#ddd",
                        height: "8px",
                        borderRadius: "4px",
                        overflow: "hidden",
                        marginBottom: "8px",
                      }}
                    >
                      <div
                        style={{
                          width: `${prog.percentage}%`,
                          background: "#4caf50",
                          height: "100%",
                        }}
                      />
                    </div>
                  )}

                  {/* Resume or completed indicator */}
                  {prog?.resume_lesson_id ? (
                    <button
                      onClick={() =>
                        navigate(`/lessons/${prog.resume_lesson_id}`)
                      }
                    >
                      Resume learning
                    </button>
                  ) : (
                    <span>✅ Course completed</span>
                  )}

                  <div>
                    <button
                      onClick={() => navigate(`/courses/${course.id}`)}
                    >
                      View lessons
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
