import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../services/api";
import { updateLessonProgress } from "../services/progress";
import LessonItem from "../components/LessonItem";
import TopBar from "../components/TopBar";

type Lesson = {
  id: number;
  title: string;
  order: number;
  completed: boolean;
};

function LessonsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 52, borderRadius: "var(--radius-md)" }} />
      ))}
    </div>
  );
}

export default function LessonsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [lessons, setLessons]   = useState<Lesson[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    apiGet<Lesson[]>(`/courses/${courseId}/lessons/`)
      .then(setLessons)
      .catch(() => setError("Failed to load lessons."))
      .finally(() => setLoading(false));
  }, [courseId]);

  const handleComplete = async (lessonId: number) => {
    await updateLessonProgress(lessonId, { completed: true });
    setLessons((prev) =>
      prev.map((l) => l.id === lessonId ? { ...l, completed: true } : l)
    );
  };

  const completedCount = lessons.filter((l) => l.completed).length;
  const progressPct = lessons.length
    ? Math.round((completedCount / lessons.length) * 100)
    : 0;

  return (
    <div className="page-shell">
      <TopBar title="Lessons" />
      <main className="page-content page-content--narrow page-enter">
        <button className="back-btn" onClick={() => navigate("/courses")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Courses
        </button>

        {error && <div className="alert alert--error">{error}</div>}

        {!loading && lessons.length > 0 && (
          <div className="card" style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                {completedCount} of {lessons.length} lessons completed
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

        <div className="section-header">
          <h2 className="section-header__title">Lessons</h2>
        </div>

        {loading ? (
          <LessonsSkeleton />
        ) : lessons.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📝</div>
            <h3 className="empty-state__title">No lessons yet</h3>
            <p className="empty-state__message">
              Lessons will appear here once your teacher publishes them.
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {lessons.map((lesson) => (
              <LessonItem
                key={lesson.id}
                title={lesson.title}
                order={lesson.order}
                completed={lesson.completed}
                onSelect={() => navigate(`/lessons/${lesson.id}`)}
                onComplete={() => handleComplete(lesson.id)}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}