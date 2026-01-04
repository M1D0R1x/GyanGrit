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
  const [data, setData] = useState<CourseAnalytics[]>([]);

  useEffect(() => {
    apiGet<CourseAnalytics[]>("/teacher/analytics/courses/")
      .then(setData);
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1>Teacher Dashboard</h1>

      {data.map((course) => (
        <div
          key={course.course_id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h3>{course.title}</h3>

          <p>
            Lessons completed: {course.completed_lessons} /{" "}
            {course.total_lessons}
          </p>

          {/* Visual completion indicator */}
          <div
            style={{
              background: "#eee",
              borderRadius: 4,
              overflow: "hidden",
              height: 8,
              marginTop: 8,
            }}
          >
            <div
              style={{
                width: `${course.percentage}%`,
                background: "#1976d2",
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
