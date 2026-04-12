// pages/AIToolsPage.tsx
// AI Teacher Tools — Generate flashcard decks and MCQ assessments using Groq AI.
// Accessible to: TEACHER, PRINCIPAL, ADMIN
//
// Cascading dropdowns: Subject → Course → Lesson (all role-scoped from API)
// No manual ID entry — everything is dropdown-driven.

import { useState, useEffect, useMemo } from "react";
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

type ApiCourse = {
  id: number;
  title: string;
  grade: number;
  subject__id: number;
  subject__name: string;
  is_core: boolean;
};

type ApiLesson = {
  id: number;
  title: string;
  order: number;
  has_video: boolean;
  has_pdf: boolean;
  has_content: boolean;
};

type Subject = { id: number; name: string };
type Course  = { id: number; title: string; grade: number; subject_id: number };
type Lesson  = { id: number; title: string; order: number };

// ── Data hook — loads subjects + courses once ─────────────────────────────────
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
        const subjectMap = new Map<number, string>();
        for (const a of assignments) subjectMap.set(a.subject_id, a.subject_name);
        setSubjects(Array.from(subjectMap.entries()).map(([id, name]) => ({ id, name })));
        setCourses(apiCourses.map((c) => ({ id: c.id, title: c.title, grade: c.grade, subject_id: c["subject__id"] })));
      })
      .catch(() => setError("Failed to load subjects and courses."))
      .finally(() => setLoading(false));
  }, []);

  return { subjects, courses, loading, error };
}

// ── Lesson loader — fetches when courseId changes ─────────────────────────────
function useLessons(courseId: number) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!courseId) { queueMicrotask(() => setLessons([])); return; }
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    apiGet<ApiLesson[]>(`/courses/${courseId}/lessons/`)
      .then((data) => { if (!cancelled) setLessons(data.map((l) => ({ id: l.id, title: l.title, order: l.order }))); })
      .catch(() => { if (!cancelled) setLessons([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  return { lessons, loading };
}

// ── Cascading picker: Subject → Course → Lesson ──────────────────────────────
function CascadingPicker({
  subjects, courses, showLessonPicker,
  subjectId, courseId, lessonId,
  onSubjectChange, onCourseChange, onLessonChange,
}: {
  subjects: Subject[];
  courses: Course[];
  showLessonPicker: boolean;
  subjectId: number;
  courseId: number;
  lessonId: number;
  onSubjectChange: (id: number) => void;
  onCourseChange: (id: number) => void;
  onLessonChange: (id: number) => void;
}) {
  const subjectCourses = useMemo(() => courses.filter((c) => c.subject_id === subjectId), [courses, subjectId]);
  const { lessons, loading: lessonsLoading } = useLessons(showLessonPicker ? courseId : 0);

  // Auto-select first course when subject changes
  useEffect(() => {
    const first = subjectCourses[0]?.id ?? 0;
    if (first !== courseId) onCourseChange(first);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  // Auto-select first lesson when course changes
  useEffect(() => {
    if (showLessonPicker && lessons.length > 0) onLessonChange(lessons[0].id);
    else if (showLessonPicker) onLessonChange(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons]);

  const cols = showLessonPicker ? "1fr 1fr 1fr" : "1fr 1fr";

  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: "var(--space-3)" }}>
      {/* Subject */}
      <div>
        <label className="form-label">Subject <span style={{ color: "var(--error)" }}>*</span></label>
        <select className="form-input" value={subjectId} onChange={(e) => onSubjectChange(+e.target.value)}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Course */}
      <div>
        <label className="form-label">Course <span style={{ color: "var(--error)" }}>*</span></label>
        {subjectCourses.length === 0 ? (
          <div className="form-input" style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>
            No courses for this subject
          </div>
        ) : (
          <select className="form-input" value={courseId} onChange={(e) => onCourseChange(+e.target.value)}>
            {subjectCourses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* Lesson (optional) */}
      {showLessonPicker && (
        <div>
          <label className="form-label">Lesson <span style={{ color: "var(--error)" }}>*</span></label>
          {lessonsLoading ? (
            <div className="form-input" style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>Loading lessons...</div>
          ) : lessons.length === 0 ? (
            <div className="form-input" style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>No lessons published</div>
          ) : (
            <select className="form-input" value={lessonId} onChange={(e) => onLessonChange(+e.target.value)}>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>{l.order}. {l.title}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────
export default function AIToolsPage() {
  const [activeTab, setActiveTab] = useState<"flashcards" | "assessments">("flashcards");
  const { subjects, courses, loading, error } = useTeacherData();

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <header style={{ marginBottom: "var(--space-8)", textAlign: "center" }}>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "var(--text-4xl)", fontWeight: 800,
          background: "linear-gradient(135deg, var(--brand-primary), var(--saffron))",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          AI Course Tools
        </h1>
        <p style={{ color: "var(--ink-muted)", marginTop: "var(--space-2)", fontSize: "var(--text-sm)" }}>
          Generate study materials from your curriculum using AI
        </p>
      </header>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
        {(["flashcards", "assessments"] as const).map((tab) => (
          <button key={tab} className={`btn ${activeTab === tab ? "btn--primary" : "btn--secondary"}`}
            onClick={() => setActiveTab(tab)} style={{ flex: 1 }}>
            {tab === "flashcards" ? "Flashcard Deck" : "MCQ Assessment"}
          </button>
        ))}
      </div>

      <div className="card glass-panel page-enter" style={{ padding: "var(--space-6)" }}>
        {loading ? (
          <div style={{ color: "var(--ink-muted)", textAlign: "center", padding: "var(--space-8)" }}>Loading your subjects...</div>
        ) : error ? (
          <div style={{ color: "var(--error)", textAlign: "center", padding: "var(--space-8)" }}>{error}</div>
        ) : subjects.length === 0 ? (
          <div style={{ color: "var(--ink-muted)", textAlign: "center", padding: "var(--space-8)", border: "1px dashed var(--border-light)", borderRadius: "var(--radius-md)" }}>
            <p style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>No subject assignments found</p>
            <p style={{ fontSize: "var(--text-xs)" }}>Contact admin to assign you to a section/subject first.</p>
          </div>
        ) : activeTab === "flashcards" ? (
          <FlashcardGeneratorTab subjects={subjects} courses={courses} />
        ) : (
          <AssessmentGeneratorTab subjects={subjects} courses={courses} />
        )}
      </div>
    </div>
  );
}

// ── Flashcard Generator Tab ───────────────────────────────────────────────────
function FlashcardGeneratorTab({ subjects, courses }: { subjects: Subject[]; courses: Course[] }) {
  const [sourceType, setSourceType] = useState<"text" | "lesson">("lesson");
  const [text, setText] = useState("");
  const [subjectId, setSubjectId] = useState<number>(subjects[0]?.id ?? 0);
  const [courseId, setCourseId] = useState<number>(0);
  const [lessonId, setLessonId] = useState<number>(0);
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AIFlashcardGenerateResponse | null>(null);

  const validate = (): string => {
    if (sourceType === "text" && !text.trim()) return "Paste text to generate cards from.";
    if (sourceType === "lesson" && !lessonId) return "Select a lesson.";
    return "";
  };

  const handleGenerate = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const payload = sourceType === "text"
        ? { text: text.trim(), subject_id: subjectId, count }
        : { lesson_id: lessonId, count };
      setResult(await generateAIFlashcards(payload));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed.");
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
      setError("Publish failed: " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Generate Flashcard Deck</h3>
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)", margin: 0 }}>
          AI creates Q&A pairs for spaced-repetition study. Review before publishing.
        </p>
      </div>

      {/* Source toggle */}
      <div style={{ display: "flex", gap: "var(--space-5)" }}>
        {(["lesson", "text"] as const).map((t) => (
          <label key={t} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", fontSize: "var(--text-sm)" }}>
            <input type="radio" name="fc-source" checked={sourceType === t} onChange={() => setSourceType(t)} />
            {t === "lesson" ? "From Lesson" : "Paste Text"}
          </label>
        ))}
      </div>

      {sourceType === "lesson" ? (
        <CascadingPicker
          subjects={subjects} courses={courses} showLessonPicker
          subjectId={subjectId} courseId={courseId} lessonId={lessonId}
          onSubjectChange={setSubjectId} onCourseChange={setCourseId} onLessonChange={setLessonId}
        />
      ) : (
        <>
          <CascadingPicker
            subjects={subjects} courses={courses} showLessonPicker={false}
            subjectId={subjectId} courseId={courseId} lessonId={0}
            onSubjectChange={setSubjectId} onCourseChange={setCourseId} onLessonChange={() => {}}
          />
          <textarea className="form-input" rows={6} placeholder="Paste chapter summary, notes, or curriculum text..."
            value={text} onChange={(e) => setText(e.target.value)} style={{ resize: "vertical", fontFamily: "inherit" }} />
        </>
      )}

      {/* Card count */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, whiteSpace: "nowrap" }}>Cards:</label>
        <input className="form-input" type="number" min={5} max={20} value={count}
          onChange={(e) => setCount(Math.max(5, Math.min(20, +e.target.value || 10)))} style={{ width: 80 }} />
        <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>5-20</span>
      </div>

      <button className="btn btn--primary" onClick={handleGenerate} disabled={loading} style={{ alignSelf: "flex-start", minWidth: 160 }}>
        {loading ? "Generating..." : "Generate"}
      </button>

      {error && <ErrorBanner message={error} />}
      {result && <FlashcardResult result={result} loading={loading} onPublish={handlePublish} />}
    </div>
  );
}

// ── Assessment Generator Tab ──────────────────────────────────────────────────
function AssessmentGeneratorTab({ subjects, courses }: { subjects: Subject[]; courses: Course[] }) {
  const [subjectId, setSubjectId] = useState<number>(subjects[0]?.id ?? 0);
  const [courseId, setCourseId] = useState<number>(0);
  const [lessonId, setLessonId] = useState<number>(0);
  const [sourceType, setSourceType] = useState<"text" | "lesson">("lesson");
  const [text, setText] = useState("");
  const [count, setCount] = useState(5);
  const [passPercent, setPassPercent] = useState(70);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AIAssessmentGenerateResponse | null>(null);

  const validate = (): string => {
    if (!courseId) return "Select a course.";
    if (sourceType === "text" && !text.trim()) return "Paste lesson material.";
    if (sourceType === "lesson" && !lessonId) return "Select a lesson.";
    return "";
  };

  const handleGenerate = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const payload = sourceType === "text"
        ? { text: text.trim(), count, pass_percent: passPercent }
        : { lesson_id: lessonId, count, pass_percent: passPercent };
      setResult(await generateAIAssessment(courseId, payload));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed.");
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
      setError("Publish failed: " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Generate MCQ Assessment</h3>
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)", margin: 0 }}>
          AI creates multiple-choice questions. Review and edit before publishing.
        </p>
      </div>

      {/* Source toggle */}
      <div style={{ display: "flex", gap: "var(--space-5)" }}>
        {(["lesson", "text"] as const).map((t) => (
          <label key={t} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", fontSize: "var(--text-sm)" }}>
            <input type="radio" name="as-source" checked={sourceType === t} onChange={() => setSourceType(t)} />
            {t === "lesson" ? "From Lesson" : "Paste Text"}
          </label>
        ))}
      </div>

      {sourceType === "lesson" ? (
        <CascadingPicker
          subjects={subjects} courses={courses} showLessonPicker
          subjectId={subjectId} courseId={courseId} lessonId={lessonId}
          onSubjectChange={setSubjectId} onCourseChange={setCourseId} onLessonChange={setLessonId}
        />
      ) : (
        <>
          <CascadingPicker
            subjects={subjects} courses={courses} showLessonPicker={false}
            subjectId={subjectId} courseId={courseId} lessonId={0}
            onSubjectChange={setSubjectId} onCourseChange={setCourseId} onLessonChange={() => {}}
          />
          <textarea className="form-input" rows={6} placeholder="Paste lesson content or notes..."
            value={text} onChange={(e) => setText(e.target.value)} style={{ resize: "vertical", fontFamily: "inherit" }} />
        </>
      )}

      {/* Options */}
      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", fontSize: "var(--text-sm)" }}>
          <span style={{ fontWeight: 600 }}>Questions:</span>
          <input className="form-input" type="number" min={5} max={20} value={count}
            onChange={(e) => setCount(Math.max(5, Math.min(20, +e.target.value || 5)))} style={{ width: 80 }} />
        </label>
        <label style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", fontSize: "var(--text-sm)" }}>
          <span style={{ fontWeight: 600 }}>Pass %:</span>
          <input className="form-input" type="number" min={1} max={100} value={passPercent}
            onChange={(e) => setPassPercent(Math.max(1, Math.min(100, +e.target.value || 70)))} style={{ width: 80 }} />
        </label>
      </div>

      <button className="btn btn--primary" onClick={handleGenerate} disabled={loading || !courseId}
        style={{ alignSelf: "flex-start", minWidth: 160 }}>
        {loading ? "Generating..." : "Generate"}
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
      {message}
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
      }}>Published</span>
    );
  }
  return (
    <button className="btn btn--secondary" onClick={onPublish} disabled={loading}>
      {loading ? "Publishing..." : "Publish to Students"}
    </button>
  );
}

function FlashcardResult({ result, loading, onPublish }: { result: AIFlashcardGenerateResponse; loading: boolean; onPublish: () => void }) {
  return (
    <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--border-light)", paddingTop: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <div>
          <h4 style={{ fontWeight: 700, color: "var(--success)", marginBottom: 2 }}>{result.title}</h4>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            {result.cards.length} cards &middot; {result.status === "draft" ? "Draft" : "Published"}
          </span>
        </div>
        <PublishBadge status={result.status} loading={loading} onPublish={onPublish} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: 420, overflowY: "auto" }}>
        {result.cards.map((card, idx) => (
          <div key={idx} style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)", background: "var(--bg-elevated)",
            borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)",
          }}>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Front</div>
              <div style={{ fontSize: "var(--text-sm)" }}>{card.front}</div>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Back</div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{card.back}</div>
            </div>
            {card.hint && <div style={{ gridColumn: "1 / -1", fontSize: "var(--text-xs)", color: "var(--saffron)" }}>{card.hint}</div>}
          </div>
        ))}
      </div>
      {result.status === "draft" && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-3)" }}>{result.message}</p>
      )}
    </div>
  );
}

function AssessmentResult({ result, loading, onPublish }: { result: AIAssessmentGenerateResponse; loading: boolean; onPublish: () => void }) {
  return (
    <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--border-light)", paddingTop: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <div>
          <h4 style={{ fontWeight: 700, color: "var(--success)", marginBottom: 2 }}>{result.title}</h4>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            {result.questions.length} questions &middot; {result.total_marks} marks &middot; Pass: {result.pass_marks}
          </span>
        </div>
        <PublishBadge status={result.status} loading={loading} onPublish={onPublish} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", maxHeight: 480, overflowY: "auto" }}>
        {result.questions.map((q, idx) => (
          <div key={idx} style={{ padding: "var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
            <div style={{ fontWeight: 600, marginBottom: "var(--space-2)", fontSize: "var(--text-sm)" }}>Q{idx + 1}: {q.text}</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
              {q.options.map((opt, oIdx) => (
                <li key={oIdx} style={{
                  fontSize: "var(--text-sm)", padding: "var(--space-1) var(--space-2)", borderRadius: "var(--radius-sm)",
                  background: opt.is_correct ? "rgba(34,197,94,0.12)" : "transparent",
                  color: opt.is_correct ? "var(--success)" : "var(--ink-muted)",
                  fontWeight: opt.is_correct ? 600 : 400, display: "flex", alignItems: "center", gap: "var(--space-2)",
                }}>
                  <span>{String.fromCharCode(65 + oIdx)}.</span>
                  <span>{opt.text}</span>
                  {opt.is_correct && <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)" }}>correct</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {result.status === "draft" && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-3)" }}>{result.message}</p>
      )}
    </div>
  );
}
