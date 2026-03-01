import { useEffect, useState } from "react";
import { apiGet } from "../services/api"; // Assuming this handles GET requests with auth
import TopBar from "../components/TopBar";

// Placeholder types for student dashboard data
type StudentCourse = {
  id: number;
  title: string;
  progress: number;
  total_lessons: number;
  completed_lessons: number;
};

type StudentAssessment = {
  id: number;
  title: string;
  course: string;
  score: number;
  attempts: number;
};

export default function DashboardPage() {
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Replace with actual student endpoints
        const courseData = await apiGet<StudentCourse[]>("/student/courses/");
        const assessmentData = await apiGet<StudentAssessment[]>("/student/assessments/");

        setCourses(courseData || []);
        setAssessments(assessmentData || []);
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
      {/* Top Bar with username + logout */}
      <TopBar title="Student Dashboard" />

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <p>Loading dashboard data...</p>
        </div>
      ) : error ? (
        <div style={{ color: "red", textAlign: "center", padding: 40 }}>
          <p>{error}</p>
        </div>
      ) : (
        <>
          {/* STUDENT COURSES */}
          <h2>Your Courses</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 48 }}>
            {courses.length === 0 ? (
              <p>No courses enrolled.</p>
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
                  <p style={{ fontWeight: "bold" }}>{course.progress}% progress</p>
                </div>
              ))
            )}
          </div>

          {/* STUDENT ASSESSMENTS */}
          <h2 style={{ marginTop: 48 }}>Your Assessments</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {assessments.length === 0 ? (
              <p>No assessments taken.</p>
            ) : (
              assessments.map((a) => (
                <div
                  key={a.id}
                  style={{
                    border: "1px solid #ddd",
                    padding: 20,
                    borderRadius: 8,
                    background: "#f9f9f9",
                  }}
                >
                  <h4>{a.title}</h4>
                  <p style={{ margin: "8px 0" }}>Course: {a.course}</p>
                  <p>Score: {a.score}</p>
                  <p>Attempts: {a.attempts}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}