// pages/RecordedSessionsPage.tsx
/**
 * Recorded sessions listing page.
 *
 * - Students: only READY recordings for their section
 * - Teachers: all statuses for their sessions (so they can track processing)
 * - Principal/Admin: all recordings with full debug info
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { recordingsApi } from "../services/recordings";
import type { Recording } from "../services/recordings";
import { useAuth } from "../auth/AuthContext";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const STATUS_COLORS: Record<string, string> = {
  ready:      "var(--success, #22c55e)",
  processing: "var(--warning, #f59e0b)",
  failed:     "var(--error, #ef4444)",
  none:       "var(--ink-muted)",
};
const STATUS_BG: Record<string, string> = {
  ready:      "rgba(34,197,94,0.12)",
  processing: "rgba(245,158,11,0.12)",
  failed:     "rgba(239,68,68,0.1)",
  none:       "rgba(107,114,128,0.08)",
};
const STATUS_LABELS: Record<string, string> = {
  ready:      "✅ Ready",
  processing: "⏳ Processing",
  failed:     "❌ Failed",
  none:       "—",
};

function RecordingCard({
  rec, baseUrl,
}: {
  rec: Recording;
  baseUrl: string;
}) {
  const isReady = rec.recording_status === "ready";
  const isProcessing = rec.recording_status === "processing";
  const isFailed = rec.recording_status === "failed";

  return (
    <Link
      to={`${baseUrl}/${rec.id}`}
      style={{
        display: "block",
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${isFailed ? "rgba(239,68,68,0.25)" : "var(--border-light)"}`,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        transition: "box-shadow 0.18s ease, transform 0.18s ease",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {/* Thumbnail / Status Area */}
      <div style={{
        width: "100%",
        aspectRatio: "16 / 9",
        background: isReady
          ? "linear-gradient(135deg, rgba(13,20,33,0.92), rgba(30,10,60,0.88))"
          : isProcessing
          ? "linear-gradient(135deg, rgba(30,25,5,0.9), rgba(50,35,0,0.88))"
          : "linear-gradient(135deg, rgba(30,5,5,0.9), rgba(50,0,0,0.88))",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* Decorative pattern */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.06,
          background: "repeating-linear-gradient(45deg, #fff 0px, #fff 1px, transparent 1px, transparent 20px)",
        }} />

        {/* Play button / Status Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: isReady ? "rgba(255,255,255,0.15)" : isProcessing ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(8px)", border: `1px solid ${isReady ? "rgba(255,255,255,0.25)" : isProcessing ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)"}`,
          zIndex: 1,
        }}>
          {isReady ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><polygon points="6 4 20 12 6 20 6 4"/></svg>
          ) : isProcessing ? (
            <div style={{ width: 22, height: 22, border: "2.5px solid rgba(245,158,11,0.3)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          ) : (
            <span style={{ fontSize: 22 }}>❌</span>
          )}
        </div>

        {/* Duration badge */}
        {rec.recording_duration_seconds && (
          <div style={{
            position: "absolute", bottom: 10, right: 10,
            background: "rgba(0,0,0,0.7)", color: "#fff",
            fontSize: 11, fontWeight: 700, padding: "3px 8px",
            borderRadius: 4, fontFamily: "var(--font-mono, monospace)",
          }}>
            {formatDuration(rec.recording_duration_seconds)}
          </div>
        )}

        {/* Status badge */}
        <div style={{
          position: "absolute", top: 10, right: 10,
          background: STATUS_BG[rec.recording_status],
          color: STATUS_COLORS[rec.recording_status],
          fontSize: 10, fontWeight: 700, padding: "2px 8px",
          borderRadius: 20, border: `1px solid ${STATUS_COLORS[rec.recording_status]}40`,
          backdropFilter: "blur(4px)",
        }}>
          {STATUS_LABELS[rec.recording_status]}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "var(--space-4)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--ink-primary)", marginBottom: "var(--space-2)", lineHeight: 1.3 }}>
          {rec.title}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", display: "flex", flexWrap: "wrap" as const, gap: "var(--space-2)", alignItems: "center" }}>
          <span>{rec.subject_name || "General"}</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>{rec.section_name || `Section #${rec.section_id}`}</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>👤 {rec.teacher_name}</span>
        </div>
        <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--ink-muted)", display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <span>📅 {new Date(rec.scheduled_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
          {rec.recording_size_bytes && (
            <span>💾 {formatBytes(rec.recording_size_bytes)}</span>
          )}
        </div>

        {/* Processing state — simple info text */}
        {isProcessing && (
          <div style={{ marginTop: "var(--space-3)", borderRadius: "var(--radius-md)", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", padding: "var(--space-3)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--warning, #f59e0b)", fontWeight: 500 }}>
              ⏳ Recording is being processed. This usually takes 2–5 minutes.
            </div>
          </div>
        )}

        {/* Failed state */}
        {isFailed && (
          <div style={{ marginTop: "var(--space-3)", borderRadius: "var(--radius-md)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", padding: "var(--space-3)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--error, #ef4444)", fontWeight: 500 }}>
              ❌ Recording could not be processed.
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}


export default function RecordedSessionsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  // Derive the base URL for recording links based on current path prefix
  const basePath = location.pathname.replace(/\/recordings.*/, "");
  const recordingsBase = `${basePath}/recordings`;

  const isTeacher = user?.role === "TEACHER" || user?.role === "PRINCIPAL" || user?.role === "ADMIN";

  const fetchRecordings = useCallback((showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    return recordingsApi.list(statusFilter ? { recording_status: statusFilter } : {})
      .then(data => setRecordings(data))
      .catch(() => {/* silent */})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [statusFilter]);

  useEffect(() => { fetchRecordings(); }, [fetchRecordings]);

  // Auto-refresh every 30 s if any recording is processing
  useEffect(() => {
    const hasProcessing = recordings.some(r => r.recording_status === "processing");
    if (!hasProcessing) return;
    const timer = setInterval(() => { if (navigator.onLine) fetchRecordings(); }, 30_000);
    return () => clearInterval(timer);
  }, [recordings, fetchRecordings]);

  const filterOptions = isTeacher
    ? [
        { value: "", label: "All" },
        { value: "ready", label: "✅ Ready" },
        { value: "processing", label: "⏳ Processing" },
        { value: "failed", label: "❌ Failed" },
      ]
    : [];

  const processingCount = recordings.filter(r => r.recording_status === "processing").length;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-6)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "var(--space-6)", gap: "var(--space-4)", flexWrap: "wrap" as const }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "var(--text-2xl)", color: "var(--ink-primary)", letterSpacing: "-0.03em", margin: 0 }}>
            📹 Recorded Sessions
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
            {isTeacher ? "Track, replay, and manage your class recordings." : "Watch previous live classes."}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          {isTeacher && filterOptions.length > 0 && (
            <select
              className="form-input"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ fontSize: "var(--text-xs)", padding: "var(--space-2) var(--space-3)", minWidth: 130, margin: 0 }}
            >
              {filterOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          <button
            className="btn btn--ghost"
            style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)", borderColor: "var(--border-strong)" }}
            onClick={() => fetchRecordings(true)}
            disabled={refreshing}
          >
            {refreshing ? <div className="auth-loading__spinner" style={{ width: 14, height: 14, margin: 0 }} /> : "↺ Refresh"}
          </button>
        </div>
      </div>

      {/* Processing alert */}
      {processingCount > 0 && (
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--radius-lg)", padding: "var(--space-3) var(--space-4)", marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)", fontSize: "var(--text-sm)" }}>
          <div style={{ width: 16, height: 16, border: "2px solid rgba(245,158,11,0.3)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 1s linear infinite", flexShrink: 0 }} />
          <span style={{ color: "var(--ink-primary)" }}>
            <b>{processingCount}</b> recording{processingCount > 1 ? "s" : ""} processing — page auto-refreshes every 30 seconds.
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ aspectRatio: "16/9", borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      ) : recordings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📹</div>
          <h3 className="empty-state__title">No recordings yet</h3>
          <p className="empty-state__message">
            {isTeacher
              ? "Start a live session to generate recordings. They appear here after processing."
              : "Your teacher hasn't held any recorded sessions yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {recordings.map(rec => (
            <RecordingCard
              key={rec.id}
              rec={rec}
              baseUrl={recordingsBase}
            />
          ))}

        </div>
      )}
    </div>
  );
}
