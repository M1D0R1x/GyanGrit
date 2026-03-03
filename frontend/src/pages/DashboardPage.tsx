import { useEffect, useState } from "react";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";

type StudentCourse = {
  id: number;
  title: string;
  progress: number;
  total_lessons: number;
  completed_lessons: number;
};

type StudentDashboardResponse = {
  courses: StudentCourse[];
};

export default function DashboardPage() {
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await apiGet<StudentDashboardResponse>(
          "/learning/student/dashboard/"
        );
        setCourses(data?.courses || []);
      } catch (err) {
        console.error("Failed to load student dashboard:", err);
        setError("Failed to load dashboard data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <TopBar title="Student Dashboard" />

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 160,
                background: "#f0f0f0",
                borderRadius: 8,
                animation: "pulse 1.5s infinite",
              }}
            />
          ))}
        </div>
      ) : error ? (
        <div style={{ color: "red", textAlign: "center", padding: 40 }}>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <h2>Your Courses</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {courses.length === 0 ? (
              <p>No courses enrolled yet.</p>
            ) : (
              courses.map((course) => (
                <div
                  key={course.id}
                  style={{
                    border: "1px solid #ddd",
                    padding: 20,
                    borderRadius: 8,
                    background: "#f9f9f9",
                  }}
                >
                  <h4>{course.title}</h4>
                  <p style={{ margin: "8px 0" }}>
                    {course.completed_lessons} / {course.total_lessons} lessons completed
                  </p>
                  <p style={{ fontWeight: "bold" }}>
                    {course.progress}% progress
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}