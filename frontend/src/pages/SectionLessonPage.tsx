// pages.SectionLessonPage
/**
 * Renders a teacher-added section lesson (SectionLesson model).
 * Route: /lessons/section/:lessonId
 *
 * Key differences from LessonPage:
 *  - No mark-complete — section lessons don't track LessonProgress
 *  - "Teacher Added" badge instead of completion state
 *  - Same video/PDF/Markdown rendering as LessonPage
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../services/api";
import { extractYouTubeId, extractVimeoId } from "../services/media";

// ── Type ──────────────────────────────────────────────────────────────────

type SectionLessonDetail = {
  id:                  number;
  title:               string;
  order:               number;
  content:             string;
  video_url:           string | null;
  hls_manifest_url:    string | null;
  video_thumbnail_url: string | null;
  video_duration:      string;
  pdf_url:             string | null;
  has_video:           boolean;
  has_pdf:             boolean;
  has_content:         boolean;
  section_id:          number;
  course_id:           number;
  grade:               number;
  subject_name:        string;
};

// ── Markdown (reused from LessonPage) ────────────────────────────────────

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

    if (listType && !isList) { out.push(`</${listType}>`); listType = null; }

    if (line.startsWith("# "))       { out.push(`<h1>${inline(line.slice(2))}</h1>`); }
    else if (line.startsWith("## ")) { out.push(`<h2>${inline(line.slice(3))}</h2>`); }
    else if (line.startsWith("### ")){ out.push(`<h3>${inline(line.slice(4))}</h3>`); }
    else if (isBullet) {
      if (listType !== "ul") { if (listType === "ol") out.push("</ol>"); out.push("<ul>"); listType = "ul"; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (isOrdered) {
      if (listType !== "ol") { if (listType === "ul") out.push("</ul>"); out.push("<ol>"); listType = "ol"; }
      out.push(`<li>${inline(line.replace(/^\d+\. /, ""))}</li>`);
    } else if (line.trim() === "") {
      // blank line
    } else {
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (listType) out.push(`</${listType}>`);
  return out.join("\n");
}

// ── Video embed ───────────────────────────────────────────────────────────

function VideoEmbed({ url, thumbnail, duration }: {
  url:       string;
  thumbnail?: string | null;
  duration?:  string;
}) {
  const [playing, setPlaying] = useState(false);
  const ytId    = extractYouTubeId(url);
  const vimeoId = extractVimeoId(url);

  const isDirectVideo =
    !ytId && !vimeoId &&
    (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov") ||
     url.includes("r2.dev") || url.includes("r2.cloudflarestorage.com"));

  if (isDirectVideo) {
    return (
      <div style={{
        position: "relative", width: "100%", borderRadius: "var(--radius-lg)",
        overflow: "hidden", marginBottom: "var(--space-6)", background: "#000",
        boxShadow: "var(--shadow-lg)",
      }}>
        <video controls controlsList="nodownload" preload="metadata"
          poster={thumbnail ?? undefined}
          style={{ width: "100%", display: "block", maxHeight: "70vh" }}>
          <source src={url} type={url.includes(".webm") ? "video/webm" : "video/mp4"} />
          Your browser does not support video playback.
        </video>
        {duration && (
          <span style={{
            position: "absolute", bottom: "var(--space-3)", right: "var(--space-3)",
            background: "rgba(0,0,0,0.75)", color: "white", fontSize: "var(--text-xs)",
            fontWeight: 600, padding: "2px 8px", borderRadius: "var(--radius-full)",
            fontFamily: "var(--font-display)",
          }}>
            {duration}
          </span>
        )}
      </div>
    );
  }

  if (!ytId && !vimeoId) {
    return (
      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn--primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const thumbSrc = thumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "");

  return (
    <div style={{
      position: "relative", width: "100%", aspectRatio: "16 / 9",
      borderRadius: "var(--radius-lg)", overflow: "hidden",
      marginBottom: "var(--space-6)", background: "#000", boxShadow: "var(--shadow-lg)",
    }}>
      {playing ? (
        <iframe src={embedSrc} title="Lesson video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} />
      ) : (
        <button aria-label="Play video" onClick={() => setPlaying(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
            background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          {thumbSrc && (
            <img src={thumbSrc} alt="Video thumbnail"
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "var(--space-3)" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(255,255,255,0.9)", border: "2px solid var(--saffron)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            {duration && (
              <span style={{
                color: "white", fontSize: "var(--text-sm)",
                fontFamily: "var(--font-display)", fontWeight: 600,
                background: "rgba(0,0,0,0.6)", padding: "var(--space-1) var(--space-3)",
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

// ── PDF viewer ────────────────────────────────────────────────────────────

function PdfViewer({ url }: { url: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "var(--space-4) var(--space-5)",
        background: "var(--bg-elevated)",
        borderRadius: expanded ? "var(--radius-lg) var(--radius-lg) 0 0" : "var(--radius-lg)",
        border: "1px solid var(--border-light)",
        borderBottom: expanded ? "none" : "1px solid var(--border-light)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "var(--radius-sm)",
            background: "rgba(248,81,73,0.12)", border: "1px solid rgba(248,81,73,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--ink-primary)" }}>
              Lesson PDF
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Study material</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="btn btn--secondary"
            style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)" }}>
            Open
          </a>
          <button className="btn btn--ghost"
            style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)" }}
            onClick={() => setExpanded(!expanded)}>
            {expanded ? "Hide" : "Preview"}
          </button>
        </div>
      </div>
      {expanded && (
        <iframe src={url} title="Lesson PDF" style={{
          width: "100%", height: 600,
          border: "1px solid var(--border-light)", borderTop: "none",
          borderRadius: "0 0 var(--radius-lg) var(--radius-lg)", background: "white",
        }} />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function SectionLessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate     = useNavigate();

  const [lesson, setLesson]   = useState<SectionLessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    apiGet<SectionLessonDetail>(`/lessons/section/${lessonId}/`)
      .then(setLesson)
      .catch(() => setError("Could not load this lesson."))
      .finally(() => setLoading(false));
  }, [lessonId]);

  if (loading) {
    return (
      <div style={{ maxWidth: "var(--content-max-narrow)", margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", paddingTop: "var(--space-8)" }}>
          <div className="skeleton" style={{ height: 32, width: "60%", borderRadius: "var(--radius-sm)" }} />
          <div className="skeleton" style={{ height: 360, borderRadius: "var(--radius-lg)" }} />
          <div className="skeleton" style={{ height: 20, width: "90%", borderRadius: "var(--radius-sm)" }} />
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

  const hasVideo   = lesson.has_video;
  const hasPdf     = lesson.has_pdf;
  const hasContent = lesson.has_content;

  return (
    <div style={{ maxWidth: "var(--content-max-narrow)", margin: "0 auto" }}>

        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        {/* Title + "Teacher Added" badge */}
        <div style={{ marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
              background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
              color: "var(--saffron)", textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              Teacher Added
            </span>
            {hasVideo   && <span className="badge badge--success" style={{ fontSize: 10 }}>Video</span>}
            {hasPdf     && <span className="badge badge--warning" style={{ fontSize: 10 }}>PDF</span>}
            {hasContent && <span className="badge badge--info"    style={{ fontSize: 10 }}>Reading</span>}
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)",
            fontWeight: 800, color: "var(--ink-primary)",
            letterSpacing: "-0.03em", lineHeight: 1.2,
          }}>
            {lesson.title}
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginTop: "var(--space-2)" }}>
            {lesson.subject_name} · Class {lesson.grade}
          </p>
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

        {/* Empty state */}
        {!hasVideo && !hasPdf && !hasContent && (
          <div className="empty-state" style={{ paddingTop: "var(--space-16)" }}>
            <div className="empty-state__icon">🚧</div>
            <h3 className="empty-state__title">Content coming soon</h3>
            <p className="empty-state__message">Your teacher hasn't added content yet.</p>
          </div>
        )}

        {/* Note: section lessons don't track completion progress */}
    </div>
  );
}
