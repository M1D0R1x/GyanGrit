// components/DownloadManager.tsx
/**
 * Download manager panel — same glassmorphism recipe as NotificationPanel,
 * TopBar dropdown, and Sidebar.
 *
 *   glass-fill background + glass-stroke border + blur(16px)
 *   var(--font-display) for headings
 *   var(--saffron) accent color
 *   var(--ease-out-strong) transitions
 */

import { useOfflineDownload, useOnlineStatus } from "../hooks/useOffline";
import type { LessonDetail } from "../services/content";

type Props = {
  lesson: LessonDetail;
};

export default function DownloadManager({ lesson }: Props) {
  const {
    textSaved, pdfSaved, videoSaved, downloading, downloadType, progress, error,
    anySaved, saveText, savePdf, saveVideo, saveAll, removeAll,
  } = useOfflineDownload(lesson);
  const { online, slow } = useOnlineStatus();

  const hasText  = !!(lesson.content?.trim());
  const hasPdf   = !!lesson.pdf_url;
  const hasVideo = !!lesson.video_url;

  if (!hasText && !hasPdf && !hasVideo) return null;

  const allSaved = (hasText ? textSaved : true)
    && (hasPdf ? pdfSaved : true)
    && (hasVideo ? videoSaved : true);

  const accentColor = allSaved
    ? "var(--success, #10b981)"
    : "var(--saffron)";

  const typeCount = [hasText, hasPdf, hasVideo].filter(Boolean).length;
  const showRowSave = typeCount > 1;

  return (
    <div
      style={{
        marginTop:            "var(--space-6)",
        padding:              "var(--space-5)",
        background:           "var(--glass-fill)",
        border:               `1px solid ${allSaved ? "rgba(16,185,129,0.2)" : "var(--glass-stroke)"}`,
        borderRadius:         "var(--radius-lg)",
        backdropFilter:       "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow:            "var(--shadow-md)",
        transition:           `all 250ms var(--ease-out-strong)`,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          marginBottom:   "var(--space-4)",
          paddingBottom:  "var(--space-3)",
          borderBottom:   "1px solid var(--border-light)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {/* Icon circle — same pattern as NotificationPanel type icons */}
          <div
            style={{
              width:          32,
              height:         32,
              borderRadius:   "50%",
              background:     accentColor + "18",
              color:          accentColor,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              flexShrink:     0,
              transition:     "all 200ms ease",
            }}
          >
            {allSaved ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
          </div>
          <div>
            <div style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize:   "var(--text-sm)",
              color:      "var(--ink-primary)",
            }}>
              {allSaved ? "Available offline" : "Download for offline"}
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 1 }}>
              {allSaved
                ? "All content saved — accessible without internet"
                : "Save this lesson for offline access"}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content type rows ──────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        {hasText && (
          <ContentRow
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
            label="Lesson text"
            size="~3 KB"
            saved={textSaved}
            downloading={downloading && downloadType === "text"}
            onSave={saveText}
            disabled={!online && !textSaved}
            showSaveBtn={showRowSave}
          />
        )}
        {hasPdf && (
          <ContentRow
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
            label="PDF document"
            size="~0.5–2 MB"
            saved={pdfSaved}
            downloading={downloading && downloadType === "pdf"}
            onSave={savePdf}
            disabled={!online && !pdfSaved}
            iconColor="#ef4444"
            showSaveBtn={showRowSave}
          />
        )}
        {hasVideo && (
          <ContentRow
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>}
            label="Video"
            size="5–50 MB"
            saved={videoSaved}
            downloading={downloading && downloadType === "video"}
            progress={downloadType === "video" ? progress : undefined}
            onSave={saveVideo}
            disabled={!online && !videoSaved}
            iconColor="#8b5cf6"
            warning={slow ? "Slow connection — download may take a while" : undefined}
            showSaveBtn={showRowSave}
          />
        )}
      </div>

      {/* ── Video download progress bar ────────────────────────────────── */}
      {downloading && downloadType === "video" && (
        <div style={{
          marginTop:    "var(--space-3)",
          height:       3,
          borderRadius: 2,
          background:   "var(--border-light)",
          overflow:     "hidden",
        }}>
          <div style={{
            height:       "100%",
            width:        `${progress}%`,
            background:   "var(--saffron)",
            borderRadius: 2,
            transition:   "width 300ms var(--ease-out-strong)",
          }} />
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          marginTop:    "var(--space-3)",
          padding:      "var(--space-2) var(--space-3)",
          background:   "rgba(239,68,68,0.06)",
          border:       "1px solid rgba(239,68,68,0.15)",
          borderRadius: "var(--radius-md)",
          fontSize:     "var(--text-xs)",
          color:        "var(--error)",
          fontWeight:   500,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────────────────── */}
      <div style={{
        display:    "flex",
        gap:        "var(--space-2)",
        marginTop:  "var(--space-4)",
        paddingTop: "var(--space-3)",
        borderTop:  "1px solid var(--border-light)",
      }}>
        {!allSaved && online && (
          <button
            className="btn btn--primary"
            onClick={saveAll}
            disabled={downloading}
            style={{
              flex:     1,
              fontSize: "var(--text-xs)",
              padding:  "var(--space-2) var(--space-3)",
              gap:      6,
            }}
          >
            {downloading ? (
              <>
                <span className="btn__spinner" aria-hidden="true" />
                {downloadType === "video" ? `Downloading ${progress}%` : "Saving…"}
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Save All for Offline
              </>
            )}
          </button>
        )}

        {anySaved && (
          <button
            className="btn btn--ghost"
            onClick={removeAll}
            disabled={downloading}
            style={{
              fontSize: "var(--text-xs)",
              padding:  "var(--space-2) var(--space-3)",
              color:    "var(--error)",
              gap:      6,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ── Content row ──────────────────────────────────────────────────────────────

function ContentRow({
  icon,
  label,
  size,
  saved,
  downloading,
  progress,
  onSave,
  disabled,
  iconColor,
  warning,
  showSaveBtn = true,
}: {
  icon: React.ReactNode;
  label: string;
  size: string;
  saved: boolean;
  downloading?: boolean;
  progress?: number;
  onSave: () => void;
  disabled: boolean;
  iconColor?: string;
  warning?: string;
  showSaveBtn?: boolean;
}) {
  const color = iconColor ?? "#3b82f6";

  return (
    <div
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        padding:        "var(--space-2) var(--space-3)",
        borderRadius:   "var(--radius-md)",
        background:     saved ? "rgba(16,185,129,0.04)" : "transparent",
        transition:     "background 150ms ease",
      }}
      onMouseEnter={(e) => {
        if (!saved) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-elevated)";
      }}
      onMouseLeave={(e) => {
        if (!saved) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        {/* Type icon — same pattern as NotificationPanel TYPE_ICONS */}
        <div style={{
          width:          28,
          height:         28,
          borderRadius:   "50%",
          background:     (saved ? "#10b981" : color) + "18",
          color:          saved ? "#10b981" : color,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          flexShrink:     0,
        }}>
          {saved ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : icon}
        </div>

        <div>
          <div style={{
            fontSize:   "var(--text-sm)",
            fontWeight: 600,
            color:      "var(--ink-primary)",
          }}>
            {label}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", display: "flex", alignItems: "center", gap: 4 }}>
            {saved ? (
              <span style={{ color: "var(--success)", fontWeight: 600 }}>Saved</span>
            ) : (
              <span>{size}</span>
            )}
            {warning && !saved && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                <span style={{ color: "var(--warning)" }}>{warning}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action button — only when multiple content types (showSaveBtn) */}
      {!saved && showSaveBtn && (
        <button
          className="btn btn--secondary"
          onClick={onSave}
          disabled={disabled || downloading}
          style={{
            padding:   "2px 12px",
            fontSize:  "var(--text-xs)",
            minWidth:  58,
            fontWeight: 600,
          }}
        >
          {downloading
            ? progress != null
              ? `${progress}%`
              : "…"
            : "Save"}
        </button>
      )}
    </div>
  );
}
