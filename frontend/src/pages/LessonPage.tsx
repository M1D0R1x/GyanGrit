import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLessonDetail, getCourseLessons, type LessonDetail, type LessonItem } from "../services/content";
import { apiPatch } from "../services/api";
import { extractYouTubeId, extractVimeoId } from "../services/media";
import { getOfflineLesson, getOfflinePdf, getOfflineVideo, createPdfBlobUrl, createVideoBlobUrl, isOnline, enqueueOfflineAction } from "../services/offline";
import { sendHeartbeat } from "../services/analytics";
import DownloadManager from "../components/DownloadManager";

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderMarkdown(raw: string): string {
  if (!raw) return "";
  const lines   = raw.split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inline = (s: string) =>
    escape(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");

  for (const line of lines) {
    const isBullet  = /^[-*] /.test(line);
    const isOrdered = /^\d+\. /.test(line);
    const isList    = isBullet || isOrdered;

    if (listType && !isList) {
      out.push(`</${listType}>`);
      listType = null;
    }

    if (line.startsWith("# ")) {
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (isBullet) {
      if (listType !== "ul") {
        if (listType === "ol") out.push("</ol>");
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (isOrdered) {
      if (listType !== "ol") {
        if (listType === "ul") out.push("</ul>");
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(line.replace(/^\d+\. /, ""))}</li>`);
    } else if (line.trim() === "") {
      // blank line — skip
    } else {
      out.push(`<p>${inline(line)}</p>`);
    }
  }

  if (listType) out.push(`</${listType}>`);
  return out.join("\n");
}

// ── Video embed ───────────────────────────────────────────────────────────────

function VideoEmbed({
  url,
  thumbnail,
  duration,
}: {
  url: string;
  thumbnail?: string | null;
  duration?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const ytId    = extractYouTubeId(url);
  const vimeoId = extractVimeoId(url);

  // ── R2 / direct MP4 or WebM — native HTML5 player ────────────────────────
  const isDirectVideo =
    !ytId &&
    !vimeoId &&
    (url.includes(".mp4") ||
      url.includes(".webm") ||
      url.includes(".mov") ||
      url.includes("r2.dev") ||
      url.includes("r2.cloudflarestorage.com"));

  if (isDirectVideo) {
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          marginBottom: "var(--space-6)",
          background: "#000",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <video
          controls
          controlsList="nodownload"
          preload="metadata"
          poster={thumbnail ?? undefined}
          style={{ width: "100%", display: "block", maxHeight: "70vh" }}
        >
          <source
            src={url}
            type={url.includes(".webm") ? "video/webm" : "video/mp4"}
          />
          Your browser does not support video playback.
        </video>

        {/* Download button — positioned over top-right of video */}
        <a
          href={url}
          download
          className="btn btn--secondary"
          style={{
            position: "absolute",
            top: "var(--space-3)",
            right: "var(--space-3)",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "var(--text-xs)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-medium)",
            color: "var(--ink-primary)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-1)",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download
        </a>

        {duration && (
          <span
            style={{
              position: "absolute",
              bottom: "var(--space-3)",
              right: "var(--space-3)",
              background: "rgba(0,0,0,0.75)",
              color: "white",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "var(--radius-full)",
              fontFamily: "var(--font-display)",
            }}
          >
            {duration}
          </span>
        )}
      </div>
    );
  }

  // ── Unknown URL — fallback link ───────────────────────────────────────────
  if (!ytId && !vimeoId) {
    return (
      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--primary"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Watch Video
        </a>
      </div>
    );
  }

  // ── YouTube / Vimeo embed ─────────────────────────────────────────────────
  const embedSrc = ytId
    ? `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;

  const thumbSrc =
    thumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "");

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
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
          }}
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
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-3)",
            }}
          >
            <div
              style={{
                width: 64, height: 64, borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              border: "2px solid var(--saffron)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            {duration && (
              <span
                style={{
                  color: "white",
                  fontSize: "var(--text-sm)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  background: "rgba(0,0,0,0.6)",
                  padding: "var(--space-1) var(--space-3)",
                  borderRadius: "var(--radius-full)",
                }}
              >
                {duration}
              </span>
            )}
          </div>
        </button>
      )}
    </div>
  );
}

// SaveOfflineButton replaced by DownloadManager component (imported above)

// ── PDF viewer ────────────────────────────────────────────────────────────────

function PdfViewer({ url }: { url: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-4) var(--space-5)",
          background: "var(--bg-elevated)",
          borderRadius: expanded
            ? "var(--radius-lg) var(--radius-lg) 0 0"
            : "var(--radius-lg)",
          border: "1px solid var(--border-medium)",
          borderBottom: expanded ? "none" : "1px solid var(--border-medium)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-sm)",
              background: "rgba(248,81,73,0.12)",
              border: "1px solid rgba(248,81,73,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--error)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--ink-primary)" }}>
              Lesson PDF
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
              Study material
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <a
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
            height: 600,
            border: "1px solid var(--border-medium)",
            borderTop: "none",
            borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
            background: "white",
          }}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LessonPage() {
  const { lessonId } = useParams();
  const navigate     = useNavigate();

  const [lesson, setLesson]         = useState<LessonDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [marking, setMarking]       = useState(false);
  const [marked, setMarked]         = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [courseLessons, setCourseLessons] = useState<LessonItem[]>([]);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Engagement heartbeat — fires every 30s while lesson is open
  useEffect(() => {
    if (!lesson || isOfflineMode) return;
    heartbeatRef.current = setInterval(() => {
      sendHeartbeat("lesson_view", lesson.id, lesson.title).catch(() => {});
    }, 30_000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [lesson?.id, isOfflineMode]);

  useEffect(() => {
    if (!lessonId) return;
    const id = Number(lessonId);

    getLessonDetail(id)
      .then((data) => {
        setLesson(data);
        setMarked(data.completed);
        // Fetch course lesson list for prev/next navigation
        if (data.course?.id) {
          getCourseLessons(data.course.id)
            .then(lessons => setCourseLessons(lessons.sort((a, b) => a.order - b.order)))
            .catch(() => {});
        }
      })
      .catch(async () => {
        // Offline fallback: try loading from IndexedDB
        try {
          const offlineLesson = await getOfflineLesson(id);
          if (offlineLesson) {
            const offlinePdf = await getOfflinePdf(id);
            const offlineVideo = await getOfflineVideo(id);
            const detail: LessonDetail = {
              id: offlineLesson.id,
              title: offlineLesson.title,
              content: offlineLesson.content,
              video_url: offlineVideo ? createVideoBlobUrl(offlineVideo) : null,
              video_thumbnail_url: null,
              video_duration: "",
              hls_manifest_url: null,
              pdf_url: offlinePdf ? createPdfBlobUrl(offlinePdf) : null,
              thumbnail_url: null,
              completed: false,
              last_position: 0,
              notes: [],
              course: {
                id: offlineLesson.courseId,
                title: offlineLesson.courseTitle ?? "",
                grade: offlineLesson.grade ?? 0,
                subject: offlineLesson.subjectName ?? "",
              },
            };
            setLesson(detail);
            setMarked(false);
            setIsOfflineMode(true);
            return;
          }
        } catch {
          // IndexedDB also failed
        }
        setError("Could not load this lesson. You may be offline.");
      })
      .finally(() => setLoading(false));
  }, [lessonId]);

  const handleMarkComplete = async () => {
    if (!lesson || marked) return;
    setMarking(true);
    try {
      if (isOnline()) {
        await apiPatch(`/lessons/${lesson.id}/progress/`, { completed: true });
      } else {
        // Queue for sync when back online
        await enqueueOfflineAction("lesson_complete", { lessonId: lesson.id });
      }
      setMarked(true);
      setLesson((prev) => (prev ? { ...prev, completed: true } : null));
    } catch {
      setError("Could not mark as complete. Please try again.");
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: "var(--content-max-narrow)", margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", paddingTop: "var(--space-8)" }}>
          <div className="skeleton" style={{ height: 32, width: "60%", borderRadius: "var(--radius-sm)" }} />
          <div className="skeleton" style={{ height: 360, borderRadius: "var(--radius-lg)" }} />
          <div className="skeleton" style={{ height: 20, width: "90%", borderRadius: "var(--radius-sm)" }} />
          <div className="skeleton" style={{ height: 20, width: "80%", borderRadius: "var(--radius-sm)" }} />
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div style={{ maxWidth: "var(--content-max-narrow)", margin: "0 auto" }}>
        <div className="alert alert--error">{error ?? "Lesson not found."}</div>
        <button className="back-btn" onClick={() => navigate(-1)}>← Go back</button>
      </div>
    );
  }

  const hasVideo   = !!(lesson.video_url || lesson.hls_manifest_url);
  const hasPdf     = !!lesson.pdf_url;
  const hasContent = !!(lesson.content?.trim());

  const ctaBg     = marked ? "rgba(16,185,129,0.06)" : "var(--bg-elevated)";
  const ctaBorder = marked ? "rgba(16,185,129,0.2)"  : "var(--border-medium)";

  // Prev / Next navigation
  const currentIdx = courseLessons.findIndex(l => l.id === lesson.id);
  const prevLesson = currentIdx > 0 ? courseLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx >= 0 && currentIdx < courseLessons.length - 1 ? courseLessons[currentIdx + 1] : null;

  const navBarStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "var(--space-3)",
    marginBottom: "var(--space-4)",
  };
  const navBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "var(--space-2) var(--space-4)",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-medium)",
    borderRadius: "var(--radius-lg)",
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--ink-secondary)",
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontFamily: "var(--font-body)",
    maxWidth: "45%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  return (
    <div style={{ maxWidth: "var(--content-max-narrow)", margin: "0 auto" }}>

        {/* ── Top nav row: Back + Prev/Next ── */}
        <div style={navBarStyle}>
          <button className="back-btn" onClick={() => navigate(-1)} style={{ margin: 0, flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
            {prevLesson && (
              <button style={navBtnStyle} onClick={() => navigate(`/lessons/${prevLesson.id}`)} title={prevLesson.title}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Prev
              </button>
            )}
            {nextLesson && (
              <button style={navBtnStyle} onClick={() => navigate(`/lessons/${nextLesson.id}`)} title={nextLesson.title}>
                Next
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Title + badges */}
        <div style={{ marginBottom: "var(--space-6)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            {isOfflineMode && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "var(--radius-full)", padding: "2px 10px",
                fontSize: 10, fontWeight: 800, color: "var(--error)",
                letterSpacing: "0.05em",
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                OFFLINE
              </span>
            )}
            {marked && (
              <span className="badge badge--success">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  style={{ marginRight: 4 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Completed
              </span>
            )}
            {hasVideo   && <span className="badge badge--success" style={{ fontSize: 10 }}>Video</span>}
            {hasPdf     && <span className="badge badge--warning" style={{ fontSize: 10 }}>PDF</span>}
            {hasContent && <span className="badge badge--info"    style={{ fontSize: 10 }}>Reading</span>}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-2xl)",
              fontWeight: 800,
              color: "var(--ink-primary)",
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
            }}
          >
            {lesson.title}
          </h1>
        </div>

        {/* Video */}
        {hasVideo && (
          <VideoEmbed
            url={(lesson.video_url ?? lesson.hls_manifest_url)!}
            thumbnail={lesson.video_thumbnail_url}
            duration={lesson.video_duration}
          />
        )}

        {/* PDF */}
        {hasPdf && <PdfViewer url={lesson.pdf_url!} />}

        {/* Markdown content */}
        {hasContent && (
          <div
            className="lesson-markdown"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.content) }}
          />
        )}

        {/* Empty state — differentiate offline-no-download vs genuinely empty */}
        {!hasVideo && !hasPdf && !hasContent && (
          <div className="empty-state" style={{ paddingTop: "var(--space-16)" }}>
            {isOfflineMode ? (
              <>
                <div className="empty-state__icon">📥</div>
                <h3 className="empty-state__title">Content not downloaded</h3>
                <p className="empty-state__message">
                  You saved this lesson offline, but the text content was not included.
                  Go online and download the full lesson content.
                </p>
              </>
            ) : (
              <>
                <div className="empty-state__icon">🚧</div>
                <h3 className="empty-state__title">Content coming soon</h3>
                <p className="empty-state__message">
                  This lesson has not been filled in yet.
                </p>
              </>
            )}
          </div>
        )}

        {/* Teacher notes */}
        {lesson.notes && lesson.notes.length > 0 && (
          <div style={{ marginTop: "var(--space-8)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                marginBottom: "var(--space-4)",
                paddingBottom: "var(--space-3)",
                borderBottom: "1px solid var(--border-light)",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--role-teacher)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--role-teacher)" }}>
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
                  borderLeft: "3px solid var(--role-teacher)",
                  borderRadius: "var(--radius-md)",
                  marginBottom: "var(--space-3)",
                }}
              >
                <p style={{ color: "var(--ink-secondary)", fontSize: "var(--text-sm)", whiteSpace: "pre-wrap" }}>
                  {note.content}
                </p>
                <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                  — {note.author__username}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Download for Offline — full download manager */}
        <DownloadManager lesson={lesson} />

        {/* Mark complete CTA */}
        <div
          style={{
            marginTop: "var(--space-10)",
            padding: "var(--space-6)",
            background: ctaBg,
            border: `1px solid ${ctaBorder}`,
            borderRadius: "var(--radius-lg)",
            textAlign: "center",
            transition: "all var(--transition-slow)",
          }}
        >
          {marked ? (
            <div>
              <div style={{ fontSize: 40, marginBottom: "var(--space-3)" }}>🎉</div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "var(--text-lg)",
                  color: "var(--success)",
                  marginBottom: "var(--space-2)",
                }}
              >
                Lesson complete!
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginBottom: "var(--space-4)" }}>
                Well done. Keep going!
              </p>
              <button className="btn btn--secondary" onClick={() => navigate(-1)}>
                ← Back to lessons
              </button>
              {nextLesson && (
                <button className="btn btn--primary" onClick={() => navigate(`/lessons/${nextLesson.id}`)}>
                  Next lesson →
                </button>
              )}
            </div>
          ) : (
            <div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginBottom: "var(--space-4)" }}>
                Finished reading? Mark this lesson as complete to track your progress.
              </p>
              <button
                className="btn btn--primary btn--lg"
                onClick={handleMarkComplete}
                disabled={marking}
              >
                {marking ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Mark as Complete
                  </>
                )}
              </button>
            </div>
          )}
        </div>
    </div>
  );
}