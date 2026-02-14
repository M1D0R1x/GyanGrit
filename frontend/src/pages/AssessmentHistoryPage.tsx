import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getMyAttempts,
  type AttemptHistoryItem,
} from "../services/assessments";

export default function AssessmentHistoryPage() {
  const { assessmentId } = useParams();

  const [attempts, setAttempts] =
    useState<AttemptHistoryItem[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assessmentId) return;

    async function load() {
      try {
        const data =
          await getMyAttempts(Number(assessmentId));
        setAttempts(data);
      } catch (err) {
        console.error("Failed to load attempts", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [assessmentId]);

  if (loading) {
    return <p>Loading attempt history…</p>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h2>Attempt History</h2>

      {attempts.length === 0 && (
        <p>No attempts yet.</p>
      )}

      {attempts.map((a) => (
        <div
          key={a.id}
          style={{
            border: "1px solid #ddd",
            padding: 12,
            marginBottom: 12,
          }}
        >
          <p><strong>Attempt ID:</strong> {a.id}</p>
          <p><strong>Score:</strong> {a.score}</p>
          <p>
            <strong>Status:</strong>{" "}
            {a.passed ? "PASSED" : "FAILED"}
          </p>
          <p>
            <strong>Submitted:</strong>{" "}
            {new Date(a.submitted_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
