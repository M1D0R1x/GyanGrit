import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLessonDetail, type LessonDetail } from "../services/content";
import { apiPatch } from "../services/api";
import { extractYouTubeId, extractVimeoId } from "../services/media";
import TopBar from "../components/TopBar";

// ─── Markdown renderer (no library — basic patterns only) ───────
function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])/gm, "")
    .trim();
}

// ─── Video embed ─────────────────────────────────────────────────
function VideoEmbed({ url, thumbnail, duration }: {
  url: string;
  thumbnail?: string | null;
  duration?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const ytId    = extractYouTubeId(url);
  const vimeoId = extractVimeoId(url);

  if (!ytId && !vimeoId) {
    return (
      <div style={{
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-6)",
        border: "1px solid var(--border-subtle)",
        marginBottom: "var(--space-6)",
      }}>

          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--primary"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Watch Video
        </a>
      </div>
    );
  }

  const embedSrc = ytId
    ? `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;

  const thumbSrc = thumbnail
    || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "");

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        background: "#000",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {playing ? (
        <iframe
          src={embedSrc}
          title="Lesson video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
        />
      ) : (
        <button
          aria-label="Play video"
          onClick={() => setPlaying(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {thumbSrc && (
            <img
              src={thumbSrc}
              alt="Video thumbnail"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          {/* Dark overlay */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
          }} />
          {/* Play button */}
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-3)",
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)",
              border: "2px solid rgba(255,255,255,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform var(--transition-fast), background var(--transition-fast)",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            {duration && (
              <span style={{
                color: "white",
                fontSize: "var(--text-sm)",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                background: "rgba(0,0,0,0.6)",
                padding: "var(--space-1) var(--space-3)",
                borderRadius: "var(--radius-full)",
              }}>
                {duration}
              </span>
            )}
          </div>
        </button>
      )}
    </div>
  );
}

// ─── PDF viewer ───────────────────────────────────────────────────
function PdfViewer({ url }: { url: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-4) var(--space-5)",
        background: "var(--bg-elevated)",
        borderRadius: expanded ? "var(--radius-lg) var(--radius-lg) 0 0" : "var(--radius-lg)",
        border: "1px solid var(--border-subtle)",
        borderBottom: expanded ? "none" : "1px solid var(--border-subtle)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-sm)",
            background: "rgba(248,81,73,0.12)",
            border: "1px solid rgba(248,81,73,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--error)" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
              Lesson PDF
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              Study material
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>

            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--secondary"
            style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)" }}
          >
            Open
          </a>
          <button
            className="btn btn--ghost"
            style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)" }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide" : "Preview"}
          </button>
        </div>
      </div>
      {expanded && (
        <iframe
          src={url}
          title="Lesson PDF"
          style={{
            width: "100%",
            height: "600px",
            border: "1px solid var(--border-subtle)",
            borderTop: "none",
            borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
            background: "white",
          }}
        />
      )}
    </div>
  );
}

// ─── Markdown content renderer ────────────────────────────────────
function MarkdownContent({ content }: { content: string }) {
  return (
    <div
      className="lesson-markdown"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}

// ─── Main page ────────────────────────────────────────────────────
export default function LessonPage() {
  const { lessonId } = useParams();
  const navigate     = useNavigate();

  const [lesson, setLesson]   = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked]   = useState(false);

  useEffect(() => {
    if (!lessonId) return;
    getLessonDetail(Number(lessonId))
      .then((data) => {
        setLesson(data);
        setMarked(data.completed);
      })
      .catch(() => setError("Could not load this lesson."))
      .finally(() => setLoading(false));
  }, [lessonId]);

  const handleMarkComplete = async () => {
    if (!lesson || marked) return;
    setMarking(true);
    try {
      await apiPatch(`/lessons/${lesson.id}/progress/`, { completed: true });
      setMarked(true);
      setLesson((prev) => prev ? { ...prev, completed: true } : null);
    } catch {
      setError("Could not mark as complete. Please try again.");
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar />
        <main className="page-content page-content--narrow">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", paddingTop: "var(--space-8)" }}>
            <div className="skeleton" style={{ height: 32, width: "60%", borderRadius: "var(--radius-sm)" }} />
            <div className="skeleton" style={{ height: 360, borderRadius: "var(--radius-lg)" }} />
            <div className="skeleton" style={{ height: 20, width: "90%", borderRadius: "var(--radius-sm)" }} />
            <div className="skeleton" style={{ height: 20, width: "80%", borderRadius: "var(--radius-sm)" }} />
            <div className="skeleton" style={{ height: 20, width: "70%", borderRadius: "var(--radius-sm)" }} />
          </div>
        </main>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="page-shell">
        <TopBar />
        <main className="page-content page-content--narrow">
          <div className="alert alert--error">{error || "Lesson not found."}</div>
          <button className="back-btn" onClick={() => navigate(-1)}>← Go back</button>
        </main>
      </div>
    );
  }

  const hasVideo   = !!(lesson.video_url || lesson.hls_manifest_url);
  const hasPdf     = !!lesson.pdf_url;
  const hasContent = !!lesson.content?.trim();

  return (
    <div className="page-shell">
      <TopBar />
      <main className="page-content page-content--narrow page-enter">

        {/* Back */}
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        {/* Lesson header */}
        <div style={{ marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
            {marked && (
              <span className="badge badge--success">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                  strokeLinejoin="round" style={{ marginRight: 4 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Completed
              </span>
            )}
            {hasVideo  && <span className="badge badge--success" style={{ fontSize: 10 }}>Video</span>}
            {hasPdf    && <span className="badge badge--warning" style={{ fontSize: 10 }}>PDF</span>}
            {hasContent && <span className="badge badge--info"   style={{ fontSize: 10 }}>Reading</span>}
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl)",
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.03em",
            lineHeight: 1.2,
          }}>
            {lesson.title}
          </h1>
        </div>

        {/* Video */}
        {hasVideo && (
          <VideoEmbed
            url={(lesson.video_url || lesson.hls_manifest_url)!}
            thumbnail={lesson.video_thumbnail_url}
            duration={lesson.video_duration}
          />
        )}

        {/* PDF */}
        {hasPdf && <PdfViewer url={lesson.pdf_url!} />}

        {/* Text content */}
        {hasContent && <MarkdownContent content={lesson.content} />}

        {/* Empty state */}
        {!hasVideo && !hasPdf && !hasContent && (
          <div className="empty-state" style={{ paddingTop: "var(--space-16)" }}>
            <div className="empty-state__icon">🚧</div>
            <h3 className="empty-state__title">Content coming soon</h3>
            <p className="empty-state__message">
              This lesson hasn't been filled in yet. Check back later.
            </p>
          </div>
        )}

        {/* Teacher notes */}
        {lesson.notes && lesson.notes.length > 0 && (
          <div style={{ marginTop: "var(--space-8)" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBottom: "var(--space-4)",
              paddingBottom: "var(--space-3)",
              borderBottom: "1px solid var(--border-subtle)",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="var(--role-teacher)" strokeWidth="2" strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
              <span style={{
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: "var(--role-teacher)",
              }}>
                Teacher Notes
              </span>
            </div>
            {lesson.notes.map((note) => (
              <div
                key={note.id}
                style={{
                  padding: "var(--space-4)",
                  background: "rgba(16,185,129,0.04)",
                  border: "1px solid rgba(16,185,129,0.15)",
                  borderRadius: "var(--radius-md)",
                  marginBottom: "var(--space-3)",
                  borderLeft: "3px solid var(--role-teacher)",
                }}
              >
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", whiteSpace: "pre-wrap" }}>
                  {note.content}
                </p>
                <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                  — {note.author__username}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mark complete CTA */}
        <div style={{
          marginTop: "var(--space-10)",
          padding: "var(--space-6)",
          background: marked ? "rgba(63,185,80,0.06)" : "var(--bg-elevated)",
          border: `1px solid ${marked ? "rgba(63,185,80,0.2)" : "var(--border-subtle)"}`,
          borderRadius: "var(--radius-lg)",
          textAlign: "center",
          transition: "all var(--transition-slow)",
        }}>
          {marked ? (
            <div>
              <div style={{
                fontSize: 40,
                marginBottom: "var(--space-3)",
                animation: "fadeInUp 0.4s ease both",
              }}>
                🎉
              </div>
              <div style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "var(--text-lg)",
                color: "var(--success)",
                marginBottom: "var(--space-2)",
              }}>
                Lesson complete!
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
                Well done. Keep going!
              </p>
              <button
                className="btn btn--secondary"
                onClick={() => navigate(-1)}
              >
                ← Back to lessons
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
                Finished reading? Mark this lesson as complete to track your progress.
              </p>
              <button
                className="btn btn--primary btn--lg"
                onClick={handleMarkComplete}
                disabled={marking}
              >
                {marking ? (
                  <><span className="btn__spinner" aria-hidden="true" /> Saving…</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Mark as Complete
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}