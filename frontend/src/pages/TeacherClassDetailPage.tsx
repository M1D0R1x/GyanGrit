import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getTeacherClassStudents,
  type TeacherClassStudentAnalytics,
} from "../services/teacherAnalytics";

export default function TeacherClassDetailPage() {
  const { classId } = useParams();

  const [students, setStudents] =
    useState<TeacherClassStudentAnalytics[]>([]);

  useEffect(() => {
    if (!classId) return;
    getTeacherClassStudents(Number(classId))
      .then(setStudents);
  }, [classId]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h2>Class Student Breakdown</h2>

      {students.map((s) => (
        <div
          key={s.student_id}
          style={{
            border: "1px solid #ddd",
            padding: 12,
            marginBottom: 12,
          }}
        >
          <h4>{s.username}</h4>
          <p>Total Attempts: {s.total_attempts}</p>
          <p>Average Score: {s.average_score}</p>
          <p>Pass Rate: {s.pass_rate}%</p>
        </div>
      ))}
    </div>
  );
}
