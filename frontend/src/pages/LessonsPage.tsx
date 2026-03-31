// pages.LessonsPage — Glassmorphism 2.0
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../services/api";
import { getCourseBySlug } from "../services/content";
import { updateLessonProgress } from "../services/progress";
import { fromSlug } from "../utils/slugs";

type LessonItem = {
  id: number;
  type: "global" | "section";
  title: string;
  order: number;
  completed: boolean;
  has_video: boolean;
  has_pdf: boolean;
  has_content: boolean;
  section_label?: string;
  created_by?: string | null;
};

function LessonsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 64, borderRadius: "var(--radius-md)" }} />
      ))}
    </div>
  );
}

function LessonRow({
  lesson, onSelect, onComplete,
}: {
  lesson: LessonItem;
  onSelect: () => void;
  onComplete?: () => void;
}) {
  const isSection = lesson.type === "section";

  return (
    <li
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        padding: "var(--space-4)",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${
          lesson.completed ? "rgba(16,185,129,0.18)" :
          isSection ? "rgba(59,130,246,0.18)" :
          "var(--border-light)"}`,
        background: lesson.completed
          ? "rgba(16,185,129,0.04)"
          : isSection ? "rgba(59,130,246,0.03)" : "var(--bg-elevated)",
        cursor: "pointer",
        transition: "all var(--ease-out)",
        opacity: lesson.completed ? 0.78 : 1,
        backdropFilter: undefined,
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={onSelect}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLLIElement;
        if (!lesson.completed) el.style.transform = "translateX(3px)";
        el.style.borderColor = isSection ? "rgba(59,130,246,0.35)" : "var(--border-medium)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLLIElement;
        el.style.transform = "";
        el.style.borderColor = "";
      }}
      aria-label={`${lesson.title}${lesson.completed ? " — completed" : ""}`}
    >
      {/* Number / check */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xs)",
        background: lesson.completed
          ? "rgba(16,185,129,0.15)"
          : isSection ? "rgba(59,130,246,0.12)" : "var(--bg-elevated)",
        border: `1px solid ${
          lesson.completed ? "rgba(16,185,129,0.3)" :
          isSection ? "rgba(59,130,246,0.2)" : "var(--border-light)"}`,
        color: lesson.completed ? "var(--success)" : isSection ? "var(--saffron)" : "var(--ink-muted)",
      }}>
        {lesson.completed ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : lesson.order}
      </div>

      {/* Title + tags */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "var(--text-sm)", fontWeight: 600,
          color: lesson.completed ? "var(--ink-muted)" : "var(--ink-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {lesson.title}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-1)", flexWrap: "wrap" }}>
          {lesson.has_video   && <span className="badge badge--success" style={{ fontSize: 9 }}>Video</span>}
          {lesson.has_pdf     && <span className="badge badge--warning" style={{ fontSize: 9 }}>PDF</span>}
          {lesson.has_content && <span className="badge badge--info"    style={{ fontSize: 9 }}>Reading</span>}
          {isSection && (
            <span style={{
              fontSize: 9, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.06em", color: "var(--saffron)",
              background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: "var(--radius-full)", padding: "1px 6px",
            }}>
              Teacher
            </span>
          )}
        </div>
      </div>

      {/* Mark done */}
      {!lesson.completed && onComplete && lesson.type === "global" && (
        <button
          className="btn btn--ghost btn--sm"
          style={{ flexShrink: 0 }}
          onClick={(e) => { e.stopPropagation(); onComplete(); }}
          aria-label={`Mark ${lesson.title} as complete`}
        >
          Done
        </button>
      )}

      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="var(--ink-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0 }} aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </li>
  );
}

export default function LessonsPage() {
  const { grade: gradeParam, subject: subjectSlug } = useParams<{ grade: string; subject: string }>();
  const navigate = useNavigate();

  const [courseId,   setCourseId]   = useState<number | null>(null);
  const [courseName, setCourseName] = useState<string>("");
  const [lessons,    setLessons]    = useState<LessonItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const grade        = gradeParam ? Number(gradeParam) : null;
  const subjectLabel = subjectSlug ? fromSlug(subjectSlug) : "";

  useEffect(() => {
    if (!grade || !subjectSlug) {
      setError("Invalid course URL."); setLoading(false); return;
    }
    getCourseBySlug(grade, subjectSlug)
      .then((course) => {
        setCourseId(course.id);
        setCourseName(course.title);
        return apiGet<LessonItem[]>(`/courses/${course.id}/lessons/`);
      })
      .then(setLessons)
      .catch(() => setError("Course not found or you don't have access."))
      .finally(() => setLoading(false));
  }, [grade, subjectSlug]);

  const handleComplete = async (lessonId: number) => {
    await updateLessonProgress(lessonId, { completed: true });
    setLessons((prev) => prev.map((l) => l.id === lessonId ? { ...l, completed: true } : l));
  };

  const handleSelect = (lesson: LessonItem) => {
    navigate(lesson.type === "section" ? `/lessons/section/${lesson.id}` : `/lessons/${lesson.id}`);
  };

  const globalLessons  = lessons.filter((l) => l.type === "global");
  const sectionLessons = lessons.filter((l) => l.type === "section");
  const completedCount = globalLessons.filter((l) => l.completed).length;
  const progressPct    = globalLessons.length ? Math.round((completedCount / globalLessons.length) * 100) : 0;
  const progressColor  = progressPct === 100 ? "var(--success)" : progressPct >= 60 ? "var(--saffron)" : "var(--saffron)";

  const pageTitle = subjectLabel ? `${subjectLabel} · Class ${grade ?? ""}` : "Lessons";

  return (
    <>

        <button className="back-btn" onClick={() => navigate("/courses")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Courses
        </button>

        {error && (
          <div>
            <div className="alert alert--error">{error}</div>
            <button className="btn btn--secondary" style={{ marginTop: "var(--space-3)" }} onClick={() => navigate("/courses")}>
              Back to courses
            </button>
          </div>
        )}

        {/* Progress card */}
        {!loading && !error && globalLessons.length > 0 && (
          <div className="card" style={{ marginBottom: "var(--space-6)", padding: "var(--space-5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-base)", color: "var(--ink-primary)", marginBottom: 2 }}>
                  {courseName || subjectLabel}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                  {completedCount} of {globalLessons.length} lessons completed
                  {sectionLessons.length > 0 && ` · +${sectionLessons.length} from teacher`}
                </div>
              </div>
              <span style={{
                fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "var(--text-2xl)",
                color: progressColor, letterSpacing: "-0.03em", lineHeight: 1,
              }}>
                {progressPct}%
              </span>
            </div>
            <div className="progress-bar" style={{ margin: 0 }}>
              <div className="progress-bar__fill" style={{ width: `${progressPct}%`, background: progressColor }} />
            </div>
          </div>
        )}

        {/* Section header */}
        {!error && (
          <div className="section-header">
            <h2 className="section-header__title">Lessons</h2>
            {!loading && sectionLessons.length > 0 && (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--saffron)", fontWeight: 700 }}>
                +{sectionLessons.length} teacher
              </span>
            )}
          </div>
        )}

        {loading ? <LessonsSkeleton />
        : !error && lessons.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📝</div>
            <h3 className="empty-state__title">No lessons yet</h3>
            <p className="empty-state__message">Lessons appear here once your teacher publishes them.</p>
          </div>
        ) : !error ? (
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {lessons.map((lesson, i) => (
              <div key={`${lesson.type}-${lesson.id}`} className="page-enter" style={{ animationDelay: `${i * 30}ms` }}>
                <LessonRow
                  lesson={lesson}
                  onSelect={() => handleSelect(lesson)}
                  onComplete={lesson.type === "global" ? () => void handleComplete(lesson.id) : undefined}
                />
              </div>
            ))}
          </ul>
        ) : null}

        {/* Assessments shortcut */}
        {!loading && !error && courseId && grade && subjectSlug && (
          <button
            className="history-shortcut"
            style={{ marginTop: "var(--space-6)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}
            onClick={() => navigate(`/courses/${grade}/${subjectSlug}/assessments`)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: 14 }}>📋</span>
              Course assessments
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
    </>
  );
}
