// pages.LessonsPage
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../services/api";
import { getCourseBySlug } from "../services/content";
import { updateLessonProgress } from "../services/progress";
import { fromSlug } from "../utils/slugs";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

/**
 * LessonsPage — merged global + section lessons.
 *
 * Route: /courses/:grade/:subject  e.g. /courses/10/punjabi
 *
 * We first resolve the course ID from the grade+subject slug via
 * GET /api/v1/courses/by-slug/?grade=10&subject=punjabi
 * then load lessons for that course_id as usual.
 *
 * The backend returns a unified sorted list where each item has:
 *   type: "global" | "section"
 *
 * Global lessons = government curriculum
 * Section lessons = teacher-added supplemental content (shown with "Teacher Added" tag)
 */

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
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 64, borderRadius: "var(--radius-md)" }} />
      ))}
    </div>
  );
}

function LessonRow({
  lesson,
  onSelect,
  onComplete,
}: {
  lesson: LessonItem;
  onSelect: () => void;
  onComplete?: () => void;
}) {
  const isSection = lesson.type === "section";

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${lesson.completed
          ? "rgba(63,185,80,0.2)"
          : isSection
          ? "rgba(59,130,246,0.2)"
          : "var(--border-subtle)"}`,
        background: lesson.completed
          ? "rgba(63,185,80,0.04)"
          : isSection
          ? "rgba(59,130,246,0.03)"
          : "var(--bg-surface)",
        cursor: "pointer",
        transition: "all var(--transition-fast)",
        opacity: lesson.completed ? 0.75 : 1,
      }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
      aria-label={`${lesson.title}${lesson.completed ? " — completed" : ""}`}
    >
      {/* Order / check badge */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: "var(--text-xs)",
        background: lesson.completed
          ? "rgba(63,185,80,0.15)"
          : isSection
          ? "rgba(59,130,246,0.12)"
          : "var(--bg-elevated)",
        border: `1px solid ${lesson.completed
          ? "rgba(63,185,80,0.3)"
          : isSection
          ? "rgba(59,130,246,0.2)"
          : "var(--border-subtle)"}`,
        color: lesson.completed
          ? "var(--success)"
          : isSection
          ? "var(--brand-primary)"
          : "var(--text-secondary)",
      }}>
        {lesson.completed ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          lesson.order
        )}
      </div>

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: lesson.completed ? "var(--text-secondary)" : "var(--text-primary)",
          textOverflow: "ellipsis",
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}>
          {lesson.title}
        </div>
        <div style={{
          display: "flex",
          gap: "var(--space-2)",
          marginTop: "var(--space-1)",
          flexWrap: "wrap",
        }}>
          {lesson.has_video   && <span className="badge badge--success" style={{ fontSize: 9 }}>Video</span>}
          {lesson.has_pdf     && <span className="badge badge--warning" style={{ fontSize: 9 }}>PDF</span>}
          {lesson.has_content && <span className="badge badge--info"    style={{ fontSize: 9 }}>Reading</span>}
          {isSection && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--brand-primary)",
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: "var(--radius-full)",
              padding: "1px 6px",
            }}>
              Teacher Added
            </span>
          )}
        </div>
      </div>

      {/* Mark complete button */}
      {!lesson.completed && onComplete && lesson.type === "global" && (
        <button
          className="btn btn--ghost"
          style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-xs)", flexShrink: 0 }}
          onClick={(e) => { e.stopPropagation(); onComplete(); }}
          aria-label={`Mark ${lesson.title} as complete`}
        >
          Mark done
        </button>
      )}

      {/* Arrow */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </li>
  );
}

export default function LessonsPage() {
  const { grade: gradeParam, subject: subjectSlug } = useParams<{
    grade: string;
    subject: string;
  }>();
  const navigate = useNavigate();

  const [courseId, setCourseId]   = useState<number | null>(null);
  const [courseName, setCourseName] = useState<string>("");
  const [lessons, setLessons]     = useState<LessonItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const grade = gradeParam ? Number(gradeParam) : null;
  // Derive a human-readable subject label for the TopBar while loading
  const subjectLabel = subjectSlug ? fromSlug(subjectSlug) : "";

  useEffect(() => {
    if (!grade || !subjectSlug) {
      const t = setTimeout(() => {
        setError("Invalid course URL.");
        setLoading(false);
      }, 0);
      return () => clearTimeout(t);
    }

    // Step 1: resolve grade + subject slug → courseId
    getCourseBySlug(grade, subjectSlug)
      .then((course) => {
        setCourseId(course.id);
        setCourseName(course.title);
        // Step 2: load lessons for that courseId
        return apiGet<LessonItem[]>(`/courses/${course.id}/lessons/`);
      })
      .then(setLessons)
      .catch(() => setError("Course not found or you don't have access."))
      .finally(() => setLoading(false));
  }, [grade, subjectSlug]);

  const handleComplete = async (lessonId: number) => {
    await updateLessonProgress(lessonId, { completed: true });
    setLessons((prev) =>
      prev.map((l) => l.id === lessonId ? { ...l, completed: true } : l)
    );
  };

  const handleSelect = (lesson: LessonItem) => {
    if (lesson.type === "section") {
      navigate(`/lessons/section/${lesson.id}`);
    } else {
      navigate(`/lessons/${lesson.id}`);
    }
  };

  const globalLessons  = lessons.filter((l) => l.type === "global");
  const sectionLessons = lessons.filter((l) => l.type === "section");
  const completedCount = globalLessons.filter((l) => l.completed).length;
  const progressPct    = globalLessons.length
    ? Math.round((completedCount / globalLessons.length) * 100)
    : 0;

  const pageTitle = courseName || subjectLabel
    ? `${subjectLabel} · Class ${grade ?? ""}`
    : "Lessons";

  return (
    <div className="page-shell">
      <TopBar title={pageTitle} />
      <main className="page-content page-content--narrow page-enter has-bottom-nav">

        <button className="back-btn" onClick={() => navigate("/courses")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Courses
        </button>

        {error && (
          <div>
            <div className="alert alert--error">{error}</div>
            <button className="btn btn--secondary" style={{ marginTop: "var(--space-3)" }} onClick={() => navigate("/courses")}>
              Go back to courses
            </button>
          </div>
        )}

        {/* Progress card — only counts global (curriculum) lessons */}
        {!loading && !error && globalLessons.length > 0 && (
          <div className="card" style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                {completedCount} of {globalLessons.length} curriculum lessons completed
              </span>
              <span style={{
                fontSize: "var(--text-sm)",
                fontWeight: 700,
                fontFamily: "var(--font-display)",
                color: progressPct === 100 ? "var(--success)" : "var(--brand-primary)",
              }}>
                {progressPct}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar__fill"
                style={{
                  width: `${progressPct}%`,
                  background: progressPct === 100 ? "var(--success)" : "var(--brand-primary)",
                }}
              />
            </div>
          </div>
        )}

        {/* Section header */}
        {!error && (
          <div className="section-header">
            <h2 className="section-header__title">Lessons</h2>
            {!loading && sectionLessons.length > 0 && (
              <span style={{
                fontSize: "var(--text-xs)",
                color: "var(--brand-primary)",
                fontWeight: 600,
              }}>
                +{sectionLessons.length} from your teacher
              </span>
            )}
          </div>
        )}

        {loading ? (
          <LessonsSkeleton />
        ) : !error && lessons.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📝</div>
            <h3 className="empty-state__title">No lessons yet</h3>
            <p className="empty-state__message">
              Lessons will appear here once your teacher publishes them.
            </p>
          </div>
        ) : !error ? (
          <ul style={{
            listStyle: "none",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}>
            {lessons.map((lesson) => (
              <LessonRow
                key={`${lesson.type}-${lesson.id}`}
                lesson={lesson}
                onSelect={() => handleSelect(lesson)}
                onComplete={
                  lesson.type === "global"
                    ? () => void handleComplete(lesson.id)
                    : undefined
                }
              />
            ))}
          </ul>
        ) : null}

        {/* Assessments shortcut — shown once course is resolved */}
        {!loading && !error && courseId && grade && subjectSlug && (
          <div style={{ marginTop: "var(--space-6)" }}>
            <button
              className="history-shortcut"
              onClick={() => navigate(`/courses/${grade}/${subjectSlug}/assessments`)}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <span style={{ fontSize: 14 }}>📋</span>
                View course assessments
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
