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
        <div key={i} className="skeleton-box" style={{ height: 72, borderRadius: "var(--radius-lg)" }} />
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
      className="glass-card animate-fade-up"
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          "var(--space-3)",
        padding:      "var(--space-4)",
        background:   lesson.completed
          ? "rgba(61,214,140,0.04)"
          : isSection
          ? "rgba(61,130,246,0.04)"
          : "var(--glass-bg)",
        border: `1px solid ${lesson.completed
          ? "rgba(61,214,140,0.2)"
          : isSection
          ? "rgba(61,130,246,0.2)"
          : "var(--glass-border)"}`,
        cursor:       "pointer",
        opacity:      lesson.completed ? 0.75 : 1,
        marginBottom: "var(--space-2)",
      }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
      aria-label={`${lesson.title}${lesson.completed ? " — completed" : ""}`}
    >
      {/* Order / check badge */}
      <div style={{
        width:          32,
        height:         32,
        borderRadius:   "50%",
        flexShrink:     0,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     "var(--font-display)",
        fontWeight:     700,
        fontSize:       "var(--text-xs)",
        background:     lesson.completed
          ? "rgba(61,214,140,0.15)"
          : isSection
          ? "rgba(61,130,246,0.12)"
          : "rgba(255,255,255,0.05)",
        border:         `1px solid ${lesson.completed
          ? "rgba(61,214,140,0.3)"
          : isSection
          ? "rgba(61,130,246,0.2)"
          : "var(--glass-border)"}`,
        color:          lesson.completed
          ? "var(--role-student)"
          : isSection
          ? "var(--role-teacher)"
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
          fontSize:     "var(--text-sm)",
          fontWeight:   600,
          color:        lesson.completed ? "var(--text-secondary)" : "var(--text-primary)",
          textOverflow: "ellipsis",
          overflow:     "hidden",
          whiteSpace:   "nowrap",
          letterSpacing: "0.01em",
        }}>
          {lesson.title}
        </div>
        <div style={{
          display:    "flex",
          gap:        "var(--space-2)",
          marginTop:  "var(--space-1)",
          flexWrap:   "wrap",
        }}>
          {lesson.has_video   && <span className="role-tag role-tag--student" style={{ fontSize: 9, padding: "1px 6px" }}>VIDEO</span>}
          {lesson.has_pdf     && <span className="role-tag role-tag--teacher" style={{ fontSize: 9, padding: "1px 6px" }}>PDF</span>}
          {lesson.has_content && <span className="role-tag role-tag--principal" style={{ fontSize: 9, padding: "1px 6px" }}>READING</span>}
          {isSection && (
            <span className="role-tag role-tag--teacher" style={{ fontSize: 9, padding: "1px 6px" }}>
              TEACHER ADDED
            </span>
          )}
        </div>
      </div>

      {/* Mark complete button */}
      {!lesson.completed && onComplete && lesson.type === "global" && (
        <button
          className="btn--secondary"
          style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-xs)", flexShrink: 0 }}
          onClick={(e) => { e.stopPropagation(); onComplete(); }}
          aria-label={`Mark ${lesson.title} as complete`}
        >
          DONE
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

  const [courseId, setCourseId]     = useState<number | null>(null);
  const [courseName, setCourseName] = useState<string>("");
  const [lessons, setLessons]       = useState<LessonItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

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

        <button className="btn--ghost" style={{ marginBottom: "var(--space-6)", display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em" }} onClick={() => navigate("/courses")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          BACK TO COURSES
        </button>

        {error && (
          <div>
            <div className="alert alert--error animate-fade-up">{error}</div>
            <button className="btn--secondary" style={{ marginTop: "var(--space-3)" }} onClick={() => navigate("/courses")}>
              Go back to courses
            </button>
          </div>
        )}

        {/* Progress card — only counts global (curriculum) lessons */}
        {!loading && !error && globalLessons.length > 0 && (
          <div className="glass-card animate-fade-up" style={{ marginBottom: "var(--space-6)", padding: "var(--space-5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                {completedCount} of {globalLessons.length} curriculum lessons completed
              </span>
              <span style={{
                fontSize:     "var(--text-sm)",
                fontWeight:   800,
                fontFamily:   "var(--font-display)",
                color:        progressPct === 100 ? "var(--role-student)" : "var(--role-teacher)",
                letterSpacing: "-0.02em",
              }}>
                {progressPct}%
              </span>
            </div>
            {/* Progress track */}
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height:     "100%",
                width:      `${progressPct}%`,
                background: progressPct === 100
                  ? "var(--role-student)"
                  : "linear-gradient(90deg, var(--role-teacher), var(--role-student))",
                borderRadius: 99,
                transition:   "width 0.6s ease",
              }} />
            </div>
          </div>
        )}

        {/* Section header */}
        {!error && (
          <div className="section-header animate-fade-up" style={{ marginBottom: "var(--space-4)" }}>
            <h2 className="section-title">Lesson Nodes</h2>
            {!loading && sectionLessons.length > 0 && (
              <span className="role-tag role-tag--teacher">
                +{sectionLessons.length} from teacher
              </span>
            )}
          </div>
        )}

        {loading ? (
          <LessonsSkeleton />
        ) : !error && lessons.length === 0 ? (
          <div className="glass-card empty-well animate-fade-up">
            <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>📝</span>
            <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>NO LESSON NODES FOUND</p>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Lessons will appear here once your teacher publishes them.</span>
          </div>
        ) : !error ? (
          <ul style={{ listStyle: "none", padding: 0 }}>
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
          <div className="animate-fade-up" style={{ marginTop: "var(--space-6)" }}>
            <button
              className="glass-card"
              style={{
                width:          "100%",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "space-between",
                padding:        "var(--space-4) var(--space-5)",
                cursor:         "pointer",
                border:         "1px solid var(--glass-border)",
              }}
              onClick={() => navigate(`/courses/${grade}/${subjectSlug}/assessments`)}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "12px", fontWeight: 800, letterSpacing: "0.05em", color: "var(--text-primary)" }}>
                📋 VIEW COURSE ASSESSMENTS
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
