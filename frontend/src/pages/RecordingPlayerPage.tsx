// pages/RecordingPlayerPage.tsx
/**
 * Recording player page.
 *
 * - "ready": plays the video
 * - "processing": shows a progress UI that polls every 30 s
 * - "failed": error state with retry link
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { recordingsApi } from "../services/recordings";
import type { Recording } from "../services/recordings";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function RecordingPlayerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(30);

  const backUrl = location.pathname.replace(/\/[^/]+$/, ""); // strip last segment

  const fetchRecording = useCallback(() => {
    if (!sessionId) return;
    recordingsApi.getOne(sessionId)
      .then(data => setRecording(data))
      .catch(() => {/* silent — keep showing whatever we have */})
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => { fetchRecording(); }, [fetchRecording]);

  // Auto-refresh countdown when processing
  useEffect(() => {
    if (!recording || recording.recording_status !== "processing") return;
    queueMicrotask(() => setCountdown(30));
    const tick = setInterval(() => setCountdown(c => {
      if (c <= 1) {
        fetchRecording();
        return 30;
      }
      return c - 1;
    }), 1000);
    return () => clearInterval(tick);
  }, [recording, fetchRecording]);

  if (loading) {
    return (
      <div style={{ padding: "var(--space-6)", display: "flex", alignItems: "center", gap: "var(--space-3)", color: "var(--ink-muted)" }}>
        <div className="auth-loading__spinner" />
        <span>Loading recording…</span>
      </div>
    );
  }

  if (!recording) {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: 720, margin: "0 auto" }}>
        <Link to={backUrl} style={{ color: "var(--saffron)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
          ← Back to Recordings
        </Link>
        <div className="alert alert--error">Recording not found or you don&apos;t have access to it.</div>
      </div>
    );
  }

  const isReady      = recording.recording_status === "ready";
  const isProcessing = recording.recording_status === "processing";
  const isFailed     = recording.recording_status === "failed";

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "var(--space-6)" }}>
      {/* Back link */}
      <Link
        to={backUrl}
        style={{ color: "var(--saffron)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-5)", fontSize: "var(--text-sm)", fontWeight: 600 }}
      >
        ← Back to Recordings
      </Link>

      {/* Header */}
      <div style={{ marginBottom: "var(--space-5)" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "var(--text-2xl)", color: "var(--ink-primary)", marginBottom: "var(--space-2)", letterSpacing: "-0.02em" }}>
          {recording.title}
        </h1>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--ink-muted)", alignItems: "center" }}>
          <span>{recording.subject_name || "General"}</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>{recording.section_name || `Section #${recording.section_id}`}</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>👤 {recording.teacher_name}</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>📅 {new Date(recording.scheduled_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
          {recording.recording_duration_seconds && (
            <>
              <span style={{ opacity: 0.4 }}>•</span>
              <span>⏱ {formatDuration(recording.recording_duration_seconds)}</span>
            </>
          )}
          {recording.recording_size_bytes && (
            <>
              <span style={{ opacity: 0.4 }}>•</span>
              <span>💾 {formatBytes(recording.recording_size_bytes)}</span>
            </>
          )}
        </div>
      </div>

      {/* Video / Status Area */}
      <div style={{
        background: "#000", borderRadius: "var(--radius-xl)", overflow: "hidden",
        aspectRatio: "16 / 9", position: "relative", boxShadow: "var(--shadow-lg)",
      }}>
        {isReady && recording.recording_url ? (
          <video
            controls
            style={{ width: "100%", height: "100%", display: "block" }}
            src={recording.recording_url}
            preload="metadata"
          >
            Your browser does not support video playback.
          </video>
        ) : isProcessing ? (
          /* Processing State */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "var(--space-4)", color: "#fff", textAlign: "center", padding: "var(--space-6)" }}>
            {/* Animated progress ring */}
            <svg width="80" height="80" style={{ animation: "spin 2s linear infinite" }} viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="#f59e0b" strokeWidth="6"
                strokeLinecap="round" strokeDasharray="100 113" strokeDashoffset="0" />
            </svg>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", marginBottom: "var(--space-2)" }}>
                Processing Recording…
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.6)", maxWidth: 360 }}>
                LiveKit is encoding the video and uploading it to storage.<br/>
                This typically takes <strong style={{ color: "rgba(255,255,255,0.85)" }}>2–5 minutes</strong> after the session ends.
              </div>
            </div>
            <div style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: "var(--radius-lg)", padding: "var(--space-3) var(--space-5)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div style={{ width: 12, height: 12, background: "#f59e0b", borderRadius: "50%", animation: "pulse 1s ease-in-out infinite", flexShrink: 0 }} />
              <span style={{ fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.8)" }}>
                Auto-refreshing in <strong style={{ color: "#f59e0b", fontFamily: "monospace" }}>{countdown}s</strong>
              </span>
            </div>
          </div>
        ) : isFailed ? (
          /* Failed State */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "var(--space-4)", color: "#fff", textAlign: "center", padding: "var(--space-6)" }}>
            <div style={{ fontSize: 56 }}>❌</div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", marginBottom: "var(--space-2)" }}>
                Recording Failed
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.6)", maxWidth: 360 }}>
                The recording could not be processed. This can happen if the session was very short, or a connectivity issue occurred with the storage service.
              </div>
            </div>
            <button
              className="btn btn--ghost"
              style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", fontSize: "var(--text-sm)" }}
              onClick={fetchRecording}
            >
              ↺ Check Again
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.5)", fontSize: "var(--text-sm)" }}>
            No recording available for this session.
          </div>
        )}
      </div>

      {/* Download link for ready recordings */}
      {isReady && recording.recording_url && (
        <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-3)" }}>
          <a
            href={recording.recording_url}
            download
            target="_blank"
            rel="noreferrer"
            className="btn btn--ghost"
            style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", borderColor: "var(--border-strong)" }}
          >
            ⬇️ Download MP4
          </a>
        </div>
      )}
    </div>
  );
}
