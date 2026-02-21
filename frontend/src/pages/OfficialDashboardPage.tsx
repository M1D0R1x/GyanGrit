import { useEffect, useState } from "react";
import { apiGet } from "../services/api";

type Course = {
  id: number;
  title: string;
};

type LearningPath = {
  id: number;
  name: string;
};

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet<Course[]>("/courses/"),
      apiGet<LearningPath[]>("/learning/paths/"),
      apiGet<TeacherCourseAnalytics[]>("/teacher/analytics/courses/"),
    ])
      .then(([coursesData, pathsData, analyticsData]) => {
        setCourses(coursesData);
        setPaths(pathsData);
        setAnalytics(analyticsData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p style={{ padding: 24 }}>Loading official dashboard…</p>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <h1>Official Dashboard</h1>
      <p style={{ opacity: 0.7 }}>
        Read-only academic overview (courses, paths, teacher progress)
      </p>

      {/* High-level stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginTop: 24,
        }}
      >
        <StatBox label="Total Courses" value={courses.length} />
        <StatBox label="Learning Paths" value={paths.length} />
        <StatBox label="Courses with Activity" value={analytics.length} />
      </div>

      {/* Teacher analytics */}
      <h2 style={{ marginTop: 40 }}>Course Progress Overview</h2>

      {analytics.length === 0 && <p>No analytics data yet.</p>}

      {analytics.map((course) => (
        <div
          key={course.course_id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <strong>{course.title}</strong>
          <p style={{ margin: "6px 0" }}>
            Lessons completed: {course.completed_lessons} /{" "}
            {course.total_lessons}
          </p>

          <div
            style={{
              background: "#eee",
              borderRadius: 4,
              overflow: "hidden",
              height: 8,
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
      ))}
    </div>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
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
