import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../services/api";
import { updateLessonProgress } from "../services/progress";

type Lesson = {
  id: number;
  title: string;
  content: string;
};

type LessonProgress = {
  lesson_id: number;
  completed: boolean;
};

export default function LessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lessonId) return;

    apiGet<Lesson>(`/lessons/${lessonId}/`).then(setLesson);
    apiGet<LessonProgress>(`/lessons/${lessonId}/progress/`)
      .then((p) => setCompleted(p.completed));
  }, [lessonId]);

  async function markCompleted() {
    if (!lesson || completed) return;
    setSaving(true);
    await updateLessonProgress(lesson.id, { completed: true });
    setCompleted(true);
    setSaving(false);
  }

  if (!lesson) return <p>Loading…</p>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <button onClick={() => navigate(-1)}>← Back</button>

      <h1 style={{ marginTop: 16 }}>{lesson.title}</h1>

      <section
        style={{
          margin: "24px 0",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}
      >
        {lesson.content || "Lesson content coming soon."}
      </section>

      {/* Lesson actions */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <button
          onClick={markCompleted}
          disabled={completed || saving}
        >
          {completed ? "Completed ✓" : saving ? "Saving…" : "Mark completed"}
        </button>

        {/* Navigation affordance (UI-only) */}
        <span style={{ opacity: 0.6 }}>
          Use Back / Resume to continue
        </span>
      </div>
    </div>
  );
}
