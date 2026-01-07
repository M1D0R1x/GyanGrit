import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import { getCourseProgress } from "../services/courseProgress";
import LogoutButton from "../components/LogoutButton";
import { useAuth } from "../auth/AuthContext";

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
  const auth = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Record<number, CourseProgress>>({});
  const [loadingProgress, setLoadingProgress] = useState(false);

  // --------------------------------------------------
  // Load all courses
  // --------------------------------------------------
  useEffect(() => {
    apiGet<Course[]>("/courses/").then(setCourses);
  }, []);

  // --------------------------------------------------
  // Load progress for all courses (safe + ordered)
  // --------------------------------------------------
  useEffect(() => {
    if (courses.length === 0) return;

    let cancelled = false;
    setLoadingProgress(true);

    Promise.all(
      courses.map(async (course) => ({
        courseId: course.id,
        progress: await getCourseProgress(course.id),
      }))
    ).then((results) => {
      if (cancelled) return;

      const map: Record<number, CourseProgress> = {};
      results.forEach(({ courseId, progress }) => {
        map[courseId] = progress;
      });

      setProgress(map);
      setLoadingProgress(false);
    });

    return () => {
      cancelled = true;
    };
  }, [courses]);

  // --------------------------------------------------
  // Auth still loading (extra safety)
  // --------------------------------------------------
  if (auth.loading) {
    return <p>Loading dashboard…</p>;
  }

  return (
    <div>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1>Student Dashboard</h1>

        <div>
          {auth.username && (
            <span style={{ marginRight: 12 }}>
              Logged in as <strong>{auth.username}</strong>
            </span>
          )}
          <LogoutButton />
        </div>
      </div>

      {/* Empty state */}
      {courses.length === 0 && (
        <p>No courses available yet.</p>
      )}

      <ul>
        {courses.map((course) => {
          const prog = progress[course.id];

          return (
            <li key={course.id} style={{ marginBottom: "16px" }}>
              <h3>{course.title}</h3>

              {loadingProgress && !prog ? (
                <p>Loading progress…</p>
              ) : prog ? (
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
