// pages.AdminAssessmentBuilderPage
// BUG FIX 2026-03-22:
// Back button was hardcoded to /admin/content/courses/:id/lessons.
// This breaks when TEACHER (/teacher/courses/:id/assessments) or
// PRINCIPAL (/principal/courses/:id/assessments) access this page.
// Fixed: useLocation to detect URL prefix and build the correct back path.
import { apiGet, apiPost, apiPatch, apiDelete } from "../services/api";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import TopBar from "../components/TopBar";

type AssessmentItem = {
  id: number;
  title: string;
  description: string;
  total_marks: number;
  pass_marks: number;
  is_published: boolean;
};

type OptionDraft = {
  text: string;
  is_correct: boolean;
};

type QuestionDraft = {
  text: string;
  marks: number;
  options: OptionDraft[];
};

type ExistingQuestion = {
  id: number;
  text: string;
  marks: number;
  order: number;
  options: { id: number; text: string; is_correct: boolean }[];
};

const BLANK_OPTION = (): OptionDraft => ({ text: "", is_correct: false });
const BLANK_QUESTION = (): QuestionDraft => ({
  text: "",
  marks: 1,
  options: [BLANK_OPTION(), BLANK_OPTION(), BLANK_OPTION(), BLANK_OPTION()],
});

function parseApiError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const jsonStart = err.message.indexOf("{");
  if (jsonStart !== -1) {
    try {
      const payload = JSON.parse(err.message.slice(jsonStart)) as Record<string, unknown>;
      if (typeof payload.error === "string") return payload.error;
    } catch {
      // JSON parse failed — fall through to fallback
    }
  }
  return fallback;
}

export default function AdminAssessmentBuilderPage() {
  const { courseId } = useParams();
  const navigate     = useNavigate();
  const location     = useLocation();

  // Detect which role namespace we're under so the back link stays correct.
  // /teacher/courses/:id/assessments  → back to /teacher/courses/:id/lessons
  // /principal/courses/:id/assessments → back to /principal/courses/:id/lessons
  // /admin/content/courses/:id/assessments → back to /admin/content/courses/:id/lessons
  const backPath = location.pathname.startsWith("/teacher")
    ? `/teacher/courses/${courseId}/lessons`
    : location.pathname.startsWith("/principal")
    ? `/principal/courses/${courseId}/lessons`
    : `/admin/content/courses/${courseId}/lessons`;

  const [assessment, setAssessment] = useState<AssessmentItem | null>(null);
  const [questions, setQuestions]   = useState<ExistingQuestion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);

  // Assessment form
  const [aTitle,     setATitle]     = useState("");
  const [aDesc,      setADesc]      = useState("");
  const [aPassMarks, setAPassMarks] = useState(3);
  const [aPublished, setAPublished] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);

  // New question form
  const [showQForm,      setShowQForm]      = useState(false);
  const [qDraft,         setQDraft]         = useState<QuestionDraft>(BLANK_QUESTION());
  const [savingQuestion, setSavingQuestion] = useState(false);

  const numericCourseId = Number(courseId);

  useEffect(() => {
    if (!courseId) return;

    async function load() {
      try {
        const assessments = await apiGet<AssessmentItem[]>(
          `/assessments/course/${numericCourseId}/`
        );
        if (assessments.length > 0) {
          const a = assessments[0];
          setAssessment(a);
          setATitle(a.title);
          setADesc(a.description);
          setAPassMarks(a.pass_marks);
          setAPublished(a.is_published);

          // Admin view — includes is_correct for the builder
          const detail = await apiGet<{ questions: ExistingQuestion[] }>(
            `/assessments/${a.id}/admin/`
          );
          setQuestions(detail.questions);
        }
      } catch (err: unknown) {
        // 404 is expected when no assessment exists yet — only surface real errors
        const isNotFound = err instanceof Error && err.message.includes("404");
        if (!isNotFound) {
          setError("Failed to load assessment data.");
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [courseId, numericCourseId]);

  const handleSaveAssessment = async () => {
    if (!aTitle.trim()) { setError("Assessment title is required."); return; }
    setSavingAssessment(true);
    setError(null);

    try {
      if (assessment) {
        await apiPatch(`/assessments/${assessment.id}/update/`, {
          title: aTitle, description: aDesc,
          pass_marks: aPassMarks, is_published: aPublished,
        });
        setAssessment((prev) =>
          prev ? { ...prev, title: aTitle, description: aDesc, pass_marks: aPassMarks, is_published: aPublished } : null
        );
        setSuccess("Assessment updated.");
      } else {
        const created = await apiPost<AssessmentItem>(
          `/assessments/course/${numericCourseId}/create/`,
          { title: aTitle, description: aDesc, pass_marks: aPassMarks, is_published: aPublished }
        );
        setAssessment(created);
        setSuccess("Assessment created.");
      }
    } catch (err: unknown) {
      setError(parseApiError(err, "Failed to save assessment."));
    } finally {
      setSavingAssessment(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!assessment) { setError("Save the assessment first before adding questions."); return; }
    if (!qDraft.text.trim()) { setError("Question text is required."); return; }
    const correctCount = qDraft.options.filter((o) => o.is_correct).length;
    if (correctCount !== 1) { setError("Exactly one correct answer must be selected."); return; }
    const emptyOptions = qDraft.options.filter((o) => !o.text.trim());
    if (emptyOptions.length > 0) { setError("All option fields must be filled."); return; }

    setSavingQuestion(true);
    setError(null);

    try {
      const created = await apiPost<ExistingQuestion>(
        `/assessments/${assessment.id}/questions/create/`,
        { text: qDraft.text, marks: qDraft.marks, options: qDraft.options }
      );
      setQuestions((prev) => [...prev, created]);
      setQDraft(BLANK_QUESTION());
      setShowQForm(false);
      setSuccess("Question added.");
    } catch (err: unknown) {
      setError(parseApiError(err, "Failed to add question."));
    } finally {
      setSavingQuestion(false);
    }
  };

  const updateOption = (optIdx: number, field: keyof OptionDraft, value: string | boolean) => {
    setQDraft((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => {
        if (field === "is_correct" && value === true && i !== optIdx) return { ...o, is_correct: false };
        if (i === optIdx) return { ...o, [field]: value };
        return o;
      }),
    }));
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (!confirm("Delete this question?")) return;
    try {
      await apiDelete(`/assessments/questions/${questionId}/delete/`);
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setSuccess("Question deleted.");
    } catch (err: unknown) {
      setError(parseApiError(err, "Failed to delete question."));
    }
  };

  return (
    <div className="page-shell">
      <TopBar title="Assessment Builder" />
      <main className="page-content page-content--narrow page-enter">

        {/* Back button — uses detected role prefix, not hardcoded /admin path */}
        <button className="back-btn" onClick={() => navigate(backPath)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Lessons
        </button>

        {error   && <div className="alert alert--error">{error}</div>}
        {success && <div className="alert alert--success">{success}</div>}

        {loading ? (
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton"
                style={{ height: 52, borderRadius: "var(--radius-md)", marginBottom: "var(--space-3)" }}
              />
            ))}
          </div>
        ) : (
          <>
            {/* ── Assessment meta form ─────────────────────────────── */}
            <div className="section-header">
              <h2 className="section-header__title">
                {assessment ? "Edit Assessment" : "Create Assessment"}
              </h2>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="a-title">Title *</label>
              <input id="a-title" className="form-input" type="text"
                placeholder="e.g. Chapter 1 Quiz"
                value={aTitle} onChange={(e) => setATitle(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="a-desc">Description</label>
              <textarea id="a-desc" className="form-input" rows={3}
                placeholder="Instructions for students…"
                value={aDesc} onChange={(e) => setADesc(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="a-pass">Passing Marks</label>
              <input id="a-pass" className="form-input" type="number" min={1}
                value={aPassMarks} onChange={(e) => setAPassMarks(Number(e.target.value))} />
              {assessment && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                  Total marks (auto): {assessment.total_marks}
                </div>
              )}
            </div>

            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "var(--space-4)", background: "var(--bg-elevated)",
              borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)",
              marginBottom: "var(--space-6)",
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                  Publish assessment
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                  Students can attempt it once published
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                <input type="checkbox" checked={aPublished}
                  onChange={(e) => setAPublished(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--brand-primary)", cursor: "pointer" }} />
                <span style={{ fontSize: "var(--text-sm)", color: aPublished ? "var(--success)" : "var(--text-muted)" }}>
                  {aPublished ? "Published" : "Draft"}
                </span>
              </label>
            </div>

            <button className="btn btn--primary" onClick={() => void handleSaveAssessment()} disabled={savingAssessment}>
              {savingAssessment
                ? <><span className="btn__spinner" aria-hidden="true" /> Saving…</>
                : assessment ? "Update Assessment" : "Create Assessment"}
            </button>

            {/* ── Questions ─────────────────────────────────────────── */}
            {assessment && (
              <>
                <div className="section-header" style={{ marginTop: "var(--space-10)" }}>
                  <div>
                    <h2 className="section-header__title">Questions</h2>
                    <p className="section-header__subtitle">
                      {questions.length} question{questions.length !== 1 ? "s" : ""} · {assessment.total_marks} total marks
                    </p>
                  </div>
                  {!showQForm && (
                    <button className="btn btn--primary" onClick={() => setShowQForm(true)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        strokeLinejoin="round" aria-hidden="true">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add Question
                    </button>
                  )}
                </div>

                {/* Existing questions */}
                {questions.length === 0 && !showQForm && (
                  <div className="empty-state">
                    <div className="empty-state__icon">❓</div>
                    <h3 className="empty-state__title">No questions yet</h3>
                    <p className="empty-state__message">Add questions to build this assessment.</p>
                    <button className="btn btn--primary" onClick={() => setShowQForm(true)}>
                      Add First Question
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
                  {questions.map((q, i) => (
                    <div key={q.id} className="card page-enter" style={{ animationDelay: `${i * 40}ms` }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-4)" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                            <span style={{
                              background: "var(--brand-primary)", color: "#fff",
                              borderRadius: "var(--radius-full)", width: 22, height: 22,
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              fontSize: "var(--text-xs)", fontWeight: 700, flexShrink: 0,
                            }}>
                              {q.order}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                              {q.text}
                            </span>
                            <span className="badge badge--info" style={{ fontSize: 10, marginLeft: "auto", flexShrink: 0 }}>
                              {q.marks} mark{q.marks !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", paddingLeft: "var(--space-7)" }}>
                            {q.options.map((opt) => (
                              <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                                <span style={{ fontSize: 12, flexShrink: 0 }}>
                                  {opt.is_correct ? "✅" : "⬜"}
                                </span>
                                <span style={{
                                  fontSize: "var(--text-sm)",
                                  color: opt.is_correct ? "var(--success)" : "var(--text-secondary)",
                                  fontWeight: opt.is_correct ? 600 : 400,
                                }}>
                                  {opt.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <button
                          className="btn btn--ghost"
                          style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-xs)", color: "var(--error)", flexShrink: 0 }}
                          onClick={() => void handleDeleteQuestion(q.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* New question form */}
                {showQForm && (
                  <div className="card">
                    <h3 style={{
                      fontFamily: "var(--font-display)", fontWeight: 700,
                      fontSize: "var(--text-base)", color: "var(--text-primary)",
                      marginBottom: "var(--space-5)",
                    }}>
                      New Question
                    </h3>

                    <div className="form-group">
                      <label className="form-label">Question Text *</label>
                      <textarea className="form-input" rows={3}
                        placeholder="What is the capital of Punjab?"
                        value={qDraft.text}
                        onChange={(e) => setQDraft((prev) => ({ ...prev, text: e.target.value }))}
                        style={{ resize: "vertical" }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Marks</label>
                      <input className="form-input" type="number" min={1}
                        value={qDraft.marks}
                        onChange={(e) => setQDraft((prev) => ({ ...prev, marks: Number(e.target.value) }))}
                        style={{ maxWidth: 120 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Options
                        <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: "var(--space-2)" }}>
                          — select exactly one correct answer
                        </span>
                      </label>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        {qDraft.options.map((opt, i) => (
                          <div key={i} style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
                            <input type="radio" name="correct-option"
                              checked={opt.is_correct}
                              onChange={() => updateOption(i, "is_correct", true)}
                              style={{ width: 16, height: 16, accentColor: "var(--success)", flexShrink: 0, cursor: "pointer" }}
                              title="Mark as correct answer"
                            />
                            <input className="form-input" type="text"
                              placeholder={`Option ${i + 1}`}
                              value={opt.text}
                              onChange={(e) => updateOption(i, "text", e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
                        Click the radio button to mark the correct answer
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-3)" }}>
                      <button className="btn btn--primary"
                        onClick={() => void handleAddQuestion()} disabled={savingQuestion}>
                        {savingQuestion
                          ? <><span className="btn__spinner" aria-hidden="true" /> Adding…</>
                          : "Add Question"}
                      </button>
                      <button className="btn btn--secondary"
                        onClick={() => { setShowQForm(false); setQDraft(BLANK_QUESTION()); }}
                        disabled={savingQuestion}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
