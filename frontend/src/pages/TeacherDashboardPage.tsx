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

export default function TeacherDashboardPage() {
  const navigate = useNavigate();

  const [courses, setCourses] =
    useState<TeacherCourseAnalytics[]>([]);

  const [assessments, setAssessments] =
    useState<TeacherAssessmentAnalytics[]>([]);

  const [classes, setClasses] =
    useState<TeacherClassAnalytics[]>([]);

  useEffect(() => {
    getTeacherCourseAnalytics().then(setCourses);
    getTeacherAssessmentAnalytics().then(setAssessments);
    getTeacherClassAnalytics().then(setClasses);
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1>Teacher Dashboard</h1>

      {/* COURSE ANALYTICS */}
      <h2>Course Completion</h2>
      {courses.map((course) => (
        <div key={course.course_id} style={{ marginBottom: 16 }}>
          <h4>{course.title}</h4>
          <p>
            {course.completed_lessons} / {course.total_lessons}
          </p>
          <small>{course.percentage}% completion</small>
        </div>
      ))}

      {/* ASSESSMENT ANALYTICS */}
      <h2 style={{ marginTop: 40 }}>
        Assessment Performance
      </h2>
      {assessments.map((a) => (
        <div
          key={a.assessment_id}
          style={{
            border: "1px solid #ddd",
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h4>{a.title}</h4>
          <p>Total Attempts: {a.total_attempts}</p>
          <p>Unique Students: {a.unique_students}</p>
          <p>Average Score: {a.average_score}</p>
          <p>Pass Rate: {a.pass_rate}%</p>
        </div>
      ))}

      {/* CLASS ANALYTICS */}
      <h2 style={{ marginTop: 40 }}>
        Class Performance
      </h2>
      {classes.map((c) => (
        <div
          key={c.class_id}
          style={{
            border: "1px solid #ddd",
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h4
            style={{
              cursor: "pointer",
              color: "#1976d2",
              textDecoration: "underline",
            }}
            onClick={() =>
              navigate(`/teacher/classes/${c.class_id}`)
            }
          >
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
  );
}
