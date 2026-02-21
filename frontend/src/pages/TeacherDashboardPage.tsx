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
import TopBar from "../components/TopBar";  // ← added this

export default function TeacherDashboardPage() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<TeacherCourseAnalytics[]>([]);
  const [assessments, setAssessments] = useState<TeacherAssessmentAnalytics[]>([]);
  const [classes, setClasses] = useState<TeacherClassAnalytics[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [courseData, assessmentData, classData] = await Promise.all([
          getTeacherCourseAnalytics(),
          getTeacherAssessmentAnalytics(),
          getTeacherClassAnalytics(),
        ]);

        setCourses(courseData);
        setAssessments(assessmentData);
        setClasses(classData);
      } catch (err) {
        console.error("Failed to load teacher analytics:", err);
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
        <p>Loading analytics...</p>
      ) : (
        <>
          {/* COURSE ANALYTICS */}
          <h2>Course Completion</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr)", gap: 20 }}>
            {courses.map((course) => (
              <div
                key={course.course_id}
                style={{
                  border: "1px solid #ddd",
                  padding: 16,
                  borderRadius: 8,
                  background: "#f9f9f9",
                }}
              >
                <h4>{course.title}</h4>
                <p>
                  {course.completed_lessons} / {course.total_lessons}
                </p>
                <small>{course.percentage}% completion</small>
              </div>
            ))}
          </div>

          {/* ASSESSMENT ANALYTICS */}
          <h2 style={{ marginTop: 48 }}>Assessment Performance</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr)", gap: 20 }}>
            {assessments.map((a) => (
              <div
                key={a.assessment_id}
                style={{
                  border: "1px solid #ddd",
                  padding: 16,
                  borderRadius: 8,
                  background: "#f9f9f9",
                }}
              >
                <h4>{a.title}</h4>
                <p>Course: {a.course}</p>
                <p>Total Attempts: {a.total_attempts}</p>
                <p>Unique Students: {a.unique_students}</p>
                <p>Average Score: {a.average_score}</p>
                <p>Pass Rate: {a.pass_rate}%</p>
              </div>
            ))}
          </div>

          {/* CLASS ANALYTICS */}
          <h2 style={{ marginTop: 48 }}>Class Performance</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr)", gap: 20 }}>
            {classes.map((c) => (
              <div
                key={c.class_id}
                style={{
                  border: "1px solid #ddd",
                  padding: 16,
                  borderRadius: 8,
                  background: "#f9f9f9",
                  cursor: "pointer",
                }}
                onClick={() => navigate(`/teacher/classes/${c.class_id}`)}
              >
                <h4 style={{ color: "#1976d2", textDecoration: "underline" }}>
                  {c.class_name}
                </h4>
                <p>Institution: {c.institution}</p>
                <p>Total Students: {c.total_students}</p>
                <p>Total Attempts: {c.total_attempts}</p>
                <p>Average Score: {c.average_score}</p>
                <p>Pass Rate: {c.pass_rate}%</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}