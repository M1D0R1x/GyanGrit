import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getCourseAllLessons, createLesson, updateLesson,
  getSectionLessons, createSectionLesson, updateSectionLesson, deleteSectionLesson,
  type LessonItem, type SectionLessonItem, type CreateLessonPayload, type CreateSectionLessonPayload,
} from "../services/content";
import { uploadFile, extractYouTubeId, getYouTubeThumbnail } from "../services/media";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";
import './AdminLessonEditorPage.css';

// SVG Icons to replace lucide-react
const SvgPlay = ({ size=24, color="currentColor", fill="none", ...props }: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={fill === "none" ? color : "none"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="5 3 19 12 5 21 5 3"/></svg>);
const SvgFileText = ({ size=24, color="currentColor", ...props }: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>);
const SvgGlobe = ({ size=24, color="currentColor", ...props }: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>);
const SvgLock = ({ size=24, color="currentColor", ...props }: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
const SvgChevronLeft = ({ size=24, color="currentColor", ...props }: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="15 18 9 12 15 6"/></svg>);
const SvgArrowRight = ({ size=24, color="currentColor", ...props }: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>);
const SvgMonitorPlay = ({ size=24, color="currentColor", ...props }: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><polygon points="10 7.5 15 10 10 12.5 10 7.5"/></svg>);
const SvgClapperboard = ({ size=24, color="currentColor", ...props }: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><line x1="6.2" y1="5.3" x2="3.1" y2="14"/><line x1="13" y1="3.3" x2="10" y2="12"/><line x1="19.8" y1="1.3" x2="16.7" y2="10"/><path d="m3.3 14 17.7 5.2c1.1.3 2.2-.3 2.5-1.3l.9-2.4"/></svg>);
const SvgDatabase = ({ size=24, color="currentColor", ...props }: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>);
const SvgPlus = ({ size=24, color="currentColor", ...props }: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);

type EditorMode = "list" | "create" | "edit";
type VideoInputMode = "url" | "upload";
type ActiveTab = "curriculum" | "section";

// ── Video preview ─────────────────────────────────────────────────────────────
const VideoPreview: React.FC<{ url: string; thumbnail?: string | null }> = ({ url, thumbnail }) => {
  const ytId = extractYouTubeId(url);
  if (ytId) {
    return (
      <div className="glass-card" style={{ position: 'relative', overflow: 'hidden', padding: 0 }}>
        <img src={thumbnail || getYouTubeThumbnail(ytId)} alt="Thumbnail" style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
           <SvgPlay fill="white" size={32} />
        </div>
      </div>
    );
  }
  return (
    <div className="glass-card" style={{ padding: '12px', fontSize: '12px', color: 'var(--text-dim)' }}>
       HOSTED CDN: <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)' }}>{url.slice(0, 30)}...</a>
    </div>
  );
};

// ── PDF upload zone ───────────────────────────────────────────────────────────
const FileUploadZone: React.FC<{ onUpload:(url:string)=>void; label:string; currentUrl?:string|null; folder:"pdfs"|"videos" }> = ({ onUpload, label, currentUrl, folder }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string|null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true); setError(null); setProgress(0);
    try {
      const result = await uploadFile(file, folder, undefined, setProgress);
      onUpload(result.url);
    } catch { setError("TELEMETRY UPLOAD ERROR"); }
    finally { setUploading(false); }
  };

  return (
    <div className="studio-upload-nexus" onClick={()=>!uploading && inputRef.current?.click()}>
       {uploading ? (
         <div className="progress-nexus">
            <span className="inst-label">UPLOADING... {progress}%</span>
            <div className="telemetry-bar"><div className="telemetry-inner" style={{ width: `${progress}%` }} /></div>
         </div>
       ) : (
         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {folder === "videos" ? <SvgClapperboard size={32} color="var(--text-dim)" /> : <SvgFileText size={32} color="var(--text-dim)" />}
            <span className="inst-label" style={{ margin: 0 }}>{label}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>DRAG & DROP OR SYNC</span>
         </div>
       )}
       <input ref={inputRef} type="file" accept={folder==='videos'?'video/mp4,video/webm':'.pdf'} style={{ display: 'none' }} onChange={e => {
         const f = e.target.files?.[0];
         if(f) {
           if (folder === 'videos' && f.size > 500 * 1024 * 1024) {
             setError("Video must be under 500MB.");
             return;
           }
           handleFile(f);
         }
       }} />
       {currentUrl && !uploading && <div className="inst-label" style={{ color: 'var(--role-student)', marginTop: '8px' }}>✓ SYNCED</div>}
       {error && <div className="stat-lbl" style={{ color: 'var(--error)', marginTop: '4px' }}>{error}</div>}
    </div>
  );
};

// ── Lesson form (shared between curriculum + section tabs) ────────────────────
const LessonForm: React.FC<any> = (props) => {
  return (
    <div className="studio-editor animate-fade-up">
       <div className="modal-header-nexus">
          <div className="inst-label">STUDIO EDITOR</div>
          <h2 className="modal-title">{props.mode === "create" ? "NEW CURRICULUM NODE" : `REDACT: ${props.editingTitle}`}</h2>
       </div>

       <div className="curriculum-form" style={{ marginTop: 'var(--space-8)' }}>
          <div className="obsidian-form-group">
             <label className="obsidian-label">LESSON TITLE *</label>
             <input className="obsidian-input" value={props.title} onChange={e=>props.setTitle(e.target.value)} placeholder="e.g. Fundamental Logic Gates" />
          </div>

          <div className="obsidian-form-group">
             <label className="obsidian-label">MARKDOWN CONTENT</label>
             <textarea className="obsidian-textarea" rows={10} value={props.content} onChange={e=>props.setContent(e.target.value)} placeholder="# Content Architecture..." />
          </div>

          <div className="obsidian-form-group">
             <label className="obsidian-label">VIDEO TELEMETRY</label>
             <div className="video-input-toggle">
                <button className={`video-toggle-btn ${props.videoInputMode==="url"?'active':''}`} onClick={()=>props.setVideoInputMode("url")}>EXTERNAL URL</button>
                <button className={`video-toggle-btn ${props.videoInputMode==="upload"?'active':''}`} onClick={()=>props.setVideoInputMode("upload")}>CDN UPLOAD</button>
             </div>
             {props.videoInputMode === "url" ? (
               <input className="obsidian-input" value={props.videoUrl} onChange={e=>props.setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." />
             ) : (
               <FileUploadZone folder="videos" label="CDN VIDEO UPLOAD" currentUrl={props.videoUrl} onUpload={props.setVideoUrl} />
             )}
             {props.videoUrl && (
               <>
                 <VideoPreview url={props.videoUrl} thumbnail={props.videoThumbnail} />
                 {props.videoInputMode === "url" && (
                   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
                     <input className="obsidian-input" value={props.videoThumbnail} onChange={e=>props.setVideoThumbnail(e.target.value)} placeholder="Custom Thumbnail URL" style={{ fontSize: '12px' }} />
                     <input className="obsidian-input" value={props.videoDuration} onChange={e=>props.setVideoDuration(e.target.value)} placeholder="Duration (e.g. 12:34)" style={{ fontSize: '12px' }} />
                   </div>
                 )}
               </>
             )}
          </div>

          <div className="obsidian-form-group">
             <label className="obsidian-label">PDF DOCUMENT METRICS</label>
             <FileUploadZone folder="pdfs" label="PDF DOCUMENT UPLOAD (MAX 50MB)" currentUrl={props.pdfUrl} onUpload={props.setPdfUrl} />
             {props.pdfUrl && <input className="obsidian-input" value={props.pdfUrl} onChange={e=>props.setPdfUrl(e.target.value)} placeholder="PDF URL" style={{ marginTop: 'var(--space-2)' }} />}
          </div>

          {props.showPublishToggle && (
            <div className="glass-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
               <div>
                  <div className="inst-label" style={{ margin: 0 }}>VISIBILITY STATUS</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{props.isPublished ? "Visible to global student nodes" : "Internal draft scope"}</div>
               </div>
               <button className={`btn--${props.isPublished ? 'success' : 'ghost'} sm`} onClick={()=>props.setIsPublished(!props.isPublished)}>
                  {props.isPublished?<SvgGlobe size={14}/>:<SvgLock size={14}/>} {props.isPublished?"PUBLISHED":"DRAFT"}
               </button>
            </div>
          )}

          <div className="mgmt-actions" style={{ gap: '12px' }}>
             <button className="btn--primary" style={{ flex: 1 }} onClick={props.onSave} disabled={props.saving}>{props.saving ? "SYNCING..." : (props.mode === "create" ? "CREATE NODE" : "SAVE REDACTION")}</button>
             <button className="btn--secondary" onClick={props.onCancel} disabled={props.saving}>ABORT</button>
          </div>
       </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const AdminLessonEditorPage: React.FC = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role ?? "ADMIN";
  // ADMIN sees only curriculum tab. TEACHER/PRINCIPAL see both.
  const showSectionTab = role === "TEACHER" || role === "PRINCIPAL";
  const [activeTab, setActiveTab] = useState<ActiveTab>("curriculum");

  // ── Curriculum lessons state ──────────────────────────────────────────────
  const [mode, setMode] = useState<EditorMode>("list");
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLesson, setEditing] = useState<LessonItem | null>(null);

  // ── Section lessons state ─────────────────────────────────────────────────
  const [sectionMode, setSectionMode] = useState<EditorMode>("list");
  const [sectionLessons, setSectionLessons] = useState<SectionLessonItem[]>([]);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionSaving, setSectionSaving] = useState(false);
  const [editingSectionLesson, setEditingSection] = useState<SectionLessonItem | null>(null);

  // ── Shared form state (used by both tabs via LessonForm) ──────────────────
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoThumbnail, setVideoThumbnail] = useState("");
  const [videoDuration, setVideoDuration] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [videoInputMode, setVideoInputMode] = useState<VideoInputMode>("url");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const numCourseId = Number(courseId);

  // Load curriculum lessons on mount
  useEffect(() => {
    if(!courseId) return;
    getCourseAllLessons(numCourseId).then(setLessons).catch(()=>setError("Protocol failure loading curriculum nodes.")).finally(()=>setLoading(false));
  }, [courseId, numCourseId]);

  // Load section lessons when tab is opened
  useEffect(() => {
    if(activeTab !== "section" || !courseId || !showSectionTab) return;
    setSectionLoading(true);
    getSectionLessons(numCourseId).then(setSectionLessons).catch(()=>setError("Protocol failure loading localized nodes.")).finally(()=>setSectionLoading(false));
  }, [activeTab, courseId, numCourseId, showSectionTab]);

  const resetForm = () => {
    setTitle(""); setContent(""); setVideoUrl(""); setVideoThumbnail(""); setVideoDuration(""); setPdfUrl(""); setIsPublished(false); setVideoInputMode("url"); setEditing(null); setEditingSection(null);
  };

  // ── Curriculum handlers ───────────────────────────────────────────────────

  const handleSave = async () => {
    if(!title.trim()) { setError("Title Protocol required."); return; }
    setSaving(true);
    const payload: CreateLessonPayload = { title: title.trim(), content, video_url: videoUrl||undefined, video_thumbnail_url: videoThumbnail||undefined, video_duration: videoDuration||undefined, pdf_url: pdfUrl||undefined, is_published: isPublished };
    try {
      if(mode==="create") { const res = await createLesson(numCourseId, payload); setLessons(p=>[...p, res]); }
      else if(editingLesson) { const res = await updateLesson(editingLesson.id, payload); setLessons(p=>p.map(l=>l.id===editingLesson.id?{...l, ...res, content: payload.content}:l)); }
      setMode("list"); resetForm(); setSuccess("GLOBAL TRANSMISSION COMPLETE");
    } catch { setError("Transmission failure."); } finally { setSaving(false); }
  };

  // ── Section lesson handlers ───────────────────────────────────────────────

  const handleSectionSave = async () => {
    if(!title.trim()) { setError("Title Protocol required."); return; }
    setSectionSaving(true);
    const payload: CreateSectionLessonPayload = { title: title.trim(), content, video_url: videoUrl||undefined, video_thumbnail_url: videoThumbnail||undefined, pdf_url: pdfUrl||undefined, is_published: isPublished };
    try {
      if(sectionMode==="create") { const res = await createSectionLesson(numCourseId, payload); setSectionLessons(p=>[...p, res]); }
      else if(editingSectionLesson) { const res = await updateSectionLesson(editingSectionLesson.id, payload); setSectionLessons(p=>p.map(l=>l.id===editingSectionLesson.id?{...l, ...res}:l)); }
      setSectionMode("list"); resetForm(); setSuccess("LOCALIZED TRANSMISSION COMPLETE");
    } catch { setError("Transmission failure."); } finally { setSectionSaving(false); }
  };

  // ── Derived flags ─────────────────────────────────────────────────────────
  const currentIsInForm = activeTab === "curriculum" ? mode !== "list" : sectionMode !== "list";

  if (loading) return <div className="page-shell"><TopBar title="Studio Terminal" /><main className="page-content"><div className="skeleton-box" style={{ height: '400px' }} /></main></div>;

  return (
    <div className="page-shell">
      <TopBar title="Content Studio" />
      <main className="page-content page-enter studio-layout">
        <button className="btn--ghost sm" onClick={()=>{if(currentIsInForm){ if(activeTab==="curriculum"){setMode("list");resetForm();} else {setSectionMode("list");resetForm();}} else navigate(-1); }} style={{ marginBottom: 'var(--space-6)' }}><SvgChevronLeft size={16} /> {currentIsInForm ? "STUDIO INDEX" : "BACK TO COURSE"}</button>
        {error && <div className="alert alert--error animate-fade-up">{error}</div>}
        {success && <div className="alert alert--success animate-fade-up">{success}</div>}

        {/* ── Tab toggle — only for TEACHER/PRINCIPAL ── */}
        {!currentIsInForm && showSectionTab && (
          <div className="studio-tabs animate-fade-up">
             <button className={`studio-tab-btn ${activeTab==="curriculum"?'active':''}`} onClick={()=>{setActiveTab("curriculum");setError(null);setSuccess(null);}}>GLOBAL CURRICULUM</button>
             <button className={`studio-tab-btn ${activeTab==="section"?'active':''}`} onClick={()=>{setActiveTab("section");setError(null);setSuccess(null);}}>SECTION LOCALIZED</button>
          </div>
        )}

        {/* CURRICULUM TAB */}
        {activeTab === "curriculum" && mode === "list" && (
          <section className="studio-index animate-fade-up">
             <div className="nexus-header-text" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><SvgDatabase size={14} color="var(--brand-primary)" /> GLOBAL ASSET REGISTRY</h2>
                <button className="btn--primary sm" onClick={()=>{resetForm();setMode("create");}}><SvgPlus size={14} /> NEW NODE</button>
             </div>
             {lessons.length === 0 ? (
               <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}><div style={{ fontSize: '32px', marginBottom: 'var(--space-4)' }}>📝</div><div className="inst-label">EMPTY ASSET REGISTRY</div><p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Provision global curriculum nodes to begin.</p></div>
             ) : (
                <div className="studio-card-stack">
                   {lessons.map(l => (
                     <div key={l.id} className="glass-card lesson-studio-card" onClick={()=>{
                       setEditing(l); setTitle(l.title); setContent(l.content??""); setVideoUrl(l.video_url??""); setVideoThumbnail(l.video_thumbnail_url??""); setVideoDuration(l.video_duration??""); setPdfUrl(l.pdf_url??""); setIsPublished(l.is_published); setVideoInputMode(l.video_url&&l.video_url.includes("r2")?"upload":"url"); setMode("edit");
                     }}>
                        <div className="user-avatar-init" style={{ background: l.is_published ? 'var(--role-student-glow)' : 'var(--bg-elevated)' }}>{l.video_url ? <SvgMonitorPlay size={16} color={l.is_published?'var(--role-student)':'var(--text-dim)'} /> : <SvgFileText size={16} color={l.is_published?'var(--role-student)':'var(--text-dim)'} />}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                           <div className="student-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.order}. {l.title}</div>
                           <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              {l.has_text && <span className="stat-lbl" style={{ color: 'var(--info)' }}>MARKDOWN</span>}
                              {l.has_video && <span className="stat-lbl" style={{ color: 'var(--role-student)' }}>TELEMETRY</span>}
                              {l.has_pdf && <span className="stat-lbl" style={{ color: 'var(--warning)' }}>PDF</span>}
                              <span className="stat-lbl" style={{ marginLeft: 'auto', color: l.is_published ? 'var(--role-student)' : 'var(--text-dim)' }}>{l.is_published ? "PUBLISHED GLOBAL" : "DRAFT MODE"}</span>
                           </div>
                        </div>
                        <SvgArrowRight size={16} color="var(--text-dim)" />
                     </div>
                   ))}
                </div>
             )}
          </section>
        )}

        {(activeTab === "curriculum" && mode !== "list") && <LessonForm mode={mode} editingTitle={editingLesson?.title} title={title} setTitle={setTitle} content={content} setContent={setContent} videoUrl={videoUrl} setVideoUrl={setVideoUrl} videoThumbnail={videoThumbnail} setVideoThumbnail={setVideoThumbnail} videoDuration={videoDuration} setVideoDuration={setVideoDuration} pdfUrl={pdfUrl} setPdfUrl={setPdfUrl} isPublished={isPublished} setIsPublished={setIsPublished} showPublishToggle={true} videoInputMode={videoInputMode} setVideoInputMode={setVideoInputMode} saving={saving} onSave={handleSave} onCancel={()=>{setMode("list");resetForm();}} />}

        {/* SECTION TAB */}
        {activeTab === "section" && sectionMode === "list" && (
           <section className="studio-index animate-fade-up">
              <div className="nexus-header-text" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                 <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><SvgDatabase size={14} color="var(--brand-secondary)" /> LOCALIZED SECTION NODES</h2>
                 <button className="btn--primary sm" onClick={()=>{resetForm();setSectionMode("create");}}><SvgPlus size={14} /> NEW NODE</button>
              </div>
              {sectionLoading ? <div className="skeleton-box" style={{ height: '300px' }} /> : sectionLessons.length === 0 ? (
               <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}><div style={{ fontSize: '32px', marginBottom: 'var(--space-4)' }}>✏️</div><div className="inst-label">EMPTY LOCALIZED REGISTRY</div><p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Provision supplemental nodes strictly visible to your authenticated localized sector.</p></div>
              ) : (
                <div className="studio-card-stack">
                   {sectionLessons.map(sl => (
                     <div key={sl.id} className="glass-card lesson-studio-card">
                        <div className="user-avatar-init" style={{ background: 'var(--brand-secondary-glow)' }}><span style={{ fontSize: '12px', color: 'var(--brand-secondary)', fontWeight: 800 }}>{sl.order || "—"}</span></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                           <div className="student-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sl.title}</div>
                           <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              {sl.has_content && <span className="stat-lbl" style={{ color: 'var(--info)' }}>MARKDOWN</span>}
                              {sl.has_video && <span className="stat-lbl" style={{ color: 'var(--role-student)' }}>TELEMETRY</span>}
                              {sl.has_pdf && <span className="stat-lbl" style={{ color: 'var(--warning)' }}>PDF</span>}
                              <span className="stat-lbl" style={{ marginLeft: 'auto', color: sl.is_published ? 'var(--brand-secondary)' : 'var(--text-dim)' }}>{sl.is_published ? "VISIBLE" : "HIDDEN"}</span>
                           </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                           <button className="btn--secondary sm" onClick={()=>{setEditingSection(sl);setTitle(sl.title);setContent("");setVideoUrl("");setVideoThumbnail("");setVideoDuration("");setPdfUrl("");setIsPublished(sl.is_published);setVideoInputMode("url");setSectionMode("edit");}}>EDIT</button>
                           <button className="btn--ghost sm" onClick={async ()=>{if(!confirm(`Delete "${sl.title}"? This cannot be undone.`)) return; try{await deleteSectionLesson(sl.id);setSectionLessons(p=>p.filter(l=>l.id!==sl.id));setSuccess("LOCALIZED NODE PURGED.");}catch{setError("Failed to purge node.");}}} style={{ color: 'var(--error)' }}>PURGE</button>
                        </div>
                     </div>
                   ))}
                </div>
              )}
           </section>
        )}
        {(activeTab === "section" && sectionMode !== "list") && <LessonForm mode={sectionMode} editingTitle={editingSectionLesson?.title} title={title} setTitle={setTitle} content={content} setContent={setContent} videoUrl={videoUrl} setVideoUrl={setVideoUrl} videoThumbnail={videoThumbnail} setVideoThumbnail={setVideoThumbnail} videoDuration={videoDuration} setVideoDuration={setVideoDuration} pdfUrl={pdfUrl} setPdfUrl={setPdfUrl} isPublished={isPublished} setIsPublished={setIsPublished} showPublishToggle={false} videoInputMode={videoInputMode} setVideoInputMode={setVideoInputMode} saving={sectionSaving} onSave={handleSectionSave} onCancel={()=>{setSectionMode("list");resetForm();}} />}
      </main>
    </div>
  );
};
export default AdminLessonEditorPage;
