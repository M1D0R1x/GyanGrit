import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getCourseAllLessons,
  createLesson,
  updateLesson,
  getSectionLessons,
  createSectionLesson,
  updateSectionLesson,
  deleteSectionLesson,
  type LessonItem,
  type SectionLessonItem,
  type CreateLessonPayload,
  type CreateSectionLessonPayload,
} from "../services/content";
import { uploadFile, extractYouTubeId, getYouTubeThumbnail } from "../services/media";
import { useAuth } from "../auth/AuthContext";

type EditorMode   = "list" | "create" | "edit";
type VideoInputMode = "url" | "upload";
type ActiveTab    = "curriculum" | "section";

// ── Video preview ─────────────────────────────────────────────────────────────

function VideoPreview({
  url,
  thumbnail,
  duration,
}: {
  url: string;
  thumbnail?: string | null;
  duration?: string;
}) {
  const ytId = extractYouTubeId(url);

  if (ytId) {
    return (
      <div style={{ position: "relative", marginTop: "var(--space-4)" }}>
        <img
          src={thumbnail || getYouTubeThumbnail(ytId)}
          alt="Video thumbnail"
          style={{
            width: "100%",
            maxHeight: 200,
            objectFit: "cover",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-light)",
          }}
        />
        {duration && (
          <span style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            background: "rgba(0,0,0,0.8)",
            color: "white",
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 4,
            fontFamily: "var(--font-display)",
          }}>
            {duration}
          </span>
        )}
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "rgba(255,0,0,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: "var(--space-4)",
      padding: "var(--space-4)",
      background: "var(--bg-elevated)",
      borderRadius: "var(--radius-md)",
      border: "1px solid var(--border-light)",
      fontSize: "var(--text-sm)",
      color: "var(--ink-secondary)",
    }}>
      Video URL:{" "}
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{ color: "var(--saffron)" }}>
        {url}
      </a>
    </div>
  );
}

// ── PDF upload zone ───────────────────────────────────────────────────────────

function FileUploadZone({
  onUpload,
  accept,
  label,
  currentUrl,
  folder,
}: {
  onUpload: (url: string) => void;
  accept: string;
  label: string;
  currentUrl?: string | null;
  folder: "pdfs" | "images";
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [error, setError]         = useState<string | null>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const result = await uploadFile(file, folder, undefined, setProgress);
      onUpload(result.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        style={{
          border: `2px dashed ${uploading ? "var(--saffron)" : "var(--border-medium)"}`,
          borderRadius: "var(--radius-md)",
          padding: "var(--space-6)",
          textAlign: "center",
          cursor: uploading ? "not-allowed" : "pointer",
          transition: "all var(--transition-fast)",
          background: uploading ? "var(--saffron-glow)" : "var(--bg-elevated)",
        }}
      >
        {uploading ? (
          <div>
            <div style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--saffron)" }}>
              Uploading… {progress}%
            </div>
            <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${progress}%`,
                background: "var(--saffron)",
                borderRadius: 2,
                transition: "width 0.1s",
              }} />
            </div>
          </div>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="var(--ink-muted)" strokeWidth="1.5" strokeLinecap="round"
              strokeLinejoin="round" style={{ marginBottom: "var(--space-2)" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-secondary)" }}>{label}</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
              Click or drag and drop
            </div>
          </>
        )}
      </div>

      <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {error && (
        <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--error)" }}>
          {error}
        </div>
      )}

      {currentUrl && !uploading && (
        <div style={{ marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-xs)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ color: "var(--success)" }}>Uploaded</span>
          <a href={currentUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--ink-muted)", textDecoration: "underline" }}>
            Preview
          </a>
        </div>
      )}
    </div>
  );
}

// ── Video upload zone (R2) ────────────────────────────────────────────────────

function VideoUploadZone({
  onUpload,
  currentUrl,
}: {
  onUpload: (url: string) => void;
  currentUrl?: string | null;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [error, setError]         = useState<string | null>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!["video/mp4", "video/webm"].includes(file.type)) {
      setError("Only MP4 and WebM videos are supported.");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError("Video must be under 500MB.");
      return;
    }
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const result = await uploadFile(file, "videos", undefined, setProgress);
      onUpload(result.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const isR2Url = currentUrl &&
    (currentUrl.includes("r2.dev") || currentUrl.includes("r2.cloudflarestorage.com"));

  return (
    <div>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        style={{
          border: `2px dashed ${uploading ? "var(--saffron)" : "var(--border-medium)"}`,
          borderRadius: "var(--radius-md)",
          padding: "var(--space-6)",
          textAlign: "center",
          cursor: uploading ? "not-allowed" : "pointer",
          background: uploading ? "var(--saffron-glow)" : "var(--bg-elevated)",
          transition: "all var(--transition-fast)",
        }}
      >
        {uploading ? (
          <div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--saffron)", marginBottom: "var(--space-2)", fontWeight: 600 }}>
              Uploading video… {progress}%
            </div>
            <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "var(--saffron)", borderRadius: 99, transition: "width 0.2s" }} />
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-2)" }}>
              Large files may take a moment. Do not close this page.
            </div>
          </div>
        ) : (
          <>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="var(--ink-muted)" strokeWidth="1.5" strokeLinecap="round"
              strokeLinejoin="round" style={{ marginBottom: "var(--space-3)" }}>
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-secondary)", fontWeight: 600 }}>
              Upload video to CDN
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
              MP4 or WebM · max 500MB · Click or drag and drop
            </div>
          </>
        )}
      </div>

      <input ref={inputRef} type="file" accept="video/mp4,video/webm" style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {error && (
        <div className="alert alert--error" style={{ marginTop: "var(--space-2)", marginBottom: 0 }}>
          {error}
        </div>
      )}

      {isR2Url && !uploading && (
        <div style={{ marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-xs)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ color: "var(--success)", fontWeight: 600 }}>Hosted on CDN</span>
          <a href={currentUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--ink-muted)", textDecoration: "underline" }}>
            Preview
          </a>
        </div>
      )}
    </div>
  );
}

// ── Lesson form (shared between curriculum + section tabs) ────────────────────

function LessonForm({
  mode,
  editingTitle,
  title, setTitle,
  content, setContent,
  videoUrl, setVideoUrl,
  videoThumbnail, setVideoThumbnail,
  videoDuration, setVideoDuration,
  pdfUrl, setPdfUrl,
  isPublished, setIsPublished,
  showPublishToggle,
  videoInputMode, setVideoInputMode,
  saving,
  onSave,
  onCancel,
}: {
  mode: EditorMode;
  editingTitle?: string;
  title: string; setTitle: (v: string) => void;
  content: string; setContent: (v: string) => void;
  videoUrl: string; setVideoUrl: (v: string) => void;
  videoThumbnail: string; setVideoThumbnail: (v: string) => void;
  videoDuration: string; setVideoDuration: (v: string) => void;
  pdfUrl: string; setPdfUrl: (v: string) => void;
  isPublished: boolean; setIsPublished: (v: boolean) => void;
  showPublishToggle: boolean;
  videoInputMode: VideoInputMode; setVideoInputMode: (v: VideoInputMode) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const handleVideoUrlChange = (url: string) => {
    setVideoUrl(url);
    const ytId = extractYouTubeId(url);
    if (ytId && !videoThumbnail) {
      setVideoThumbnail(getYouTubeThumbnail(ytId));
    }
  };

  return (
    <>
      <div className="section-header">
        <h2 className="section-header__title">
          {mode === "create" ? "New Lesson" : `Edit: ${editingTitle ?? ""}`}
        </h2>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="lesson-title">Lesson Title *</label>
        <input
          id="lesson-title"
          className="form-input"
          type="text"
          placeholder="e.g. Introduction to Algebra"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="lesson-content">
          Text Content
          <span style={{ color: "var(--ink-muted)", fontWeight: 400, marginLeft: "var(--space-2)" }}>
            (Markdown supported)
          </span>
        </label>
        <textarea
          id="lesson-content"
          className="form-input"
          placeholder={"# Lesson Title\n\nWrite your lesson content here.\n\n## Section 1\nContent..."}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          style={{ fontFamily: "var(--font-body)", resize: "vertical", minHeight: 200, lineHeight: 1.6 }}
        />
      </div>

      {/* Video */}
      <div className="form-group">
        <label className="form-label">Video</label>
        <div style={{
          display: "flex",
          marginBottom: "var(--space-3)",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}>
          {(["url", "upload"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setVideoInputMode(tab)}
              style={{
                flex: 1,
                padding: "var(--space-2) var(--space-3)",
                background: videoInputMode === tab ? "var(--saffron)" : "var(--bg-elevated)",
                border: "none",
                color: videoInputMode === tab ? "#fff" : "var(--ink-muted)",
                fontSize: "var(--text-xs)",
                fontWeight: videoInputMode === tab ? 700 : 400,
                cursor: "pointer",
                transition: "all var(--transition-fast)",
                fontFamily: "var(--font-body)",
              }}
            >
              {tab === "url" ? "Paste URL (YouTube / Vimeo)" : "Upload to CDN (R2)"}
            </button>
          ))}
        </div>

        {videoInputMode === "url" ? (
          <>
            <input
              className="form-input"
              type="url"
              placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
              value={videoUrl}
              onChange={(e) => handleVideoUrlChange(e.target.value)}
            />
            {videoUrl && (
              <>
                <VideoPreview url={videoUrl} thumbnail={videoThumbnail} duration={videoDuration} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
                  <div>
                    <label className="form-label" style={{ fontSize: "var(--text-xs)" }}>Thumbnail URL</label>
                    <input
                      className="form-input"
                      type="url"
                      placeholder="Auto-filled for YouTube"
                      value={videoThumbnail}
                      onChange={(e) => setVideoThumbnail(e.target.value)}
                      style={{ fontSize: "var(--text-sm)" }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: "var(--text-xs)" }}>Duration (e.g. 12:34)</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="12:34"
                      value={videoDuration}
                      onChange={(e) => setVideoDuration(e.target.value)}
                      style={{ fontSize: "var(--text-sm)" }}
                    />
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <VideoUploadZone
            currentUrl={videoUrl}
            onUpload={(url) => { setVideoUrl(url); setVideoThumbnail(""); }}
          />
        )}
      </div>

      {/* PDF */}
      <div className="form-group">
        <label className="form-label">PDF Document</label>
        <FileUploadZone
          accept=".pdf"
          label="Upload PDF (max 50MB)"
          folder="pdfs"
          currentUrl={pdfUrl}
          onUpload={(url) => setPdfUrl(url)}
        />
        {pdfUrl && (
          <input
            className="form-input"
            type="url"
            value={pdfUrl}
            onChange={(e) => setPdfUrl(e.target.value)}
            placeholder="Or paste PDF URL directly"
            style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)" }}
          />
        )}
      </div>

      {/* Publish toggle — only for curriculum lessons */}
      {showPublishToggle && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-4)",
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-light)",
          marginBottom: "var(--space-6)",
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--ink-primary)" }}>
              Publish lesson
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
              Published lessons are visible to enrolled students
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "var(--saffron)", cursor: "pointer" }}
            />
            <span style={{ fontSize: "var(--text-sm)", color: isPublished ? "var(--success)" : "var(--ink-muted)" }}>
              {isPublished ? "Published" : "Draft"}
            </span>
          </label>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button className="btn btn--primary" onClick={onSave} disabled={saving}>
          {saving
            ? <><span className="btn__spinner" aria-hidden="true" /> Saving…</>
            : mode === "create" ? "Create Lesson" : "Save Changes"}
        </button>
        <button className="btn btn--secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminLessonEditorPage() {
  const { courseId } = useParams();
  const navigate     = useNavigate();
  const { user }     = useAuth();

  const role = user?.role ?? "ADMIN";

  // ADMIN sees only curriculum tab. TEACHER/PRINCIPAL see both.
  const showSectionTab = role === "TEACHER" || role === "PRINCIPAL";
  const [activeTab, setActiveTab] = useState<ActiveTab>("curriculum");

  // ── Curriculum lessons state ──────────────────────────────────────────────
  const [mode, setMode]             = useState<EditorMode>("list");
  const [lessons, setLessons]       = useState<LessonItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [editingLesson, setEditing] = useState<LessonItem | null>(null);

  // ── Section lessons state ─────────────────────────────────────────────────
  const [sectionMode, setSectionMode]         = useState<EditorMode>("list");
  const [sectionLessons, setSectionLessons]   = useState<SectionLessonItem[]>([]);
  const [sectionLoading, setSectionLoading]   = useState(false);
  const [sectionSaving, setSectionSaving]     = useState(false);
  const [editingSectionLesson, setEditingSection] = useState<SectionLessonItem | null>(null);

  // ── Shared form state (used by both tabs via LessonForm) ──────────────────
  const [title, setTitle]                   = useState("");
  const [content, setContent]               = useState("");
  const [videoUrl, setVideoUrl]             = useState("");
  const [videoThumbnail, setVideoThumbnail] = useState("");
  const [videoDuration, setVideoDuration]   = useState("");
  const [pdfUrl, setPdfUrl]                 = useState("");
  const [isPublished, setIsPublished]       = useState(false);
  const [videoInputMode, setVideoInputMode] = useState<VideoInputMode>("url");

  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const numericCourseId = Number(courseId);

  // Load curriculum lessons on mount
  useEffect(() => {
    if (!courseId) return;
    getCourseAllLessons(numericCourseId)
      .then(setLessons)
      .catch(() => setError("Failed to load lessons."))
      .finally(() => setLoading(false));
  }, [courseId, numericCourseId]);

  // Load section lessons when tab is opened
  useEffect(() => {
    if (activeTab !== "section" || !courseId || !showSectionTab) return;
    setSectionLoading(true);
    getSectionLessons(numericCourseId)
      .then(setSectionLessons)
      .catch(() => setError("Failed to load section lessons."))
      .finally(() => setSectionLoading(false));
  }, [activeTab, courseId, numericCourseId, showSectionTab]);

  const resetForm = () => {
    setTitle(""); setContent(""); setVideoUrl("");
    setVideoThumbnail(""); setVideoDuration(""); setPdfUrl("");
    setIsPublished(false); setVideoInputMode("url");
    setEditing(null); setEditingSection(null);
  };

  // ── Curriculum handlers ───────────────────────────────────────────────────

  const openCreate = () => { resetForm(); setMode("create"); };

  const openEdit = (lesson: LessonItem) => {
    setTitle(lesson.title);
    setContent(lesson.content ?? "");
    setVideoUrl(lesson.video_url ?? "");
    setVideoThumbnail(lesson.video_thumbnail_url ?? "");
    setVideoDuration(lesson.video_duration ?? "");
    setPdfUrl(lesson.pdf_url ?? "");
    setIsPublished(lesson.is_published);
    const isR2 = !!lesson.video_url && (
      lesson.video_url.includes("r2.dev") ||
      lesson.video_url.includes("r2.cloudflarestorage.com")
    );
    setVideoInputMode(isR2 ? "upload" : "url");
    setEditing(lesson);
    setMode("edit");
  };

  const handleSave = async () => {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true); setError(null); setSuccess(null);

    const payload: CreateLessonPayload = {
      title: title.trim(), content,
      video_url: videoUrl || undefined,
      video_thumbnail_url: videoThumbnail || undefined,
      video_duration: videoDuration || undefined,
      pdf_url: pdfUrl || undefined,
      is_published: isPublished,
    };

    try {
      if (mode === "create") {
        const newLesson = await createLesson(numericCourseId, payload);
        setLessons((prev) => [...prev, newLesson]);
        setSuccess("Lesson created.");
      } else if (mode === "edit" && editingLesson) {
        const updated = await updateLesson(editingLesson.id, payload);
        setLessons((prev) =>
          prev.map((l) => l.id === editingLesson.id ? { ...l, ...updated, content: payload.content } : l)
        );
        setSuccess("Lesson updated.");
      }
      setMode("list"); resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (lesson: LessonItem) => {
    try {
      await updateLesson(lesson.id, { is_published: !lesson.is_published });
      setLessons((prev) => prev.map((l) =>
        l.id === lesson.id ? { ...l, is_published: !l.is_published } : l
      ));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update lesson.");
    }
  };

  // ── Section lesson handlers ───────────────────────────────────────────────

  const openSectionCreate = () => { resetForm(); setSectionMode("create"); };

  const openSectionEdit = (sl: SectionLessonItem) => {
    setTitle(sl.title);
    setContent(""); // section lesson detail not loaded in list — blank content on edit
    setVideoUrl(""); setVideoThumbnail(""); setVideoDuration(""); setPdfUrl("");
    setIsPublished(sl.is_published);
    setVideoInputMode("url");
    setEditingSection(sl);
    setSectionMode("edit");
  };

  const handleSectionSave = async () => {
    if (!title.trim()) { setError("Title is required."); return; }
    setSectionSaving(true); setError(null); setSuccess(null);

    const payload: CreateSectionLessonPayload = {
      title: title.trim(), content,
      video_url: videoUrl || undefined,
      video_thumbnail_url: videoThumbnail || undefined,
      pdf_url: pdfUrl || undefined,
      is_published: isPublished,
    };

    try {
      if (sectionMode === "create") {
        const created = await createSectionLesson(numericCourseId, payload);
        setSectionLessons((prev) => [...prev, created]);
        setSuccess("Section lesson created — visible to your students.");
      } else if (sectionMode === "edit" && editingSectionLesson) {
        const updated = await updateSectionLesson(editingSectionLesson.id, payload);
        setSectionLessons((prev) =>
          prev.map((l) => l.id === editingSectionLesson.id ? { ...l, ...updated } : l)
        );
        setSuccess("Section lesson updated.");
      }
      setSectionMode("list"); resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSectionSaving(false);
    }
  };

  const handleSectionDelete = async (sl: SectionLessonItem) => {
    if (!confirm(`Delete "${sl.title}"? This cannot be undone.`)) return;
    try {
      await deleteSectionLesson(sl.id);
      setSectionLessons((prev) => prev.filter((l) => l.id !== sl.id));
      setSuccess("Section lesson deleted.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
    }
  };

  // ── Derived flags ─────────────────────────────────────────────────────────
  const isInForm = (activeTab === "curriculum" && mode !== "list") ||
                   (activeTab === "section" && sectionMode !== "list");

  return (
    <>

        <button
          className="back-btn"
          onClick={() => {
            if (isInForm) {
              if (activeTab === "curriculum") { setMode("list"); resetForm(); }
              else { setSectionMode("list"); resetForm(); }
            } else {
              navigate(-1);
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {isInForm ? "Back to Lessons" : "Back"}
        </button>

        {error   && <div className="alert alert--error">{error}</div>}
        {success && <div className="alert alert--success">{success}</div>}

        {/* ── Tab toggle — only for TEACHER/PRINCIPAL ── */}
        {showSectionTab && !isInForm && (
          <div style={{
            display: "flex",
            marginBottom: "var(--space-6)",
            border: "1px solid var(--border-medium)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
          }}>
            {(["curriculum", "section"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setError(null);
                  setSuccess(null);
                }}
                style={{
                  flex: 1,
                  padding: "var(--space-3)",
                  background: activeTab === tab ? "var(--saffron)" : "var(--bg-elevated)",
                  border: "none",
                  color: activeTab === tab ? "#fff" : "var(--ink-muted)",
                  fontSize: "var(--text-sm)",
                  fontWeight: activeTab === tab ? 700 : 400,
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {tab === "curriculum" ? "Curriculum Lessons" : "My Added Lessons"}
              </button>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* CURRICULUM TAB                                                  */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "curriculum" && (
          <>
            {mode === "list" && (
              <>
                <div className="section-header">
                  <h2 className="section-header__title">Curriculum Lessons</h2>
                  <button className="btn btn--primary" onClick={openCreate}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Lesson
                  </button>
                </div>

                {loading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="skeleton" style={{ height: 64, borderRadius: "var(--radius-md)" }} />
                    ))}
                  </div>
                ) : lessons.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state__icon">📝</div>
                    <h3 className="empty-state__title">No lessons yet</h3>
                    <p className="empty-state__message">Add your first lesson to this course.</p>
                    <button className="btn btn--primary" onClick={openCreate}>Add First Lesson</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {lessons.map((lesson, i) => (
                      <div key={lesson.id} className="card page-enter"
                        style={{ animationDelay: `${i * 40}ms`, padding: "var(--space-4)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "var(--radius-sm)",
                            background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "var(--font-display)", fontWeight: 700,
                            fontSize: "var(--text-sm)", color: "var(--ink-muted)", flexShrink: 0,
                          }}>
                            {lesson.order}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600, color: "var(--ink-primary)", fontSize: "var(--text-sm)",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>
                              {lesson.title}
                            </div>
                            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-1)", flexWrap: "wrap" }}>
                              {lesson.has_text  && <span className="badge badge--info"    style={{ fontSize: 10 }}>Text</span>}
                              {lesson.has_video && <span className="badge badge--success" style={{ fontSize: 10 }}>Video</span>}
                              {lesson.has_pdf   && <span className="badge badge--warning" style={{ fontSize: 10 }}>PDF</span>}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                            <button className="btn btn--ghost"
                              style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-xs)" }}
                              onClick={() => void handleTogglePublish(lesson)}>
                              {lesson.is_published
                                ? <span style={{ color: "var(--success)" }}>Published</span>
                                : <span style={{ color: "var(--ink-muted)" }}>Draft</span>}
                            </button>
                            <button className="btn btn--secondary"
                              style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-xs)" }}
                              onClick={() => openEdit(lesson)}>
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {(mode === "create" || mode === "edit") && (
              <LessonForm
                mode={mode}
                editingTitle={editingLesson?.title}
                title={title} setTitle={setTitle}
                content={content} setContent={setContent}
                videoUrl={videoUrl} setVideoUrl={setVideoUrl}
                videoThumbnail={videoThumbnail} setVideoThumbnail={setVideoThumbnail}
                videoDuration={videoDuration} setVideoDuration={setVideoDuration}
                pdfUrl={pdfUrl} setPdfUrl={setPdfUrl}
                isPublished={isPublished} setIsPublished={setIsPublished}
                showPublishToggle={true}
                videoInputMode={videoInputMode} setVideoInputMode={setVideoInputMode}
                saving={saving}
                onSave={() => void handleSave()}
                onCancel={() => { setMode("list"); resetForm(); }}
              />
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION TAB — teacher/principal only                           */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "section" && showSectionTab && (
          <>
            {sectionMode === "list" && (
              <>
                <div className="section-header">
                  <div>
                    <h2 className="section-header__title">My Added Lessons</h2>
                    <p className="section-header__subtitle" style={{ marginTop: "var(--space-1)" }}>
                      Supplemental lessons visible only to your students
                    </p>
                  </div>
                  <button className="btn btn--primary" onClick={openSectionCreate}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Lesson
                  </button>
                </div>

                {sectionLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="skeleton" style={{ height: 64, borderRadius: "var(--radius-md)" }} />
                    ))}
                  </div>
                ) : sectionLessons.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state__icon">✏️</div>
                    <h3 className="empty-state__title">No supplemental lessons yet</h3>
                    <p className="empty-state__message">
                      Add lessons here to give your students extra content beyond the curriculum.
                    </p>
                    <button className="btn btn--primary" onClick={openSectionCreate}>
                      Add First Lesson
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {sectionLessons.map((sl, i) => (
                      <div key={sl.id} className="card page-enter"
                        style={{ animationDelay: `${i * 40}ms`, padding: "var(--space-4)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "var(--radius-sm)",
                            background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "var(--font-display)", fontWeight: 700,
                            fontSize: "var(--text-xs)", color: "var(--saffron)", flexShrink: 0,
                          }}>
                            {sl.order || "—"}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600, color: "var(--ink-primary)", fontSize: "var(--text-sm)",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>
                              {sl.title}
                            </div>
                            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-1)", flexWrap: "wrap" }}>
                              {sl.has_content && <span className="badge badge--info"    style={{ fontSize: 10 }}>Text</span>}
                              {sl.has_video   && <span className="badge badge--success" style={{ fontSize: 10 }}>Video</span>}
                              {sl.has_pdf     && <span className="badge badge--warning" style={{ fontSize: 10 }}>PDF</span>}
                              <span style={{
                                fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                                letterSpacing: "0.06em", color: "var(--saffron)",
                                background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                                borderRadius: "var(--radius-full)", padding: "1px 6px",
                              }}>
                                {sl.is_published ? "Visible" : "Hidden"}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                            <button className="btn btn--secondary"
                              style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-xs)" }}
                              onClick={() => openSectionEdit(sl)}>
                              Edit
                            </button>
                            <button className="btn btn--danger"
                              style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-xs)" }}
                              onClick={() => void handleSectionDelete(sl)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {(sectionMode === "create" || sectionMode === "edit") && (
              <LessonForm
                mode={sectionMode}
                editingTitle={editingSectionLesson?.title}
                title={title} setTitle={setTitle}
                content={content} setContent={setContent}
                videoUrl={videoUrl} setVideoUrl={setVideoUrl}
                videoThumbnail={videoThumbnail} setVideoThumbnail={setVideoThumbnail}
                videoDuration={videoDuration} setVideoDuration={setVideoDuration}
                pdfUrl={pdfUrl} setPdfUrl={setPdfUrl}
                isPublished={isPublished} setIsPublished={setIsPublished}
                showPublishToggle={false}
                videoInputMode={videoInputMode} setVideoInputMode={setVideoInputMode}
                saving={sectionSaving}
                onSave={() => void handleSectionSave()}
                onCancel={() => { setSectionMode("list"); resetForm(); }}
              />
            )}
          </>
        )}
    </>
  );
}