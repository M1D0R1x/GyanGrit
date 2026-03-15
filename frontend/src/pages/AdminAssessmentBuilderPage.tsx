import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPatch } from "../services/api";
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
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState<AssessmentItem | null>(null);
  const [questions, setQuestions] = useState<ExistingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Assessment form
  const [aTitle, setATitle] = useState("");
  const [aDesc, setADesc] = useState("");
  const [aPassMarks, setAPassMarks] = useState(3);
  const [aPublished, setAPublished] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);

  // New question form
  const [showQForm, setShowQForm] = useState(false);
  const [qDraft, setQDraft] = useState<QuestionDraft>(BLANK_QUESTION());
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
        const isNotFound =
          err instanceof Error && err.message.includes("404");
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
    if (!aTitle.trim()) {
      setError("Assessment title is required.");
      return;
    }
    setSavingAssessment(true);
    setError(null);

    try {
      if (assessment) {
        await apiPatch(`/assessments/${assessment.id}/update/`, {
          title: aTitle,
          description: aDesc,
          pass_marks: aPassMarks,
          is_published: aPublished,
        });
        setAssessment((prev) =>
          prev
            ? {
                ...prev,
                title: aTitle,
                description: aDesc,
                pass_marks: aPassMarks,
                is_published: aPublished,
              }
            : null
        );
        setSuccess("Assessment updated.");
      } else {
        const created = await apiPost<AssessmentItem>(
          `/assessments/course/${numericCourseId}/create/`,
          {
            title: aTitle,
            description: aDesc,
            pass_marks: aPassMarks,
            is_published: aPublished,
          }
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
    if (!assessment) {
      setError("Save the assessment first before adding questions.");
      return;
    }
    if (!qDraft.text.trim()) {
      setError("Question text is required.");
      return;
    }
    const correctCount = qDraft.options.filter((o) => o.is_correct).length;
    if (correctCount !== 1) {
      setError("Exactly one correct answer must be selected.");
      return;
    }
    const emptyOptions = qDraft.options.filter((o) => !o.text.trim());
    if (emptyOptions.length > 0) {
      setError("All option fields must be filled.");
      return;
    }

    setSavingQuestion(true);
    setError(null);

    try {
      const created = await apiPost<ExistingQuestion>(
        `/assessments/${assessment.id}/questions/create/`,
        {
          text: qDraft.text,
          marks: qDraft.marks,
          options: qDraft.options,
        }
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

  const updateOption = (
    optIdx: number,
    field: keyof OptionDraft,
    value: string | boolean
  ) => {
    setQDraft((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => {
        if (field === "is_correct" && value === true && i !== optIdx) {
          return { ...o, is_correct: false };
        }
        if (i === optIdx) {
          return { ...o, [field]: value };
        }
        return o;
      }),
    }));
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (!confirm("Delete this question?")) return;
    try {
      await apiPost(`/assessments/questions/${questionId}/delete/`, {});
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

        <button
          className="back-btn"
          onClick={() =>
            navigate(`/admin/content/courses/${courseId}/lessons`)
          }
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Lessons
        </button>

        {error && <div className="alert alert--error">{error}</div>}
        {success && <div className="alert alert--success">{success}</div>}

        {loading ? (
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{
                  height: 52,
                  borderRadius: "var(--radius-md)",
                  marginBottom: "var(--space-3)",
                }}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Assessment metadata */}
            <div className="section-header">
              <h2 className="section-header__title">
                {assessment ? "Assessment Settings" : "Create Assessment"}
              </h2>
            </div>

            <div className="card" style={{ marginBottom: "var(--space-6)" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="a-title">
                  Assessment Title *
                </label>
                <input
                  id="a-title"
                  className="form-input"
                  placeholder="e.g. Chapter 1 Quiz"
                  value={aTitle}
                  onChange={(e) => setATitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="a-desc">
                  Description
                </label>
                <textarea
                  id="a-desc"
                  className="form-input"
                  placeholder="Brief description of what this assessment covers"
                  value={aDesc}
                  onChange={(e) => setADesc(e.target.value)}
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--space-4)",
                }}
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="pass-marks">
                    Pass Marks
                  </label>
                  <input
                    id="pass-marks"
                    className="form-input"
                    type="number"
                    min={0}
                    value={aPassMarks}
                    onChange={(e) => setAPassMarks(Number(e.target.value))}
                  />
                </div>
                <div
                  className="form-group"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      cursor: "pointer",
                      paddingBottom: "var(--space-3)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={aPublished}
                      onChange={(e) => setAPublished(e.target.checked)}
                      style={{
                        width: 18,
                        height: 18,
                        accentColor: "var(--brand-primary)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "var(--text-sm)",
                        color: aPublished ? "var(--success)" : "var(--text-muted)",
                      }}
                    >
                      {aPublished ? "Published" : "Draft"}
                    </span>
                  </label>
                </div>
              </div>

              {assessment && (
                <div
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    background: "var(--bg-elevated)",
                    borderRadius: "var(--radius-sm)",
                    marginBottom: "var(--space-4)",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-muted)",
                    display: "flex",
                    gap: "var(--space-6)",
                  }}
                >
                  <span>
                    Total marks:{" "}
                    <strong style={{ color: "var(--text-primary)" }}>
                      {assessment.total_marks}
                    </strong>
                  </span>
                  <span>
                    Questions:{" "}
                    <strong style={{ color: "var(--text-primary)" }}>
                      {questions.length}
                    </strong>
                  </span>
                  <span>
                    Pass:{" "}
                    <strong style={{ color: "var(--success)" }}>
                      {aPassMarks}
                    </strong>
                  </span>
                </div>
              )}

              <button
                className="btn btn--primary"
                onClick={() => void handleSaveAssessment()}
                disabled={savingAssessment}
              >
                {savingAssessment ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" /> Saving…
                  </>
                ) : assessment ? (
                  "Update Assessment"
                ) : (
                  "Create Assessment"
                )}
              </button>
            </div>

            {/* Questions */}
            {assessment && (
              <>
                <div className="section-header">
                  <h3 className="section-header__title">
                    Questions ({questions.length})
                  </h3>
                  {!showQForm && (
                    <button
                      className="btn btn--secondary"
                      onClick={() => setShowQForm(true)}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add Question
                    </button>
                  )}
                </div>

                {/* Existing questions */}
                {questions.length === 0 && !showQForm ? (
                  <div className="empty-state" style={{ padding: "var(--space-8)" }}>
                    <div className="empty-state__icon">❓</div>
                    <h3 className="empty-state__title">No questions yet</h3>
                    <p className="empty-state__message">
                      Add questions to this assessment.
                    </p>
                    <button
                      className="btn btn--primary"
                      onClick={() => setShowQForm(true)}
                    >
                      Add First Question
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-3)",
                      marginBottom: "var(--space-6)",
                    }}
                  >
                    {questions.map((q, i) => (
                      <div
                        key={q.id}
                        className="card page-enter"
                        style={{ animationDelay: `${i * 50}ms` }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "var(--space-3)",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "var(--text-xs)",
                                color: "var(--brand-primary)",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                marginBottom: "var(--space-1)",
                              }}
                            >
                              Q{q.order} · {q.marks}{" "}
                              {q.marks === 1 ? "mark" : "marks"}
                            </div>
                            <div
                              style={{
                                fontWeight: 600,
                                color: "var(--text-primary)",
                                fontSize: "var(--text-sm)",
                              }}
                            >
                              {q.text}
                            </div>
                          </div>
                          <button
                            className="btn btn--ghost"
                            style={{
                              padding: "var(--space-1) var(--space-2)",
                              color: "var(--error)",
                              fontSize: "var(--text-xs)",
                              flexShrink: 0,
                            }}
                            onClick={() => void handleDeleteQuestion(q.id)}
                          >
                            Delete
                          </button>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "var(--space-2)",
                          }}
                        >
                          {q.options.map((opt) => (
                            <div
                              key={opt.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-2)",
                                padding: "var(--space-2) var(--space-3)",
                                borderRadius: "var(--radius-sm)",
                                background: opt.is_correct
                                  ? "rgba(63,185,80,0.08)"
                                  : "var(--bg-elevated)",
                                border: `1px solid ${
                                  opt.is_correct
                                    ? "rgba(63,185,80,0.3)"
                                    : "var(--border-subtle)"
                                }`,
                                fontSize: "var(--text-sm)",
                                color: opt.is_correct
                                  ? "var(--success)"
                                  : "var(--text-secondary)",
                              }}
                            >
                              {opt.is_correct && (
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                              {opt.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* New question form */}
                {showQForm && (
                  <div className="card" style={{ marginBottom: "var(--space-6)" }}>
                    <h4
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--text-base)",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        marginBottom: "var(--space-4)",
                      }}
                    >
                      New Question
                    </h4>

                    <div className="form-group">
                      <label className="form-label">Question Text *</label>
                      <textarea
                        className="form-input"
                        placeholder="Enter the question..."
                        value={qDraft.text}
                        onChange={(e) =>
                          setQDraft((p) => ({ ...p, text: e.target.value }))
                        }
                        rows={3}
                        style={{ resize: "vertical" }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Marks</label>
                      <input
                        className="form-input"
                        type="number"
                        min={1}
                        value={qDraft.marks}
                        onChange={(e) =>
                          setQDraft((p) => ({
                            ...p,
                            marks: Number(e.target.value),
                          }))
                        }
                        style={{ maxWidth: 120 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Options
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontWeight: 400,
                            marginLeft: "var(--space-2)",
                          }}
                        >
                          — select exactly one correct answer
                        </span>
                      </label>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "var(--space-2)",
                        }}
                      >
                        {qDraft.options.map((opt, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              gap: "var(--space-3)",
                              alignItems: "center",
                            }}
                          >
                            <input
                              type="radio"
                              name="correct-option"
                              checked={opt.is_correct}
                              onChange={() => updateOption(i, "is_correct", true)}
                              style={{
                                width: 16,
                                height: 16,
                                accentColor: "var(--success)",
                                flexShrink: 0,
                                cursor: "pointer",
                              }}
                              title="Mark as correct answer"
                            />
                            <input
                              className="form-input"
                              type="text"
                              placeholder={`Option ${i + 1}`}
                              value={opt.text}
                              onChange={(e) =>
                                updateOption(i, "text", e.target.value)
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--text-muted)",
                          marginTop: "var(--space-2)",
                        }}
                      >
                        Click the radio button to mark the correct answer
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-3)" }}>
                      <button
                        className="btn btn--primary"
                        onClick={() => void handleAddQuestion()}
                        disabled={savingQuestion}
                      >
                        {savingQuestion ? (
                          <>
                            <span className="btn__spinner" aria-hidden="true" />{" "}
                            Adding…
                          </>
                        ) : (
                          "Add Question"
                        )}
                      </button>
                      <button
                        className="btn btn--secondary"
                        onClick={() => {
                          setShowQForm(false);
                          setQDraft(BLANK_QUESTION());
                        }}
                        disabled={savingQuestion}
                      >
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