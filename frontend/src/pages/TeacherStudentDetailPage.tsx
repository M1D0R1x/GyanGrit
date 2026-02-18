import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getTeacherStudentAssessments,
  type TeacherStudentDetailResponse,
} from "../services/teacherAnalytics";

export default function TeacherStudentDetailPage() {
  const { classId, studentId } = useParams();

  const [data, setData] =
    useState<TeacherStudentDetailResponse | null>(null);

  useEffect(() => {
    if (!classId || !studentId) return;

    getTeacherStudentAssessments(
      Number(classId),
      Number(studentId)
    ).then(setData);
  }, [classId, studentId]);

  if (!data) {
    return <p>Loading student data...</p>;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h2>Student: {data.username}</h2>

      {data.attempts.length === 0 && (
        <p>No assessment attempts yet.</p>
      )}

      {data.attempts.map((a, index) => (
        <div
          key={index}
          style={{
            border: "1px solid #ddd",
            padding: 12,
            marginBottom: 12,
          }}
        >
          <h4>{a.assessment_title}</h4>
          <p>Score: {a.score}</p>
          <p>Status: {a.passed ? "PASSED" : "FAILED"}</p>
          <p>
            Submitted:{" "}
            {new Date(a.submitted_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
