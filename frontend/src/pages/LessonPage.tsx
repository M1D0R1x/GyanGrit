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
    <div style={{ maxWidth: "700px" }}>
      <button onClick={() => navigate(-1)}>← Back</button>

      <h2>{lesson.title}</h2>

      <p style={{ marginBottom: "24px" }}>
        {lesson.content || "Lesson content coming soon."}
      </p>

      {/* Completion block */}
      <div style={{ marginTop: "32px" }}>
        {completed ? (
          <div
            style={{
              padding: "12px",
              background: "#f0fdf4",
              border: "1px solid #16a34a",
            }}
          >
            ✅ Lesson completed
          </div>
        ) : (
          <button
            onClick={markCompleted}
            disabled={saving}
          >
            {saving ? "Saving…" : "Mark as completed"}
          </button>
        )}
      </div>
    </div>
  );
}
