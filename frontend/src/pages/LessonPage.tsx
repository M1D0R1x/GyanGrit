import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../services/api";
import { updateLessonProgress } from "../services/progress";
import TopBar from "../components/TopBar";

type LessonDetail = {
  id: number;
  title: string;
  content: string;
  video_url: string | null;
  hls_manifest_url: string | null;
  thumbnail_url: string | null;
  completed: boolean;
  last_position: number;
};

export default function LessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson]     = useState<LessonDetail | null>(null);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!lessonId) return;
    // lesson_detail endpoint returns completed + last_position inline
    // no need for a separate progress GET call
    apiGet<LessonDetail>(`/lessons/${lessonId}/`)
      .then((data) => {
        setLesson(data);
        setCompleted(data.completed);
      })
      .finally(() => setLoading(false));
  }, [lessonId]);

  const markCompleted = async () => {
    if (!lesson || completed || saving) return;
    setSaving(true);
    try {
      await updateLessonProgress(lesson.id, { completed: true });
      setCompleted(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell">
      <TopBar title={lesson?.title ?? "Lesson"} />
      <main className="page-content page-content--narrow page-enter">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        {loading ? (
          <div>
            <div className="skeleton skeleton-line skeleton-line--medium" style={{ height: 32, marginBottom: "var(--space-4)" }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-line skeleton-line--full" style={{ marginBottom: "var(--space-3)" }} />
            ))}
          </div>
        ) : !lesson ? (
          <div className="empty-state">
            <div className="empty-state__icon">❓</div>
            <h3 className="empty-state__title">Lesson not found</h3>
          </div>
        ) : (
          <>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-3xl)",
              fontWeight: 800,
              color: "var(--text-primary)",
              letterSpacing: "-0.03em",
              marginBottom: "var(--space-6)",
            }}>
              {lesson.title}
            </h1>

            {completed && (
              <div className="alert alert--success" style={{ marginBottom: "var(--space-6)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                You have completed this lesson
              </div>
            )}

            <div className="card" style={{ marginBottom: "var(--space-6)" }}>
              <p style={{
                fontSize: "var(--text-base)",
                color: "var(--text-secondary)",
                lineHeight: 1.8,
                whiteSpace: "pre-wrap",
              }}>
                {lesson.content || "Lesson content coming soon."}
              </p>
            </div>

            {!completed && (
              <button
                className="btn btn--primary"
                onClick={markCompleted}
                disabled={saving}
                aria-label="Mark this lesson as complete"
              >
                {saving ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Mark as complete
                  </>
                )}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}