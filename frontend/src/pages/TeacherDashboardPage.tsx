import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getTeacherCourseAnalytics,
  getTeacherAssessmentAnalytics,
  getTeacherClassAnalytics,
  type TeacherCourseAnalytics,
  type TeacherAssessmentAnalytics,
  type TeacherClassAnalytics,
} from "../services/teacherAnalytics";
import TopBar from "../components/TopBar";

export default function TeacherDashboardPage() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<TeacherCourseAnalytics[]>([]);
  const [assessments, setAssessments] = useState<TeacherAssessmentAnalytics[]>([]);
  const [classes, setClasses] = useState<TeacherClassAnalytics[]>([]);

  // Individual loading states
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingAssessments, setLoadingAssessments] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load all three in parallel and show data as it arrives
        const promises = [
          getTeacherCourseAnalytics().then((data) => {
            setCourses(data || []);
            setLoadingCourses(false);
          }),
          getTeacherAssessmentAnalytics().then((data) => {
            setAssessments(data || []);
            setLoadingAssessments(false);
          }),
          getTeacherClassAnalytics().then((data) => {
            setClasses(data || []);
            setLoadingClasses(false);
          }),
        ];

        await Promise.allSettled(promises);
      } catch (err) {
        console.error("Failed to load teacher dashboard:", err);
        setError("Some data failed to load");
      }
    };

    loadData();
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <TopBar title="Teacher Dashboard" />

      {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}

      {/* COURSE COMPLETION SECTION */}
      <h2>Course Completion</h2>
      {loadingCourses ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: 140, background: "#f0f0f0", borderRadius: 8 }} />
          ))}
        </div>
      ) : (
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
      )}

      {/* ASSESSMENT PERFORMANCE SECTION */}
      <h2 style={{ marginTop: 48 }}>Assessment Performance</h2>
      {loadingAssessments ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: 180, background: "#f0f0f0", borderRadius: 8 }} />
          ))}
        </div>
      ) : (
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
      )}

      {/* CLASS PERFORMANCE SECTION */}
      <h2 style={{ marginTop: 48 }}>Class Performance</h2>
      {loadingClasses ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: 200, background: "#f0f0f0", borderRadius: 8 }} />
          ))}
        </div>
      ) : (
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
                }}
              >
                <h4>{c.class_name}</h4>
                <p>Institution: {c.institution}</p>
                <p>Total Students: {c.total_students}</p>
                <p>Pass Rate: {c.pass_rate}%</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}