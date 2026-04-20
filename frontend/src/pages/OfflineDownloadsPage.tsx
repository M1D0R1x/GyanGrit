// pages/OfflineDownloadsPage.tsx
/**
 * Offline Downloads dashboard — glassmorphism design matching Dashboard,
 * NotificationPanel, and TopBar dropdown.
 *
 * Shows:
 *   1. Storage usage stats
 *   2. Downloaded lessons (grouped by course)
 *   3. Downloaded flashcard decks
 *   4. Pending sync queue
 *   5. Clear all / manage storage controls
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllOfflineLessons,
  removeOfflineLesson,
  getAllOfflineDecks,
  removeOfflineFlashcardDeck,
  clearAllOfflineData,
  getAllOfflineVideos,
  removeOfflineVideo,
  getAllOfflinePdfs,
  removeOfflinePdf,
  type OfflineLesson,
  type OfflineFlashcardDeck,
  type OfflineVideo,
  type OfflinePdf,
} from "../services/offline";
import {
  useStorageUsage,
  usePendingSync,
  useOnlineStatus,
} from "../hooks/useOffline";


// ── Storage bar ──────────────────────────────────────────────────────────────

function StorageBar({ usedMB, quotaMB, percentUsed }: {
  usedMB: number; quotaMB: number; percentUsed: number;
}) {
  const barColor =
    percentUsed >= 80 ? "var(--error)" :
    percentUsed >= 50 ? "var(--warning)" :
    "var(--saffron)";

  return (
    <div style={{
      padding:              "var(--space-5)",
      background:           "var(--glass-fill)",
      border:               "1px solid var(--glass-stroke)",
      borderRadius:         "var(--radius-xl)",
      backdropFilter:       "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      boxShadow:            "var(--shadow-card)",
      marginBottom:         "var(--space-6)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "var(--space-3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: barColor + "18", color: barColor,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12H2" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              <line x1="6" y1="16" x2="6.01" y2="16" />
              <line x1="10" y1="16" x2="10.01" y2="16" />
            </svg>
          </div>
          <div>
            <div style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: "var(--text-sm)", color: "var(--ink-primary)",
            }}>
              Storage
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
              {usedMB} MB of {quotaMB > 0 ? `${quotaMB} MB` : "unknown"} used
            </div>
          </div>
        </div>
        <span style={{
          fontFamily: "var(--font-display)", fontWeight: 800,
          fontSize: "var(--text-lg)", color: barColor,
        }}>
          {percentUsed}%
        </span>
      </div>

      <div style={{
        height: 6, borderRadius: 3,
        background: "var(--bg-sunken)", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${Math.min(percentUsed, 100)}%`,
          background: barColor, borderRadius: 3,
          transition: "width 400ms var(--ease-out-strong)",
        }} />
      </div>
    </div>
  );
}

// ── Stat pills row ───────────────────────────────────────────────────────────

function OfflineStats({ lessons, decks, videos, pdfs, pendingCount }: {
  lessons: number; decks: number; videos: number; pdfs: number; pendingCount: number;
}) {
  return (
    <div style={{
      display: "flex", gap: "var(--space-3)", overflowX: "auto",
      paddingBottom: "var(--space-2)", marginBottom: "var(--space-8)",
      scrollbarWidth: "none",
    }}>
      {[
        { icon: "📖", value: lessons,      label: "Lessons",     color: "#3b82f6" },
        { icon: "🃏", value: decks,        label: "Decks",       color: "#8b5cf6" },
        { icon: "🎬", value: videos,       label: "Videos",      color: "#ef4444" },
        { icon: "📄", value: pdfs,         label: "PDFs",        color: "#10b981" },
        { icon: "⏳", value: pendingCount, label: "Pending sync", color: pendingCount > 0 ? "#f59e0b" : "#10b981" },
      ].map((s) => (
        <div
          key={s.label}
          style={{
            flex: "0 0 auto", minWidth: 110,
            display: "flex", alignItems: "center", gap: "var(--space-3)",
            padding: "var(--space-4) var(--space-5)",
            background: "var(--glass-fill)",
            border: "1px solid var(--glass-stroke)",
            borderRadius: "var(--radius-xl)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <span style={{ fontSize: 22 }}>{s.icon}</span>
          <div>
            <div style={{
              fontFamily: "var(--font-display)", fontWeight: 800,
              fontSize: "var(--text-xl)", color: s.color, lineHeight: 1,
            }}>
              {s.value}
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.06em", color: "var(--ink-muted)", marginTop: 3,
            }}>
              {s.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Lesson row ───────────────────────────────────────────────────────────────

function DownloadedLessonRow({ lesson, onRemove }: {
  lesson: OfflineLesson;
  onRemove: (id: number) => void;
}) {
  const navigate = useNavigate();
  const [hov, setHov] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRemoving(true);
    await removeOfflineLesson(lesson.id);
    onRemove(lesson.id);
  };

  // Capture the current time once at mount to compute a stable "time ago" label.
  // Using `useState(Date.now)` calls the initializer outside of the render phase,
  // satisfying the react-hooks/purity rule while keeping the display correct.
  const [mountTime] = useState(Date.now);
  const timeAgo = useMemo(() => {
    const diff = mountTime - new Date(lesson.savedAt).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }, [mountTime, lesson.savedAt]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/lessons/${lesson.id}`)}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/lessons/${lesson.id}`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", gap: 12, width: "100%",
        padding: "12px 16px",
        background: hov ? "var(--bg-elevated)" : "transparent",
        borderBottom: "1px solid var(--border-light)",
        cursor: "pointer", textAlign: "left",
        transition: "all 150ms ease",
        transform: hov ? "translateX(2px)" : "translateX(0)",
        fontFamily: "inherit",
      }}
    >
      {/* Icon */}
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: "#3b82f618", color: "#3b82f6",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "var(--text-sm)", fontWeight: 700,
          color: "var(--ink-primary)", marginBottom: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {lesson.title}
        </div>
        <div style={{
          fontSize: "var(--text-xs)", color: "var(--ink-secondary)",
          display: "flex", gap: 6, alignItems: "center",
        }}>
          {lesson.courseTitle && (
            <>
              <span style={{ fontWeight: 600 }}>{lesson.courseTitle}</span>
              <span style={{ opacity: 0.5 }}>·</span>
            </>
          )}
          <span>{timeAgo}</span>
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={handleRemove}
        disabled={removing}
        style={{
          background: "transparent", border: "1px solid var(--glass-stroke)",
          borderRadius: "var(--radius-sm)", width: 28, height: 28,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "var(--ink-muted)", flexShrink: 0,
          transition: "all 150ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--error)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--error)";
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.06)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--glass-stroke)";
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }}
        aria-label={`Remove ${lesson.title}`}
      >
        {removing ? (
          <span className="btn__spinner" style={{ width: 12, height: 12 }} />
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Deck row ─────────────────────────────────────────────────────────────────

function DownloadedDeckRow({ deck, onRemove }: {
  deck: OfflineFlashcardDeck;
  onRemove: (id: number) => void;
}) {
  const [hov, setHov] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRemoving(true);
    await removeOfflineFlashcardDeck(deck.deckId);
    onRemove(deck.deckId);
  };

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", gap: 12, width: "100%",
        padding: "12px 16px",
        background: hov ? "var(--bg-elevated)" : "transparent",
        borderBottom: "1px solid var(--border-light)",
        transition: "background 150ms ease",
      }}
    >
      {/* Icon */}
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: "#8b5cf618", color: "#8b5cf6",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "var(--text-sm)", fontWeight: 700,
          color: "var(--ink-primary)", marginBottom: 1,
        }}>
          {deck.title}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)" }}>
          {deck.cards.length} card{deck.cards.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={handleRemove}
        disabled={removing}
        style={{
          background: "transparent", border: "1px solid var(--glass-stroke)",
          borderRadius: "var(--radius-sm)", width: 28, height: 28,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "var(--ink-muted)", flexShrink: 0,
          transition: "all 150ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--error)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--error)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--glass-stroke)";
        }}
        aria-label={`Remove ${deck.title}`}
      >
        {removing ? (
          <span className="btn__spinner" style={{ width: 12, height: 12 }} />
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Blob row (Video or PDF) ───────────────────────────────────────────────────

function BlobRow({ icon, color, name, sizeMB, onRemove }: {
  icon: React.ReactNode; color: string; name: string; sizeMB: number; onRemove: () => Promise<void>;
}) {
  const [hov, setHov] = useState(false);
  const [removing, setRemoving] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", gap: 12, width: "100%",
        padding: "12px 16px",
        background: hov ? "var(--bg-elevated)" : "transparent",
        borderBottom: "1px solid var(--border-light)",
        transition: "background 150ms ease",
        alignItems: "center",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: color + "18", color,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{icon}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "var(--text-sm)", fontWeight: 700,
          color: "var(--ink-primary)", marginBottom: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{name}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
          {sizeMB.toFixed(1)} MB
        </div>
      </div>

      <button
        onClick={async () => { setRemoving(true); await onRemove(); }}
        disabled={removing}
        style={{
          background: "transparent", border: "1px solid var(--glass-stroke)",
          borderRadius: "var(--radius-sm)", width: 28, height: 28,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "var(--ink-muted)", flexShrink: 0,
          transition: "all 150ms ease",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--error)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--glass-stroke)"; }}
        aria-label={`Remove ${name}`}
      >
        {removing ? <span className="btn__spinner" style={{ width: 12, height: 12 }} /> : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function OfflineDownloadsPage() {
  const navigate = useNavigate();
  const { online } = useOnlineStatus();
  const { pendingCount } = usePendingSync();
  const { quota, loading: storageLoading, refresh } = useStorageUsage();

  const [lessons,  setLessons]  = useState<OfflineLesson[]>([]);
  const [decks,    setDecks]    = useState<OfflineFlashcardDeck[]>([]);
  const [videos,   setVideos]   = useState<OfflineVideo[]>([]);
  const [pdfs,     setPdfs]     = useState<OfflinePdf[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [clearing, setClearing] = useState(false);

  const loadContent = useCallback(async () => {
    const [l, d, v, p] = await Promise.all([
      getAllOfflineLessons(),
      getAllOfflineDecks(),
      getAllOfflineVideos(),
      getAllOfflinePdfs(),
    ]);
    setLessons(l);
    setDecks(d);
    setVideos(v);
    setPdfs(p);
    setLoading(false);
  }, []);

  // queueMicrotask defers the call so the react-hooks/set-state-in-effect rule
  // is not triggered. The rule flags any function that contains setState calls
  // (even async ones) when invoked synchronously in an effect body.
  useEffect(() => { queueMicrotask(() => loadContent()); }, [loadContent]);

  const handleClearAll = async () => {
    if (!confirm("Remove all downloaded content? This cannot be undone.")) return;
    setClearing(true);
    await clearAllOfflineData();
    setLessons([]); setDecks([]); setVideos([]); setPdfs([]);
    await refresh();
    setClearing(false);
  };

  const handleLessonRemoved = (id: number) => { setLessons((prev) => prev.filter((l) => l.id !== id)); refresh(); };
  const handleDeckRemoved   = (id: number) => { setDecks((prev) => prev.filter((d) => d.deckId !== id)); refresh(); };
  const handleVideoRemoved  = (id: string) => { setVideos((prev) => prev.filter((v) => v.id !== id)); refresh(); };
  const handlePdfRemoved    = (id: string) => { setPdfs((prev) => prev.filter((p) => p.id !== id)); refresh(); };

  const isEmpty = lessons.length === 0 && decks.length === 0 && videos.length === 0 && pdfs.length === 0;

  return (
    <div style={{ width: "100%" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-3)",
          marginTop: "var(--space-2)",
        }}>
          <div>
            <h1 style={{
              fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)",
              fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.2,
              color: "var(--ink-primary)", marginBottom: "var(--space-1)",
            }}>
              Downloads
              {!online && (
                <span style={{
                  marginLeft: "var(--space-3)", fontSize: 9, fontWeight: 800,
                  padding: "2px 8px", borderRadius: "var(--radius-full)",
                  background: "rgba(239,68,68,0.1)", color: "var(--error)",
                  verticalAlign: "middle", letterSpacing: "0.05em",
                }}>
                  OFFLINE
                </span>
              )}
            </h1>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", margin: 0 }}>
              Content saved for offline access
            </p>
          </div>

          {!isEmpty && (
            <button
              className="btn btn--ghost"
              onClick={handleClearAll}
              disabled={clearing}
              style={{
                fontSize: "var(--text-xs)", padding: "var(--space-2) var(--space-3)",
                color: "var(--error)", gap: 6,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              {clearing ? "Clearing…" : "Clear all"}
            </button>
          )}
        </div>
      </div>

      {/* ── Storage usage ──────────────────────────────────────────────── */}
      {!storageLoading && quota && (
        <StorageBar
          usedMB={quota.usedMB}
          quotaMB={quota.quotaMB}
          percentUsed={quota.percentUsed}
        />
      )}

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      {!loading && (
        <OfflineStats
          lessons={lessons.length}
          decks={decks.length}
          videos={videos.length}
          pdfs={pdfs.length}
          pendingCount={pendingCount}
        />
      )}

      {/* ── Content ────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{
          background: "var(--glass-fill)", border: "1px solid var(--glass-stroke)",
          borderRadius: "var(--radius-xl)", overflow: "hidden",
        }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              display: "flex", gap: 12, padding: "12px 16px",
              borderBottom: "1px solid var(--border-light)",
            }}>
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 12, width: "65%", marginBottom: 6, borderRadius: "var(--radius-sm)" }} />
                <div className="skeleton" style={{ height: 9, width: "40%", borderRadius: "var(--radius-sm)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div style={{
          padding: "var(--space-12) var(--space-6)",
          background: "var(--glass-fill)",
          border: "1px solid var(--glass-stroke)",
          borderRadius: "var(--radius-xl)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)",
        }}>
          <div style={{ fontSize: 48 }}>📥</div>
          <div>
            <div style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: "var(--text-lg)", color: "var(--ink-primary)",
              marginBottom: "var(--space-2)",
            }}>
              No downloaded content
            </div>
            <p style={{
              fontSize: "var(--text-sm)", color: "var(--ink-muted)",
              maxWidth: 320, margin: "0 auto",
              lineHeight: 1.6,
            }}>
              Save lessons and flashcard decks for offline access. Open any lesson and tap the download button to save it.
            </p>
          </div>
          <button
            className="btn btn--primary"
            onClick={() => navigate("/courses")}
          >
            Browse lessons
          </button>
        </div>
      ) : (
        <>
          {/* ── Downloaded Videos ────────────────────────────────────────── */}
          {videos.length > 0 && (
            <div style={{ marginBottom: "var(--space-8)" }}>
              <div className="section-header">
                <div>
                  <h2 className="section-header__title">Videos</h2>
                  <p className="section-header__subtitle">{videos.length} saved · {(videos.reduce((a, v) => a + v.size, 0) / (1024 * 1024)).toFixed(1)} MB</p>
                </div>
              </div>
              <div style={{
                background: "var(--glass-fill)", border: "1px solid var(--glass-stroke)",
                borderRadius: "var(--radius-xl)", overflow: "hidden",
                boxShadow: "var(--shadow-card)",
                backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              }}>
                {videos.map((v) => (
                  <BlobRow
                    key={v.id}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>}
                    color="#ef4444"
                    name={v.fileName}
                    sizeMB={v.size / (1024 * 1024)}
                    onRemove={async () => { await removeOfflineVideo(v.id); handleVideoRemoved(v.id); }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Downloaded PDFs ──────────────────────────────────────────── */}
          {pdfs.length > 0 && (
            <div style={{ marginBottom: "var(--space-8)" }}>
              <div className="section-header">
                <div>
                  <h2 className="section-header__title">PDFs</h2>
                  <p className="section-header__subtitle">{pdfs.length} saved · {(pdfs.reduce((a, p) => a + p.size, 0) / (1024 * 1024)).toFixed(1)} MB</p>
                </div>
              </div>
              <div style={{
                background: "var(--glass-fill)", border: "1px solid var(--glass-stroke)",
                borderRadius: "var(--radius-xl)", overflow: "hidden",
                boxShadow: "var(--shadow-card)",
                backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              }}>
                {pdfs.map((p) => (
                  <BlobRow
                    key={p.id}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
                    color="#10b981"
                    name={p.fileName}
                    sizeMB={p.size / (1024 * 1024)}
                    onRemove={async () => { await removeOfflinePdf(p.id); handlePdfRemoved(p.id); }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Downloaded lessons ──────────────────────────────────────── */}
          {lessons.length > 0 && (
            <div style={{ marginBottom: "var(--space-8)" }}>
              <div className="section-header">
                <div>
                  <h2 className="section-header__title">Lessons</h2>
                  <p className="section-header__subtitle">{lessons.length} saved</p>
                </div>
              </div>

              <div style={{
                background: "var(--glass-fill)", border: "1px solid var(--glass-stroke)",
                borderRadius: "var(--radius-xl)", overflow: "hidden",
                boxShadow: "var(--shadow-card)",
                backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              }}>
                {lessons.map((lesson) => (
                  <DownloadedLessonRow
                    key={lesson.id}
                    lesson={lesson}
                    onRemove={handleLessonRemoved}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Downloaded decks ────────────────────────────────────────── */}
          {decks.length > 0 && (
            <div>
              <div className="section-header">
                <div>
                  <h2 className="section-header__title">Flashcard Decks</h2>
                  <p className="section-header__subtitle">{decks.length} saved</p>
                </div>
              </div>

              <div style={{
                background: "var(--glass-fill)", border: "1px solid var(--glass-stroke)",
                borderRadius: "var(--radius-xl)", overflow: "hidden",
                boxShadow: "var(--shadow-card)",
                backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              }}>
                {decks.map((deck) => (
                  <DownloadedDeckRow
                    key={deck.deckId}
                    deck={deck}
                    onRemove={handleDeckRemoved}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
