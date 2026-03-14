import { useEffect, useState } from "react";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";

type Course = { id: number; title: string };
type LearningPath = { id: number; name: string };
type TeacherCourseAnalytics = {
  course_id: number;
  title: string;
  total_lessons: number;
  completed_lessons: number;
  percentage: number;

};

export default function OfficialDashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [analytics, setAnalytics] = useState<TeacherCourseAnalytics[]>([]);

  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingPaths, setLoadingPaths] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [coursesRes, pathsRes, analyticsRes] = await Promise.allSettled([
          apiGet<Course[]>("/courses/"),
          apiGet<LearningPath[]>("/learning/paths/"),
          apiGet<TeacherCourseAnalytics[]>("/teacher/analytics/courses/"),
        ]);

        if (coursesRes.status === "fulfilled") setCourses(coursesRes.value || []);
        if (pathsRes.status === "fulfilled") setPaths(pathsRes.value || []);
        if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load dashboard data");
      } finally {
        setLoadingCourses(false);
        setLoadingPaths(false);
        setLoadingAnalytics(false);
      }
    };

    loadData();
  }, []);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <TopBar title="Official Dashboard" />

      {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 24 }}>
        {loadingCourses ? (
          <div style={{ height: 80, background: "#f0f0f0", borderRadius: 8 }} />
        ) : (
          <StatBox label="Total Courses" value={courses.length} />
        )}

        {loadingPaths ? (
          <div style={{ height: 80, background: "#f0f0f0", borderRadius: 8 }} />
        ) : (
          <StatBox label="Learning Paths" value={paths.length} />
        )}

        {loadingAnalytics ? (
          <div style={{ height: 80, background: "#f0f0f0", borderRadius: 8 }} />
        ) : (
          <StatBox label="Active Courses" value={analytics.length} />
        )}
      </div>

      <h2 style={{ marginTop: 40 }}>Course Progress Overview</h2>
      {loadingAnalytics ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: 140, background: "#f0f0f0", borderRadius: 8 }} />
          ))}
        </div>
      ) : (
        analytics.map((course) => (
          <div
            key={course.course_id}
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}
          >
            <strong>{course.title}</strong>
            <p>
              Lessons completed: {course.completed_lessons} / {course.total_lessons}
            </p>
            <div
              style={{
                background: "#eee",
                height: 8,
                borderRadius: 4,
                overflow: "hidden",
                margin: "8px 0",
              }}
            >
              <div
                style={{
                  width: `${course.percentage}%`,
                  background: "#4caf50",
                  height: "100%",
                }}
              />
            </div>
            <small>{course.percentage}% completion</small>
          </div>
        ))
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 16,
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: "bold" }}>{value}</div>
    </div>
  );
}