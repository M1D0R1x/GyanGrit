import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { recordingsApi } from "../services/recordings";
import type { Recording } from "../services/recordings";

export default function RecordingPlayerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      recordingsApi.getOne(sessionId).then(data => {
        setRecording(data);
      }).finally(() => setLoading(false));
    }
  }, [sessionId]);

  if (loading) return <div style={{ padding: "var(--space-6)", color: "var(--ink-muted)" }}>Loading...</div>;
  if (!recording) return <div style={{ padding: "var(--space-6)", color: "var(--error)" }}>Recording not found.</div>;

  return (
    <div className="page-container" style={{ padding: "var(--space-6)", maxWidth: "800px", margin: "0 auto" }}>
      <Link to="/recordings" style={{ color: "var(--saffron)", textDecoration: "none", marginBottom: "var(--space-4)", display: "inline-block" }}>&larr; Back to Recordings</Link>
      <header style={{ marginBottom: "var(--space-4)" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "800", color: "var(--ink-primary)", marginBottom: "var(--space-2)" }}>{recording.title}</h1>
        <p style={{ color: "var(--ink-muted)", fontSize: "14px" }}>
          {recording.subject_name || "General"} • {recording.section_name} • 👤 {recording.teacher_name} • {new Date(recording.scheduled_at).toLocaleDateString()}
        </p>
      </header>
      
      <div style={{ background: "#000", borderRadius: "var(--radius-md)", overflow: "hidden", aspectRatio: "16/9" }}>
        {recording.recording_status === "ready" && recording.recording_url ? (
          <video controls style={{ width: "100%", height: "100%" }} src={recording.recording_url}></video>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#64748b" }}>
            The recording is still processing or unavailable.
          </div>
        )}
      </div>
    </div>
  );
}
