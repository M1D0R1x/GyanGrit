import { useEffect, useState } from "react";
import {
  getTeacherCourseAnalytics,
  getTeacherAssessmentAnalytics,
  getTeacherClassAnalytics,
  type TeacherCourseAnalytics,
  type TeacherAssessmentAnalytics,
  type TeacherClassAnalytics,
} from "../services/teacherAnalytics";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";

export default function TeacherDashboardPage() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<TeacherCourseAnalytics[]>([]);
  const [assessments, setAssessments] = useState<TeacherAssessmentAnalytics[]>([]);
  const [classes, setClasses] = useState<TeacherClassAnalytics[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [courseData, assessmentData, classData] = await Promise.all([
          getTeacherCourseAnalytics(),
          getTeacherAssessmentAnalytics(),
          getTeacherClassAnalytics(),
        ]);

        setCourses(courseData || []);
        setAssessments(assessmentData || []);
        setClasses(classData || []);
      } catch (err) {
        console.error("Failed to load teacher analytics:", err);
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
      <TopBar title="Teacher Dashboard" />

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
          {/* COURSE COMPLETION */}
          <h2>Course Completion</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 48 }}>
            {courses.length === 0 ? (
              <p>No courses available.</p>
            ) : (
              courses.map((course) => (
                <div
                  key={course.course_id}
                  style={{
                    border: "1px solid #ddd",
                    padding: 20,
                    borderRadius: 8,
                    background: "#f9f9f9",
                  }}
                >
                  <h4>{course.title}</h4>
                  <p style={{ margin: "8px 0" }}>
                    {course.completed_lessons} / {course.total_lessons}
                  </p>
                  <p style={{ fontWeight: "bold" }}>{course.percentage}% completion</p>
                </div>
              ))
            )}
          </div>

          {/* ASSESSMENT PERFORMANCE */}
          <h2 style={{ marginTop: 48 }}>Assessment Performance</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 48 }}>
            {assessments.length === 0 ? (
              <p>No assessments data available.</p>
            ) : (
              assessments.map((a) => (
                <div
                  key={a.assessment_id}
                  style={{
                    border: "1px solid #ddd",
                    padding: 20,
                    borderRadius: 8,
                    background: "#f9f9f9",
                  }}
                >
                  <h4>{a.title}</h4>
                  <p style={{ margin: "8px 0" }}>Course: {a.course}</p>
                  <p>Total Attempts: {a.total_attempts}</p>
                  <p>Unique Students: {a.unique_students}</p>
                  <p>Average Score: {a.average_score}</p>
                  <p>Pass Rate: {a.pass_rate}%</p>
                </div>
              ))
            )}
          </div>

          {/* CLASS PERFORMANCE */}
          <h2 style={{ marginTop: 48 }}>Class Performance</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {classes.length === 0 ? (
              <p>No class data available.</p>
            ) : (
              classes.map((c) => (
                <div
                  key={c.class_id}
                  onClick={() => navigate(`/teacher/classes/${c.class_id}`)}
                  style={{
                    border: "1px solid #ddd",
                    padding: 20,
                    borderRadius: 8,
                    background: "#f9f9f9",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  <h4 style={{ color: "#1976d2", textDecoration: "underline" }}>
                    {c.class_name}
                  </h4>
                  <p style={{ margin: "8px 0" }}>Institution: {c.institution}</p>
                  <p>Total Students: {c.total_students}</p>
                  <p>Total Attempts: {c.total_attempts}</p>
                  <p>Average Score: {c.average_score}</p>
                  <p>Pass Rate: {c.pass_rate}%</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}