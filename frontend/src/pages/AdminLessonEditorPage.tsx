import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getCourseAllLessons,
  createLesson,
  updateLesson,
  type LessonItem,
  type CreateLessonPayload,
} from "../services/content";
import { uploadFile, extractYouTubeId, getYouTubeThumbnail } from "../services/media";
import TopBar from "../components/TopBar";

type EditorMode = "list" | "create" | "edit";

// ── Video preview ────────────────────────────────────────────────────────────

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
            border: "1px solid var(--border-subtle)",
          }}
        />
        {duration && (
          <span
            style={{
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
            }}
          >
            {duration}
          </span>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(255,0,0,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: "var(--space-4)",
        padding: "var(--space-4)",
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
        fontSize: "var(--text-sm)",
        color: "var(--text-secondary)",
      }}
    >
      Video URL:{" "}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--brand-primary)" }}
      >
        {url}
      </a>
    </div>
  );
}

// ── File upload zone ─────────────────────────────────────────────────────────

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
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const result = await uploadFile(file, folder, setProgress);
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
          border: `2px dashed ${uploading ? "var(--brand-primary)" : "var(--border-default)"}`,
          borderRadius: "var(--radius-md)",
          padding: "var(--space-6)",
          textAlign: "center",
          cursor: uploading ? "not-allowed" : "pointer",
          transition: "border-color var(--transition-fast)",
          background: uploading ? "var(--brand-primary-glow)" : "var(--bg-elevated)",
        }}
      >
        {uploading ? (
          <div>
            <div
              style={{
                marginBottom: "var(--space-2)",
                fontSize: "var(--text-sm)",
                color: "var(--brand-primary)",
              }}
            >
              Uploading… {progress}%
            </div>
            <div
              style={{
                height: 4,
                background: "var(--bg-overlay)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: "var(--brand-primary)",
                  borderRadius: 2,
                  transition: "width 0.1s",
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: "var(--space-2)" }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {label}
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                marginTop: "var(--space-1)",
              }}
            >
              Click or drag and drop
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {error && (
        <div
          style={{
            marginTop: "var(--space-2)",
            fontSize: "var(--text-xs)",
            color: "var(--error)",
          }}
        >
          {error}
        </div>
      )}

      {currentUrl && !uploading && (
        <div
          style={{
            marginTop: "var(--space-2)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-xs)",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--success)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ color: "var(--success)" }}>Uploaded</span>
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-muted)", textDecoration: "underline" }}
          >
            Preview
          </a>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminLessonEditorPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [mode, setMode] = useState<EditorMode>("list");
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLesson, setEditing] = useState<LessonItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoThumbnail, setVideoThumbnail] = useState("");
  const [videoDuration, setVideoDuration] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const numericCourseId = Number(courseId);

  useEffect(() => {
    if (!courseId) return;
    getCourseAllLessons(numericCourseId)
      .then(setLessons)
      .catch(() => setError("Failed to load lessons."))
      .finally(() => setLoading(false));
  }, [courseId, numericCourseId]);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setVideoUrl("");
    setVideoThumbnail("");
    setVideoDuration("");
    setPdfUrl("");
    setIsPublished(false);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setMode("create");
  };

  const openEdit = (lesson: LessonItem) => {
    setTitle(lesson.title);
    // FIX: load lesson.content instead of blanking it.
    // LessonItem.content is now typed (was missing before).
    // getCourseAllLessons returns content for each lesson.
    setContent(lesson.content ?? "");
    setVideoUrl(lesson.video_url ?? "");
    setVideoThumbnail(lesson.video_thumbnail_url ?? "");
    setVideoDuration(lesson.video_duration ?? "");
    setPdfUrl(lesson.pdf_url ?? "");
    setIsPublished(lesson.is_published);
    setEditing(lesson);
    setMode("edit");
  };

  // Auto-fill YouTube thumbnail when URL is entered
  const handleVideoUrlChange = (url: string) => {
    setVideoUrl(url);
    const ytId = extractYouTubeId(url);
    if (ytId && !videoThumbnail) {
      setVideoThumbnail(getYouTubeThumbnail(ytId));
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: CreateLessonPayload = {
      title: title.trim(),
      content,
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
          prev.map((l) =>
            l.id === editingLesson.id
              ? { ...l, ...updated, content: payload.content }
              : l
          )
        );
        setSuccess("Lesson updated.");
      }
      setMode("list");
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (lesson: LessonItem) => {
    try {
      await updateLesson(lesson.id, { is_published: !lesson.is_published });
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lesson.id ? { ...l, is_published: !l.is_published } : l
        )
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update lesson.");
    }
  };

  return (
    <div className="page-shell">
      <TopBar title="Lesson Editor" />
      <main className="page-content page-content--narrow page-enter">

        <button
          className="back-btn"
          onClick={() => {
            if (mode !== "list") {
              setMode("list");
              resetForm();
            } else {
              navigate("/admin/content");
            }
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {mode !== "list" ? "Back to Lessons" : "Back to Courses"}
        </button>

        {error && <div className="alert alert--error">{error}</div>}
        {success && <div className="alert alert--success">{success}</div>}

        {/* ── LIST MODE ── */}
        {mode === "list" && (
          <>
            <div className="section-header">
              <h2 className="section-header__title">Lessons</h2>
              <button className="btn btn--primary" onClick={openCreate}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Lesson
              </button>
            </div>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="skeleton"
                    style={{ height: 64, borderRadius: "var(--radius-md)" }}
                  />
                ))}
              </div>
            ) : lessons.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">📝</div>
                <h3 className="empty-state__title">No lessons yet</h3>
                <p className="empty-state__message">
                  Add your first lesson to this course.
                </p>
                <button className="btn btn--primary" onClick={openCreate}>
                  Add First Lesson
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {lessons.map((lesson, i) => (
                  <div
                    key={lesson.id}
                    className="card page-enter"
                    style={{ animationDelay: `${i * 40}ms`, padding: "var(--space-4)" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border-subtle)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: "var(--text-sm)",
                          color: "var(--text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        {lesson.order}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            fontSize: "var(--text-sm)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {lesson.title}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "var(--space-2)",
                            marginTop: "var(--space-1)",
                            flexWrap: "wrap",
                          }}
                        >
                          {lesson.has_text && (
                            <span className="badge badge--info" style={{ fontSize: 10 }}>
                              Text
                            </span>
                          )}
                          {lesson.has_video && (
                            <span className="badge badge--success" style={{ fontSize: 10 }}>
                              Video
                            </span>
                          )}
                          {lesson.has_pdf && (
                            <span className="badge badge--warning" style={{ fontSize: 10 }}>
                              PDF
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                        <button
                          className="btn btn--ghost"
                          style={{
                            padding: "var(--space-1) var(--space-3)",
                            fontSize: "var(--text-xs)",
                          }}
                          onClick={() => void handleTogglePublish(lesson)}
                        >
                          {lesson.is_published ? (
                            <span style={{ color: "var(--success)" }}>Published</span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>Draft</span>
                          )}
                        </button>
                        <button
                          className="btn btn--secondary"
                          style={{
                            padding: "var(--space-1) var(--space-3)",
                            fontSize: "var(--text-xs)",
                          }}
                          onClick={() => openEdit(lesson)}
                        >
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

        {/* ── CREATE / EDIT MODE ── */}
        {(mode === "create" || mode === "edit") && (
          <>
            <div className="section-header">
              <h2 className="section-header__title">
                {mode === "create" ? "New Lesson" : `Edit: ${editingLesson?.title}`}
              </h2>
            </div>

            {/* Title */}
            <div className="form-group">
              <label className="form-label" htmlFor="lesson-title">
                Lesson Title *
              </label>
              <input
                id="lesson-title"
                className="form-input"
                type="text"
                placeholder="e.g. Introduction to Algebra"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Text Content */}
            <div className="form-group">
              <label className="form-label" htmlFor="lesson-content">
                Text Content
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontWeight: 400,
                    marginLeft: "var(--space-2)",
                  }}
                >
                  (Markdown supported)
                </span>
              </label>
              <textarea
                id="lesson-content"
                className="form-input"
                placeholder={
                  "# Lesson Title\n\nWrite your lesson content here. Markdown is supported.\n\n## Section 1\nContent..."
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                style={{
                  fontFamily: "var(--font-body)",
                  resize: "vertical",
                  minHeight: 200,
                  lineHeight: 1.6,
                }}
              />
            </div>

            {/* Video Section */}
            <div className="form-group">
              <label className="form-label">Video</label>
              <input
                className="form-input"
                type="url"
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                value={videoUrl}
                onChange={(e) => handleVideoUrlChange(e.target.value)}
              />
              {videoUrl && (
                <>
                  <VideoPreview
                    url={videoUrl}
                    thumbnail={videoThumbnail}
                    duration={videoDuration}
                  />
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "var(--space-3)",
                      marginTop: "var(--space-3)",
                    }}
                  >
                    <div>
                      <label
                        className="form-label"
                        style={{ fontSize: "var(--text-xs)" }}
                      >
                        Thumbnail URL
                      </label>
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
                      <label
                        className="form-label"
                        style={{ fontSize: "var(--text-xs)" }}
                      >
                        Duration (e.g. 12:34)
                      </label>
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
            </div>

            {/* PDF Upload */}
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

            {/* Publish toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-4)",
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                marginBottom: "var(--space-6)",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "var(--text-sm)",
                    color: "var(--text-primary)",
                  }}
                >
                  Publish lesson
                </div>
                <div
                  style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}
                >
                  Published lessons are visible to enrolled students
                </div>
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  style={{
                    width: 18,
                    height: 18,
                    accentColor: "var(--brand-primary)",
                    cursor: "pointer",
                  }}
                />
                <span
                  style={{
                    fontSize: "var(--text-sm)",
                    color: isPublished ? "var(--success)" : "var(--text-muted)",
                  }}
                >
                  {isPublished ? "Published" : "Draft"}
                </span>
              </label>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button
                className="btn btn--primary"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" />
                    Saving…
                  </>
                ) : mode === "create" ? (
                  "Create Lesson"
                ) : (
                  "Save Changes"
                )}
              </button>
              <button
                className="btn btn--secondary"
                onClick={() => {
                  setMode("list");
                  resetForm();
                }}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}