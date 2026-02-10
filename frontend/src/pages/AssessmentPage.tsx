import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAssessment,
  startAssessment,
  submitAssessment,
  type AssessmentDetail,
} from "../services/assessments";

/* -----------------------------
   Types
----------------------------- */

type StartAssessmentResponse = {
  attempt_id: number;
  assessment_id: number;
  started_at: string;
};

type SubmitResponse = {
  attempt_id: number;
  score: number;
  passed: boolean;
};

export default function AssessmentPage() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] =
    useState<AssessmentDetail | null>(null);

  const [attemptId, setAttemptId] =
    useState<number | null>(null);

  const [answers, setAnswers] =
    useState<Record<number, number>>({});

  /* -----------------------------
     Load assessment + start attempt
  ----------------------------- */
  useEffect(() => {
    if (!assessmentId) return;

    async function init() {
      const assessmentData =
        await getAssessment(Number(assessmentId));

      setAssessment(assessmentData);

      const attempt =
        await startAssessment(
          Number(assessmentId)
        ) as StartAssessmentResponse;

      setAttemptId(attempt.attempt_id);
    }

    init();
  }, [assessmentId]);

  /* -----------------------------
     Guards
  ----------------------------- */
  if (!assessment) {
    return <p>Loading assessment…</p>;
  }

  if (!attemptId) {
    return <p>Preparing attempt…</p>;
  }

  /* -----------------------------
     Submit
  ----------------------------- */
  async function handleSubmit() {
    const result =
      await submitAssessment(
        assessment.id,
        {
          attempt_id: attemptId,
          answers,
        }
      ) as SubmitResponse;

    navigate("/assessment-result", {
      state: result,
    });
  }

  /* -----------------------------
     Render
  ----------------------------- */
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h2>{assessment.title}</h2>
      <p>{assessment.description}</p>

      {assessment.questions.map((q) => (
        <div key={q.id} style={{ marginBottom: 20 }}>
          <strong>{q.text}</strong>

          {q.options.map((opt) => (
            <div key={opt.id}>
              <label>
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  onChange={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: opt.id,
                    }))
                  }
                />
                {opt.text}
              </label>
            </div>
          ))}
        </div>
      ))}

      <button onClick={handleSubmit}>
        Submit Assessment
      </button>
    </div>
  );
}
