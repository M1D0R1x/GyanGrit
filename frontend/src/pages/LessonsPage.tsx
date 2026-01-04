import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../services/api";
import { updateLessonProgress } from "../services/progress";

/**
 * Lesson data returned by backend.
 */
type Lesson = {
  id: number;
  title: string;
  content: string;
};

/**
 * Lesson progress shape.
 */
type LessonProgress = {
  lesson_id: number;
  completed: boolean;
};

export default function LessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [completed, setCompleted] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  /**
   * Load lesson content + progress.
   * Progress is fetched separately so UI can react to it.
   */
  useEffect(() => {
    if (!lessonId) return;

    apiGet<Lesson>(`/lessons/${lessonId}/`).then(setLesson);

    apiGet<LessonProgress>(`/lessons/${lessonId}/progress/`)
      .then((p) => setCompleted(p.completed));
  }, [lessonId]);

  /**
   * Explicit completion action.
   * UI updates optimistically.
   */
  async function markCompleted() {
    if (!lesson || completed) return;

    setSaving(true);
    try {
      await updateLessonProgress(lesson.id, { completed: true });
      setCompleted(true);
    } finally {
      setSaving(false);
    }
  }

  if (!lesson) {
    return <p>Loading lesson…</p>;
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "24px" }}>
      {/* Navigation */}
      <button onClick={() => navigate(-1)}>
        ← Back
      </button>

      {/* Lesson header */}
      <header style={{ marginTop: "16px", marginBottom: "24px" }}>
        <h1>{lesson.title}</h1>
      </header>

      {/* Lesson content */}
      <section
        style={{
          lineHeight: "1.6",
          marginBottom: "32px",
          whiteSpace: "pre-wrap",
        }}
      >
        {lesson.content || "Lesson content coming soon."}
      </section>

      {/* Progress action */}
      <footer>
        <button
          onClick={markCompleted}
          disabled={completed || saving}
          style={{
            padding: "8px 16px",
            cursor: completed ? "default" : "pointer",
          }}
        >
          {completed
            ? "Completed ✓"
            : saving
            ? "Saving…"
            : "Mark as completed"}
        </button>
      </footer>
    </div>
  );
}
