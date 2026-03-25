import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLessonDetail, type LessonDetail } from "../services/content";
import { apiPatch } from "../services/api";
import { extractYouTubeId, extractVimeoId } from "../services/media";
import { saveLessonOffline, isLessonSavedOffline, removeOfflineLesson, type OfflineLesson } from "../services/offline";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

const renderMarkdown = (raw: string): string => {
  if (!raw) return "";
  const lines = raw.split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  const inline = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`(.+?)`/g, "<code>$1</code>");
  for (const line of lines) {
    const isBullet = /^[-*] /.test(line);
    if (line.startsWith("# ")) out.push(`<h1>${inline(line.slice(2))}</h1>`);
    else if (line.startsWith("## ")) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (isBullet) {
      if (listType !== "ul") { out.push("<ul>"); listType = "ul"; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (line.trim() === "") { if (listType) { out.push(`</${listType}>`); listType = null; } }
    else out.push(`<p>${inline(line)}</p>`);
  }
  if (listType) out.push(`</${listType}>`);
  return out.join("\n");
};

const VideoEmbed: React.FC<{ url: string; thumbnail?: string | null }> = ({ url, thumbnail }) => {
  const [playing, setPlaying] = useState(false);
  const ytId = extractYouTubeId(url);
  const vimeoId = extractVimeoId(url);
  const embedSrc = ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0` : `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;
  const thumbSrc = thumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "");

  return (
    <div className="glass-card animate-fade-up" style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', padding: 0, marginBottom: 'var(--space-8)' }}>
      {playing ? (
        <iframe src={embedSrc} allow="autoplay; encrypted-media" allowFullScreen style={{ width: '100%', height: '100%', border: 'none' }} />
      ) : (
        <div onClick={() => setPlaying(true)} style={{ width: '100%', height: '100%', position: 'relative', cursor: 'pointer' }}>
           {thumbSrc && <img src={thumbSrc} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
           <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div style={{ width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '16px solid white', marginLeft: '4px' }} />
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const LessonPage: React.FC = () => {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    if (lessonId) getLessonDetail(Number(lessonId)).then(d => { setLesson(d); setMarked(d.completed); }).finally(() => setLoading(false));
  }, [lessonId]);

  const handleMarkComplete = async () => {
     if (!lesson || marked) return;
     await apiPatch(`/lessons/${lesson.id}/progress/`, { completed: true });
     setMarked(true);
  };

  if (loading) return <div className="page-shell"><TopBar /><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="btn__spinner" /></main></div>;

  return (
    <div className="page-shell">
      <TopBar />
      <main className="page-content page-enter has-bottom-nav" style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-10) var(--space-6)' }}>
        
        {/* Editorial Header */}
        <header style={{ marginBottom: 'var(--space-10)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div className="role-tag role-tag--teacher" style={{ fontSize: '9px' }}>LECTURE UNIT</div>
              {marked && <span style={{ fontSize: '10px', color: 'var(--role-student)', fontWeight: 900 }}>✓ MASTERY ACQUIRED</span>}
           </div>
           <h1 className="text-gradient" style={{ fontSize: 'clamp(32px, 8vw, 56px)', lineHeight: 1.1, marginBottom: 'var(--space-4)' }}>{lesson?.title}</h1>
           <div style={{ display: 'flex', gap: 'var(--space-6)', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span>📚</span> {lesson?.course?.title || 'Archive'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span>⏱️</span> 12m Duration</div>
           </div>
        </header>

        {/* Video Integration */}
        {lesson?.video_url && <VideoEmbed url={lesson.video_url} thumbnail={lesson.video_thumbnail_url} />}

        {/* Content Flow */}
        <section className="lesson-markdown page-enter" style={{ fontSize: '18px', lineHeight: 1.8, color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson?.content || "") }} />

        {/* Action Nexus */}
        <footer style={{ marginTop: 'var(--space-20)', padding: 'var(--space-10)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
           <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, marginBottom: 'var(--space-4)' }}>{marked ? "Lesson Mastered." : "Conclude Sequence?"}</h2>
           <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-10)' }}>
              {marked ? "You have successfully integrated this intelligence unit. Review it anytime in your archive." : "Mark this unit as complete to synchronize your progress with the central ledger."}
           </p>
           <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
              {!marked && <button className="btn--primary" onClick={handleMarkComplete} style={{ padding: '0 var(--space-10)' }}>MARK AS COMPLETE</button>}
              <button className="btn--ghost" onClick={() => navigate(-1)}>{marked ? "BACK TO DASHBOARD" : "DEFER TO LATER"}</button>
           </div>
        </footer>

      </main>
      <BottomNav />
    </div>
  );
};

export default LessonPage;
