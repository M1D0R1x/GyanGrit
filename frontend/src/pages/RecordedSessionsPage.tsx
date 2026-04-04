import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { recordingsApi } from "../services/recordings";
import type { Recording } from "../services/recordings";

export default function RecordedSessionsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    recordingsApi.list().then(data => {
      setRecordings(data);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container" style={{ padding: "var(--space-6)" }}>
      <header className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <h1 className="page-title" style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-main)" }}>Recorded Sessions</h1>
        <p className="page-subtitle" style={{ color: "var(--text-muted)" }}>Watch previous live classes.</p>
      </header>

      {loading ? (
        <div style={{ color: "var(--text-muted)" }}>Loading recordings...</div>
      ) : recordings.length === 0 ? (
        <div style={{ color: "var(--text-muted)" }}>No recordings available.</div>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {recordings.map(rec => (
            <Link key={rec.id} to={`/recordings/${rec.id}`} style={{ display: "block", background: "var(--bg-card)", padding: "var(--space-4)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)", textDecoration: "none", color: "inherit" }}>
              <div style={{ width: "100%", height: "160px", background: "rgba(13, 20, 33, 0.8)", backgroundImage: "linear-gradient(45deg, rgba(255,63,109,0.1), rgba(0,213,176,0.1))", borderRadius: "var(--radius-md)", marginBottom: "var(--space-3)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                 <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.2)" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                 </div>
                 <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>{rec.recording_status === "ready" ? "READY" : "PROCESSING"}</div>
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "var(--space-2)", color: "var(--ink-primary)" }}>{rec.title}</h3>
              <p style={{ fontSize: "14px", color: "var(--ink-muted)", marginBottom: "var(--space-1)" }}>{rec.subject_name || "General"} • {rec.section_name}</p>
              <p style={{ fontSize: "14px", color: "var(--ink-muted)", marginBottom: "var(--space-1)" }}>👤 {rec.teacher_name}</p>
              <p style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                {new Date(rec.scheduled_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
