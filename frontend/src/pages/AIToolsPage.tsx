// pages/AIToolsPage.tsx
// AI Teacher Tools — Generate flashcard decks and MCQ assessments using Groq AI.
// Accessible to: TEACHER, PRINCIPAL, ADMIN
//
// Fixed (2026-04-04):
//   - Flashcard "Paste Text" mode: subject dropdown so subject_id is always sent
//   - Assessment tab: subject → course dropdowns (no more raw Course ID field)
//   - Courses fetched once from /courses/ (role-scoped), filtered client-side by subject
//   - All loading/error states properly handled

import { useState, useEffect } from "react";
import { generateAIFlashcards, generateAIAssessment, publishAIFlashcardDeck } from "../services/aiTools";
import { updateAssessment } from "../services/assessments";
import { apiGet } from "../services/api";
import type { AIFlashcardGenerateResponse, AIAssessmentGenerateResponse } from "../services/aiTools";

// ── Types ─────────────────────────────────────────────────────────────────────
type Assignment = {
  section_id: number;
  section_name: string;
  subject_id: number;
  subject_name: string;
};

// Shape returned by GET /api/v1/courses/
type ApiCourse = {
  id: number;
  title: string;
  grade: number;
  subject__id: number;
  subject__name: string;
  is_core: boolean;
};

type Subject = { id: number; name: string };
type Course  = { id: number; title: string; subject_id: number };

// ── Data hook ─────────────────────────────────────────────────────────────────
function useTeacherData() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses,  setCourses]  = useState<Course[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    Promise.all([
      apiGet<Assignment[]>("/academics/my-assignments/"),
      apiGet<ApiCourse[]>("/courses/"),
    ])
      .then(([assignments, apiCourses]) => {
        // Deduplicate subjects from assignments
        const subjectMap = new Map<number, string>();
        for (const a of assignments) {
          subjectMap.set(a.subject_id, a.subject_name);
        }
        setSubjects(
          Array.from(subjectMap.entries()).map(([id, name]) => ({ id, name }))
        );

        // Normalise course shape
        setCourses(
          apiCourses.map((c) => ({
            id:         c.id,
            title:      c.title,
            subject_id: c["subject__id"],
          }))
        );
      })
      .catch(() => setError("Failed to load your subjects and courses."))
      .finally(() => setLoading(false));
  }, []);

  return { subjects, courses, loading, error };
}

// ── Root page ─────────────────────────────────────────────────────────────────
export default function AIToolsPage() {
  const [activeTab, setActiveTab] = useState<"flashcards" | "assessments">("flashcards");
  const { subjects, courses, loading, error } = useTeacherData();

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <header style={{ marginBottom: "var(--space-8)", textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-4xl)",
            fontWeight: 800,
            background: "linear-gradient(135deg, var(--brand-primary), var(--saffron))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          AI Course Tools ✨
        </h1>
        <p style={{ color: "var(--ink-muted)", marginTop: "var(--space-2)", fontSize: "var(--text-sm)" }}>
          Generate high-quality study materials instantly from your curriculum using Groq AI.
        </p>
      </header>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
        {(["flashcards", "assessments"] as const).map((tab) => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? "btn--primary" : "btn--secondary"}`}
            onClick={() => setActiveTab(tab)}
            style={{ flex: 1 }}
          >
            {tab === "flashcards" ? "🃏 Flashcard Deck" : "📝 MCQ Assessment"}
          </button>
        ))}
      </div>

      <div className="card glass-panel page-enter" style={{ padding: "var(--space-6)" }}>
        {loading ? (
          <div style={{ color: "var(--ink-muted)", textAlign: "center", padding: "var(--space-8)" }}>
            Loading your subjects…
          </div>
        ) : error ? (
          <div style={{ color: "var(--error)", textAlign: "center", padding: "var(--space-8)" }}>
            ⚠️ {error}
          </div>
        ) : subjects.length === 0 ? (
          <div
            style={{
              color: "var(--ink-muted)",
              textAlign: "center",
              padding: "var(--space-8)",
              border: "1px dashed var(--border-light)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "var(--space-3)" }}>📚</div>
            <p>No subject assignments found.</p>
            <p style={{ fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>
              Contact your admin to assign you to a section/subject first.
            </p>
          </div>
        ) : activeTab === "flashcards" ? (
          <FlashcardGeneratorTab subjects={subjects} />
        ) : (
          <AssessmentGeneratorTab subjects={subjects} courses={courses} />
        )}
      </div>
    </div>
  );
}

// ── Flashcard Generator Tab ───────────────────────────────────────────────────
function FlashcardGeneratorTab({ subjects }: { subjects: Subject[] }) {
  const [sourceType, setSourceType] = useState<"text" | "lesson">("text");
  const [text,       setText]       = useState("");
  const [lessonId,   setLessonId]   = useState("");
  const [subjectId,  setSubjectId]  = useState<number>(subjects[0]?.id ?? 0);
  const [count,      setCount]      = useState(10);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [result,     setResult]     = useState<AIFlashcardGenerateResponse | null>(null);

  // Keep subjectId valid when subjects list changes
  useEffect(() => {
    if (subjects.length > 0 && !subjects.find((s) => s.id === subjectId)) {
      setSubjectId(subjects[0].id);
    }
  }, [subjects, subjectId]);

  const validate = (): string => {
    if (sourceType === "text" && !text.trim()) return "Paste some text or notes to generate cards from.";
    if (sourceType === "lesson" && !lessonId)   return "Enter a lesson ID.";
    return "";
  };

  const handleGenerate = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true); setError(""); setResult(null);
    try {
      const payload =
        sourceType === "text"
          ? { text: text.trim(), subject_id: subjectId, count }
          : { lesson_id: parseInt(lessonId, 10), count };
      setResult(await generateAIFlashcards(payload));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate flashcards.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!result) return;
    setLoading(true);
    try {
      await publishAIFlashcardDeck(result.deck_id);
      setResult({ ...result, status: "published" });
    } catch (e: unknown) {
      setError("Publish failed: " + (e instanceof Error ? e.message : "unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Generate Flashcard Deck</h3>
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)", margin: 0 }}>
          AI creates question/answer pairs for spaced-repetition study. You review before publishing.
        </p>
      </div>

      {/* Source toggle */}
      <div style={{ display: "flex", gap: "var(--space-5)" }}>
        {(["text", "lesson"] as const).map((t) => (
          <label key={t} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", fontSize: "var(--text-sm)" }}>
            <input type="radio" name="fc-source" checked={sourceType === t} onChange={() => setSourceType(t)} />
            {t === "text" ? "Paste Text / Notes" : "From Lesson ID"}
          </label>
        ))}
      </div>

      {sourceType === "text" ? (
        <>
          <textarea
            className="form-input"
            rows={6}
            placeholder="Paste chapter summary, notes, or any curriculum text here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
          {/* Subject is required for text mode — no lesson to infer from */}
          <div>
            <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, display: "block", marginBottom: "var(--space-1)" }}>
              Subject <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <select
              className="form-input"
              value={subjectId}
              onChange={(e) => setSubjectId(parseInt(e.target.value, 10))}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 4 }}>
              The deck will be linked to this subject so enrolled students can find it.
            </p>
          </div>
        </>
      ) : (
        <div>
          <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, display: "block", marginBottom: "var(--space-1)" }}>
            Lesson ID
          </label>
          <input
            className="form-input"
            type="number"
            placeholder="Enter the numeric lesson ID"
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            style={{ maxWidth: 240 }}
          />
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 4 }}>
            Subject is inferred automatically from the lesson.
          </p>
        </div>
      )}

      {/* Card count */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, whiteSpace: "nowrap" }}>Number of cards:</label>
        <input
          className="form-input"
          type="number" min={5} max={20}
          value={count}
          onChange={(e) => setCount(Math.max(5, Math.min(20, parseInt(e.target.value, 10) || 10)))}
          style={{ width: 90 }}
        />
        <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>5 – 20</span>
      </div>

      <button className="btn btn--primary" onClick={handleGenerate} disabled={loading} style={{ alignSelf: "flex-start", minWidth: 160 }}>
        {loading ? "Generating…" : "Generate ✨"}
      </button>

      {error && <ErrorBanner message={error} />}

      {result && (
        <FlashcardResult
          result={result}
          loading={loading}
          onPublish={handlePublish}
        />
      )}
    </div>
  );
}

// ── Assessment Generator Tab ──────────────────────────────────────────────────
function AssessmentGeneratorTab({ subjects, courses }: { subjects: Subject[]; courses: Course[] }) {
  const [subjectId,   setSubjectId]   = useState<number>(subjects[0]?.id ?? 0);
  const [courseId,    setCourseId]    = useState<number>(0);
  const [sourceType,  setSourceType]  = useState<"text" | "lesson">("text");
  const [text,        setText]        = useState("");
  const [lessonId,    setLessonId]    = useState("");
  const [count,       setCount]       = useState(5);
  const [passPercent, setPassPercent] = useState(70);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [result,      setResult]      = useState<AIAssessmentGenerateResponse | null>(null);

  // Courses for the selected subject (client-side filter)
  const subjectCourses = courses.filter((c) => c.subject_id === subjectId);

  // Keep subjectId valid
  useEffect(() => {
    if (subjects.length > 0 && !subjects.find((s) => s.id === subjectId)) {
      setSubjectId(subjects[0].id);
    }
  }, [subjects, subjectId]);

  // When subject changes, auto-select first available course
  useEffect(() => {
    setCourseId(subjectCourses[0]?.id ?? 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, courses]);

  const validate = (): string => {
    if (!courseId)                                return "Please select a course.";
    if (sourceType === "text" && !text.trim())    return "Paste some lesson material.";
    if (sourceType === "lesson" && !lessonId)     return "Enter a lesson ID.";
    return "";
  };

  const handleGenerate = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true); setError(""); setResult(null);
    try {
      const payload =
        sourceType === "text"
          ? { text: text.trim(), count, pass_percent: passPercent }
          : { lesson_id: parseInt(lessonId, 10), count, pass_percent: passPercent };
      setResult(await generateAIAssessment(courseId, payload));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate assessment.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!result) return;
    setLoading(true);
    try {
      await updateAssessment(result.assessment_id, { is_published: true });
      setResult({ ...result, status: "published" });
    } catch (e: unknown) {
      setError("Publish failed: " + (e instanceof Error ? e.message : "unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Generate MCQ Assessment</h3>
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)", margin: 0 }}>
          AI creates multiple-choice questions. Review and edit before publishing to students.
        </p>
      </div>

      {/* Subject → Course pickers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <div>
          <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, display: "block", marginBottom: "var(--space-1)" }}>
            Subject <span style={{ color: "var(--error)" }}>*</span>
          </label>
          <select
            className="form-input"
            value={subjectId}
            onChange={(e) => setSubjectId(parseInt(e.target.value, 10))}
          >
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, display: "block", marginBottom: "var(--space-1)" }}>
            Course <span style={{ color: "var(--error)" }}>*</span>
          </label>
          {subjectCourses.length === 0 ? (
            <div style={{ padding: "var(--space-2)", color: "var(--error)", fontSize: "var(--text-xs)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)" }}>
              No courses for this subject. Create one in Admin → Content first.
            </div>
          ) : (
            <select
              className="form-input"
              value={courseId}
              onChange={(e) => setCourseId(parseInt(e.target.value, 10))}
            >
              {subjectCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Source toggle */}
      <div style={{ display: "flex", gap: "var(--space-5)" }}>
        {(["text", "lesson"] as const).map((t) => (
          <label key={t} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", fontSize: "var(--text-sm)" }}>
            <input type="radio" name="as-source" checked={sourceType === t} onChange={() => setSourceType(t)} />
            {t === "text" ? "Paste Text / Notes" : "From Lesson ID"}
          </label>
        ))}
      </div>

      {sourceType === "text" ? (
        <textarea
          className="form-input"
          rows={6}
          placeholder="Paste lesson content or notes here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
      ) : (
        <div>
          <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, display: "block", marginBottom: "var(--space-1)" }}>Lesson ID</label>
          <input
            className="form-input"
            type="number"
            placeholder="Enter lesson ID"
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            style={{ maxWidth: 200 }}
          />
        </div>
      )}

      {/* Options */}
      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", fontSize: "var(--text-sm)" }}>
          <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>Questions:</span>
          <input className="form-input" type="number" min={5} max={20} value={count}
            onChange={(e) => setCount(Math.max(5, Math.min(20, parseInt(e.target.value, 10) || 5)))}
            style={{ width: 80 }} />
        </label>
        <label style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", fontSize: "var(--text-sm)" }}>
          <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>Pass %:</span>
          <input className="form-input" type="number" min={1} max={100} value={passPercent}
            onChange={(e) => setPassPercent(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 70)))}
            style={{ width: 80 }} />
        </label>
      </div>

      <button
        className="btn btn--primary"
        onClick={handleGenerate}
        disabled={loading || !courseId}
        style={{ alignSelf: "flex-start", minWidth: 160 }}
      >
        {loading ? "Generating…" : "Generate ✨"}
      </button>

      {error && <ErrorBanner message={error} />}

      {result && <AssessmentResult result={result} loading={loading} onPublish={handlePublish} />}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      background: "rgba(239,68,68,0.1)", color: "var(--error)",
      padding: "var(--space-3)", borderRadius: "var(--radius-md)",
      fontSize: "var(--text-sm)", border: "1px solid rgba(239,68,68,0.2)",
    }}>
      ⚠️ {message}
    </div>
  );
}

function PublishBadge({ status, loading, onPublish }: { status: string; loading: boolean; onPublish: () => void }) {
  if (status === "published") {
    return (
      <span style={{
        background: "rgba(34,197,94,0.15)", color: "var(--success)",
        padding: "var(--space-1) var(--space-3)", borderRadius: "var(--radius-full)",
        fontSize: "var(--text-xs)", fontWeight: 700,
      }}>✓ Published</span>
    );
  }
  return (
    <button className="btn btn--secondary" onClick={onPublish} disabled={loading}>
      {loading ? "Publishing…" : "Publish to Students"}
    </button>
  );
}

function FlashcardResult({
  result, loading, onPublish,
}: { result: AIFlashcardGenerateResponse; loading: boolean; onPublish: () => void }) {
  return (
    <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--border-light)", paddingTop: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <div>
          <h4 style={{ fontWeight: 700, color: "var(--success)", marginBottom: 2 }}>✅ {result.title}</h4>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            {result.cards.length} card{result.cards.length !== 1 ? "s" : ""} · {result.status === "draft" ? "Draft — review before publishing" : "Published"}
          </span>
        </div>
        <PublishBadge status={result.status} loading={loading} onPublish={onPublish} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: 420, overflowY: "auto" }}>
        {result.cards.map((card, idx) => (
          <div key={idx} style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--bg-elevated)", borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-light)",
          }}>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Front</div>
              <div style={{ fontSize: "var(--text-sm)" }}>{card.front}</div>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Back</div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{card.back}</div>
            </div>
            {card.hint && (
              <div style={{ gridColumn: "1 / -1", fontSize: "var(--text-xs)", color: "var(--saffron)" }}>
                💡 {card.hint}
              </div>
            )}
          </div>
        ))}
      </div>

      {result.status === "draft" && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-3)" }}>
          {result.message}
        </p>
      )}
    </div>
  );
}

function AssessmentResult({
  result, loading, onPublish,
}: { result: AIAssessmentGenerateResponse; loading: boolean; onPublish: () => void }) {
  return (
    <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--border-light)", paddingTop: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <div>
          <h4 style={{ fontWeight: 700, color: "var(--success)", marginBottom: 2 }}>✅ {result.title}</h4>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            {result.questions.length} questions · {result.total_marks} marks · Pass: {result.pass_marks} marks
          </span>
        </div>
        <PublishBadge status={result.status} loading={loading} onPublish={onPublish} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", maxHeight: 480, overflowY: "auto" }}>
        {result.questions.map((q, idx) => (
          <div key={idx} style={{
            padding: "var(--space-4)", background: "var(--bg-elevated)",
            borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)",
          }}>
            <div style={{ fontWeight: 600, marginBottom: "var(--space-2)", fontSize: "var(--text-sm)" }}>
              Q{idx + 1}: {q.text}
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
              {q.options.map((opt, oIdx) => (
                <li key={oIdx} style={{
                  fontSize: "var(--text-sm)",
                  padding: "var(--space-1) var(--space-2)",
                  borderRadius: "var(--radius-sm)",
                  background: opt.is_correct ? "rgba(34,197,94,0.12)" : "transparent",
                  color: opt.is_correct ? "var(--success)" : "var(--ink-muted)",
                  fontWeight: opt.is_correct ? 600 : 400,
                  display: "flex", alignItems: "center", gap: "var(--space-2)",
                }}>
                  <span>{String.fromCharCode(65 + oIdx)}.</span>
                  <span>{opt.text}</span>
                  {opt.is_correct && <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)" }}>✓ correct</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {result.status === "draft" && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-3)" }}>
          {result.message}
        </p>
      )}
    </div>
  );
}
