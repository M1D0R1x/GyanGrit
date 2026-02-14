import { useLocation, useNavigate } from "react-router-dom";

export default function AssessmentResultPage() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state) return <p>No result data.</p>;

  return (
    <div style={{ maxWidth: 500, margin: "80px auto" }}>
      <h2>Result</h2>

      <p>
        Score: <strong>{state.score}</strong>
      </p>

      <p>
        Status:{" "}
        <strong>
          {state.passed ? "PASSED" : "FAILED"}
        </strong>
      </p>

      <button
        onClick={() =>
          navigate(`/assessments/${state.assessment_id}/history`)
        }
        style={{ marginRight: 12 }}
      >
        View Attempt History
      </button>

      <button onClick={() => navigate("/")}>
        Back to Dashboard
      </button>
    </div>
  );
}
