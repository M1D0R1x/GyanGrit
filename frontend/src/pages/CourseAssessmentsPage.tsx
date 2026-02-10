import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getCourseAssessments,
  type AssessmentListItem,
} from "../services/assessments";

export default function CourseAssessmentsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [assessments, setAssessments] =
    useState<AssessmentListItem[]>([]);

  useEffect(() => {
    if (!courseId) return;
    getCourseAssessments(Number(courseId)).then(setAssessments);
  }, [courseId]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h2>Assessments</h2>

      {assessments.length === 0 && (
        <p>No assessments available.</p>
      )}

      <ul>
        {assessments.map((a) => (
          <li
            key={a.id}
            style={{
              border: "1px solid #ddd",
              padding: 12,
              marginBottom: 12,
            }}
          >
            <h4>{a.title}</h4>
            <p>{a.description}</p>
            <p>
              Marks: {a.total_marks} | Pass: {a.pass_marks}
            </p>

            <button
              onClick={() =>
                navigate(`/assessments/${a.id}`)
              }
            >
              Start
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
