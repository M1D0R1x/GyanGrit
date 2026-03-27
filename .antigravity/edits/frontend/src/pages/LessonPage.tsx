import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLessonDetail, type LessonDetail } from "../services/content";
import { apiPatch } from "../services/api";
import { extractYouTubeId, extractVimeoId } from "../services/media";
import { saveLessonOffline, isLessonSavedOffline, removeOfflineLesson, type OfflineLesson } from "../services/offline";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

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

function VideoEmbed({ url, thumbnail, duration }: {
  url: string; thumbnail?: string | null; duration?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const ytId    = extractYouTubeId(url);
  const vimeoId = extractVimeoId(url);

  const isDirectVideo = !ytId && !vimeoId &&
    (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov") ||
     url.includes("r2.dev") || url.includes("r2.cloudflarestorage.com"));

  if (isDirectVideo) {
    return (
      <div style={{ position: "relative", width: "100%", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: "var(--space-6)", background: "#000", boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}>
        <video controls controlsList="nodownload" preload="metadata" poster={thumbnail ?? undefined} style={{ width: "100%", display: "block", maxHeight: "70vh" }}>
          <source src={url} type={url.includes(".webm") ? "video/webm" : "video/mp4"} />
          Your browser does not support video playback.
        </video>
        <a href={url} download className="btn--secondary" style={{ position: "absolute", top: "var(--space-3)", right: "var(--space-3)", padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)", background: "rgba(13,17,23,0.8)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "var(--space-1)", borderRadius: "var(--radius-sm)", textDecoration: "none" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Download
        </a>
        {duration && (
          <span style={{ position: "absolute", bottom: "var(--space-3)", right: "var(--space-3)", background: "rgba(0,0,0,0.75)", color: "white", fontSize: "var(--text-xs)", fontWeight: 600, padding: "2px 8px", borderRadius: "var(--radius-full)", fontFamily: "var(--font-display)" }}>
            {duration}
          </span>
        )}
      </div>
    );
  }

  if (!ytId && !vimeoId) {
    return (
      <div className="glass-card" style={{ marginBottom: "var(--space-6)" }}>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn--primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
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
    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: "var(--space-6)", background: "#000", boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}>
      {playing ? (
        <iframe src={embedSrc} title="Lesson video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} />
      ) : (
        <button aria-label="Play video" onClick={() => setPlaying(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          {thumbSrc && <img src={thumbSrc} alt="Video thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-3)" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "2px solid rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </div>
            {duration && (
              <span style={{ color: "white", fontSize: "var(--text-sm)", fontFamily: "var(--font-display)", fontWeight: 600, background: "rgba(0,0,0,0.6)", padding: "var(--space-1) var(--space-3)", borderRadius: "var(--radius-full)" }}>
                {duration}
              </span>
            )}
          </div>
        </button>
      )}
    </div>
  );
}

// ── Save Offline button ──────────────────────────────────────────────────────

function SaveOfflineButton({ lesson }: { lesson: LessonDetail }) {
  const [saved, setSaved]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    isLessonSavedOffline(lesson.id).then((v) => { setSaved(v); setChecked(true); });
  }, [lesson.id]);

  if (!checked) return null;

  const handleToggle = async () => {
    setSaving(true);
    try {
      if (saved) {
        await removeOfflineLesson(lesson.id);
        setSaved(false);
      } else {
        const offlineData: OfflineLesson = {
          id: lesson.id, courseId: lesson.course?.id ?? 0,
          title: lesson.title, content: lesson.content ?? "",
          pdfUrl: lesson.pdf_url ?? "", order: 0, savedAt: new Date().toISOString(),
        };
        await saveLessonOffline(offlineData);
        setSaved(true);
      }
    } catch { /* silently fail */ }
    finally { setSaving(false); }
  };

  return (
    <div className="glass-card animate-fade-up" style={{ marginTop: "var(--space-6)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", border: `1px solid ${saved ? "rgba(61,214,140,0.25)" : "var(--glass-border)"}`, background: saved ? "rgba(61,214,140,0.05)" : "var(--glass-bg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <span style={{ fontSize: 20 }}>{saved ? "✅" : "📥"}</span>
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>{saved ? "Saved for offline" : "Save for offline"}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{saved ? "Available without internet" : "Read this lesson anytime"}</div>
        </div>
      </div>
      <button className={saved ? "btn--ghost" : "btn--secondary"} onClick={handleToggle} disabled={saving} style={{ fontSize: "var(--text-xs)", padding: "var(--space-2) var(--space-3)" }}>
        {saving ? "Saving…" : saved ? "Remove" : "Save"}
      </button>
    </div>
  );
}

// ── PDF viewer ────────────────────────────────────────────────────────────────

function PdfViewer({ url }: { url: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <div className="glass-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: expanded ? "var(--radius-lg) var(--radius-lg) 0 0" : "var(--radius-lg)", borderBottom: expanded ? "none" : undefined }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "rgba(248,81,73,0.12)", border: "1px solid rgba(248,81,73,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>Lesson PDF</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Study material</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn--secondary" style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)", textDecoration: "none", borderRadius: "var(--radius-sm)" }}>Open</a>
          <button className="btn--ghost" style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)" }} onClick={() => setExpanded(!expanded)}>
            {expanded ? "Hide" : "Preview"}
          </button>
        </div>
      </div>

      {expanded && (
        <iframe src={url} title="Lesson PDF" style={{ width: "100%", height: 600, border: "1px solid var(--glass-border)", borderTop: "none", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)", background: "white" }} />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

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
      .then((data) => { setLesson(data); setMarked(data.completed); })
      .catch(() => setError("Could not load this lesson."))
      .finally(() => setLoading(false));
  }, [lessonId]);

  const handleMarkComplete = async () => {
    if (!lesson || marked) return;
    setMarking(true);
    try {
      await apiPatch(`/lessons/${lesson.id}/progress/`, { completed: true });
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
      <div className="page-shell">
        <TopBar />
        <main className="page-content page-content--narrow">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", paddingTop: "var(--space-8)" }}>
            <div className="skeleton-box" style={{ height: 32, width: "60%", borderRadius: "var(--radius-sm)" }} />
            <div className="skeleton-box" style={{ height: 360, borderRadius: "var(--radius-lg)" }} />
            <div className="skeleton-box" style={{ height: 20, width: "90%", borderRadius: "var(--radius-sm)" }} />
            <div className="skeleton-box" style={{ height: 20, width: "80%", borderRadius: "var(--radius-sm)" }} />
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
          <div className="alert alert--error">{error ?? "Lesson not found."}</div>
          <button className="btn--ghost" onClick={() => navigate(-1)} style={{ marginTop: "var(--space-4)" }}>← Go back</button>
        </main>
      </div>
    );
  }

  const hasVideo   = !!(lesson.video_url || lesson.hls_manifest_url);
  const hasPdf     = !!lesson.pdf_url;
  const hasContent = !!(lesson.content?.trim());

  return (
    <div className="page-shell">
      <TopBar />
      <main className="page-content page-content--narrow page-enter has-bottom-nav">

        <button className="btn--ghost animate-fade-up" onClick={() => navigate(-1)} style={{ marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>

        {/* Title + badges */}
        <div className="animate-fade-up" style={{ marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
            {marked && (
              <span className="role-tag role-tag--student" style={{ fontSize: 9 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}><polyline points="20 6 9 17 4 12" /></svg>
                COMPLETED
              </span>
            )}
            {hasVideo   && <span className="role-tag role-tag--teacher" style={{ fontSize: 9 }}>VIDEO</span>}
            {hasPdf     && <span className="role-tag role-tag--principal" style={{ fontSize: 9 }}>PDF</span>}
            {hasContent && <span className="role-tag" style={{ fontSize: 9 }}>READING</span>}
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
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
          <div className="lesson-markdown animate-fade-up" dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.content) }} />
        )}

        {/* Empty state */}
        {!hasVideo && !hasPdf && !hasContent && (
          <div className="glass-card empty-well animate-fade-up">
            <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>🚧</span>
            <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>CONTENT COMING SOON</p>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>This lesson has not been filled in yet.</span>
          </div>
        )}

        {/* Teacher notes */}
        {lesson.notes && lesson.notes.length > 0 && (
          <div className="animate-fade-up" style={{ marginTop: "var(--space-8)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)", paddingBottom: "var(--space-3)", borderBottom: "1px solid var(--glass-border)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--role-teacher)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--role-teacher)" }}>Teacher Notes</span>
            </div>
            {lesson.notes.map((note) => (
              <div key={note.id} style={{ padding: "var(--space-4)", background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)", borderLeft: "3px solid var(--role-teacher)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-3)" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", whiteSpace: "pre-wrap" }}>{note.content}</p>
                <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>— {note.author__username}</div>
              </div>
            ))}
          </div>
        )}

        {/* Save for Offline */}
        {(lesson.content || lesson.pdf_url) && <SaveOfflineButton lesson={lesson} />}

        {/* Mark complete CTA */}
        <div className="glass-card animate-fade-up" style={{ marginTop: "var(--space-10)", textAlign: "center", border: `1px solid ${marked ? "rgba(61,214,140,0.25)" : "var(--glass-border)"}`, background: marked ? "rgba(61,214,140,0.05)" : "var(--glass-bg)", transition: "all 0.3s" }}>
          {marked ? (
            <div>
              <div style={{ fontSize: 40, marginBottom: "var(--space-3)" }}>🎉</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", color: "var(--role-student)", marginBottom: "var(--space-2)", letterSpacing: "-0.02em" }}>
                Lesson complete!
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>Well done. Keep going!</p>
              <button className="btn--secondary" onClick={() => navigate(-1)}>← Back to lessons</button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
                Finished reading? Mark this lesson as complete to track your progress.
              </p>
              <button className="btn--primary" onClick={handleMarkComplete} disabled={marking} style={{ letterSpacing: "0.05em" }}>
                {marking ? "Saving…" : <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  MARK AS COMPLETE
                </>}
              </button>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
