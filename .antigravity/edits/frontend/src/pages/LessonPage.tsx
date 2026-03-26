import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLessonDetail, type LessonDetail } from "../services/content";
import { apiPatch } from "../services/api";
import { extractYouTubeId, extractVimeoId } from "../services/media";
import { saveLessonOffline, isLessonSavedOffline, removeOfflineLesson, type OfflineLesson } from "../services/offline";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { 
  ChevronLeft, 
  Download, 
  Play, 
  CheckCircle2, 
  FileText, 
  Video, 
  BookOpen, 
  CloudOff,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  User,
  ShieldAlert
} from 'lucide-react';
import './LessonPage.css';

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderMarkdown(raw: string): string {
  if (!raw) return "";
  const lines = raw.split("\n");
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
      // blank line skip
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
      <div className="lesson-video-card glass-card animate-fade-up">
        <video
          controls
          controlsList="nodownload"
          preload="metadata"
          poster={thumbnail ?? undefined}
          className="lesson-video-player"
        >
          <source
            src={url}
            type={url.includes(".webm") ? "video/webm" : "video/mp4"}
          />
          Sync Failed: Hardware interface unsupported.
        </video>

        <a href={url} download className="lesson-download-btn">
          <Download size={14} /> DOWNLOAD
        </a>

        {duration && <span className="lesson-duration-tag">{duration}</span>}
      </div>
    );
  }

  // YouTube / Vimeo embed
  if (ytId || vimeoId) {
    const embedSrc = ytId
      ? `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`
      : `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;

    const thumbSrc =
      thumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "");

    return (
      <div className="lesson-video-card glass-card animate-fade-up">
        {playing ? (
          <iframe
            src={embedSrc}
            title="Lesson transmission"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="lesson-video-iframe"
          />
        ) : (
          <button
            className="lesson-video-placeholder"
            onClick={() => setPlaying(true)}
          >
            {thumbSrc && <img src={thumbSrc} alt="Thumbnail" className="lesson-video-poster" />}
            <div className="lesson-video-overlay" />
            <div className="lesson-play-btn">
               <Play size={24} fill="white" />
            </div>
            {duration && <span className="lesson-duration-tag">{duration}</span>}
          </button>
        )}
      </div>
    );
  }

  // Fallback
  return (
    <div className="glass-card animate-fade-up lesson-link-card">
       <Video size={32} style={{ opacity: 0.3 }} />
       <p>EXTERNAL BROADCAST DETECTED</p>
       <a href={url} target="_blank" rel="noopener noreferrer" className="btn--primary">
         LAUNCH EXTERNAL SYNC <ExternalLink size={14} />
       </a>
    </div>
  );
}

// ── Save Offline Component ───────────────────────────────────────────────────

function SaveOfflineButton({ lesson }: { lesson: LessonDetail }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    isLessonSavedOffline(lesson.id).then((v) => {
      setSaved(v);
      setChecked(true);
    });
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
          id: lesson.id,
          courseId: lesson.course?.id ?? 0,
          title: lesson.title,
          content: lesson.content ?? "",
          pdfUrl: lesson.pdf_url ?? "",
          order: 0,
          savedAt: new Date().toISOString(),
        };
        await saveLessonOffline(offlineData);
        setSaved(true);
      }
    } catch { /* fail silently */ }
    finally { setSaving(false); }
  };

  return (
    <div className={`offline-nexus glass-card ${saved ? 'offline-nexus--active' : ''}`}>
       <div className="offline-nexus__info">
          <div className="offline-icon">
            {saved ? <CheckCircle2 size={18} /> : <CloudOff size={18} />}
          </div>
          <div className="offline-text">
             <span className="offline-status">{saved ? "OFFLINE VECTOR SYNCHED" : "OFFLINE AVAILABILITY"}</span>
             <p className="offline-message">{saved ? "Unit accessible during signal blackout." : "Synchronize this unit to local cache."}</p>
          </div>
       </div>
       <button 
         className={saved ? "btn--ghost sm" : "btn--primary sm"}
         onClick={handleToggle}
         disabled={saving}
       >
         {saving ? "SYNCING..." : saved ? "DE-SYNCHRONIZE" : "SYNC OFFLINE"}
       </button>
    </div>
  );
}

// ── PDF Viewer Component ─────────────────────────────────────────────────────

function PdfViewer({ url }: { url: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pdf-nexus animate-fade-up">
       <div className={`pdf-nexus__header glass-card ${expanded ? 'expanded' : ''}`}>
          <div className="pdf-nexus__identity">
             <div className="pdf-icon">
                <FileText size={18} />
             </div>
             <div className="pdf-text">
                <span className="pdf-label">DOCUMENTATION DATA</span>
                <p className="pdf-title">LESSON_SUPPLEMENT.PDF</p>
             </div>
          </div>
          <div className="pdf-nexus__actions">
             <a href={url} target="_blank" rel="noopener noreferrer" className="btn--ghost sm">OPEN</a>
             <button className="btn--primary sm" onClick={() => setExpanded(!expanded)}>
                {expanded ? <EyeOff size={14} /> : <Eye size={14} />} {expanded ? "HIDE" : "PREVIEW"}
             </button>
          </div>
       </div>

       {expanded && (
         <div className="pdf-preview-container animate-fade-in">
            <iframe src={url} title="PDF Transmission" className="pdf-iframe" />
         </div>
       )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

const LessonPage: React.FC = () => {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    if (!lessonId) return;
    getLessonDetail(Number(lessonId))
      .then((data) => {
        setLesson(data);
        setMarked(data.completed);
      })
      .catch(() => setError("SIGNAL INTERFERENCE: Unit unreachable."))
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
      setError("TRANSMISSION ERROR: Progress sync failed.");
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar />
        <main className="page-content has-bottom-nav">
          <div className="lesson-skeleton animate-pulse-subtle">
             <div className="skeleton-line title" />
             <div className="skeleton-box video" />
             <div className="skeleton-line" />
             <div className="skeleton-line" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="page-shell">
        <TopBar />
        <main className="page-content">
          <div className="glass-card error-dock">
             <ShieldAlert size={16} /> {error || "DATA VOID: Unit not found."}
          </div>
          <button className="btn--ghost sm" onClick={() => navigate(-1)} style={{ marginTop: 'var(--space-6)' }}>
            <ChevronLeft size={14} /> BACK TO ARCHIVE
          </button>
        </main>
      </div>
    );
  }

  const hasVideo = !!(lesson.video_url || lesson.hls_manifest_url);
  const hasPdf = !!lesson.pdf_url;
  const hasContent = !!lesson.content?.trim();

  return (
    <div className="page-shell">
      <TopBar title="Knowledge Unit" />
      
      <main className="page-content page-enter has-bottom-nav lesson-layout">
        <button className="nav-back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} /> BACK
        </button>

        {/* Content Header */}
        <header className="lesson-header animate-fade-up">
           <div className="lesson-header__meta">
              <div className="role-tag role-tag--teacher">LECTURE UNIT</div>
              {marked && <div className="status-badge mastery"><CheckCircle2 size={12} /> MASTERY ACQUIRED</div>}
           </div>
           <h1 className="text-gradient display-md">{lesson.title}</h1>
           <div className="lesson-header__stats">
              <div className="stat-pill"><BookOpen size={12} /> {lesson.course?.title || "ARCHIVE"}</div>
              <div className="stat-pill"><Clock size={12} /> {lesson.video_duration || "READING"}</div>
           </div>
        </header>

        {/* Media Zone */}
        {hasVideo && (
          <VideoEmbed
            url={(lesson.video_url ?? lesson.hls_manifest_url)!}
            thumbnail={lesson.video_thumbnail_url}
            duration={lesson.video_duration}
          />
        )}

        {hasPdf && <PdfViewer url={lesson.pdf_url!} />}

        {/* Textual Transmission */}
        {hasContent && (
          <section className="lesson-markdown-body page-enter" style={{ animationDelay: '100ms' }}>
             <div dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.content) }} />
          </section>
        )}

        {/* Empty Well */}
        {!hasVideo && !hasPdf && !hasContent && (
          <div className="glass-card empty-well">
             <ShieldAlert size={40} style={{ opacity: 0.2, marginBottom: '20px' }} />
             <p style={{ fontWeight: 800, fontSize: '10px' }}>UNIT DEVOID OF DATA</p>
             <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Transmission scheduled for future epoch.</span>
          </div>
        )}

        {/* Teacher Annotations */}
        {lesson.notes && lesson.notes.length > 0 && (
          <section className="teacher-notes-section animate-fade-up">
             <div className="section-divider">
                <span>INSTRUCTOR ANNOTATIONS</span>
             </div>
             {lesson.notes.map(note => (
               <div key={note.id} className="note-card glass-card">
                  <div className="note-card__header">
                     <User size={12} /> {note.author__username.toUpperCase()}
                  </div>
                  <p className="note-content">{note.content}</p>
               </div>
             ))}
          </section>
        )}

        {/* Synchronization Nexus (Save Offline) */}
        {(lesson.content || lesson.pdf_url) && <SaveOfflineButton lesson={lesson} />}

        {/* Culmination Nexus (Mark Complete) */}
        <footer className="culmination-nexus animate-fade-up">
           <div className="glass-card culmination-card">
              {marked ? (
                <div className="culmination-success">
                   <div className="success-icon animate-bounce-subtle">✨</div>
                   <h3>UNIT CONCLUDED.</h3>
                   <p>Intelligence integrated into central cortex. Proceed to next nodal point.</p>
                   <button className="btn--ghost sm" onClick={() => navigate(-1)}>RETURN TO DASHBOARD</button>
                </div>
              ) : (
                <div className="culmination-pending">
                   <p>Conclude sequence to synchronize progress with central ledger?</p>
                   <button 
                     className="btn--primary lg" 
                     onClick={handleMarkComplete}
                     disabled={marking}
                   >
                     {marking ? "SYNCHRONIZING..." : "CONCLUDE UNIT SEQUENCE"}
                   </button>
                </div>
              )}
           </div>
        </footer>

      </main>
      <BottomNav />
    </div>
  );
};

export default LessonPage;
