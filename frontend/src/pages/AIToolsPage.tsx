// pages/AIToolsPage.tsx
import { useState } from "react";
import { generateAIFlashcards, generateAIAssessment, publishAIFlashcardDeck } from "../services/aiTools";
import { updateAssessment } from "../services/assessments";
import type { AIFlashcardGenerateResponse, AIAssessmentGenerateResponse } from "../services/aiTools";

export default function AIToolsPage() {
  const [activeTab, setActiveTab] = useState<"flashcards" | "assessments">("flashcards");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <header style={{ marginBottom: "var(--space-8)", textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-4xl)", fontWeight: 800, textShadow: "0 2px 10px rgba(0,0,0,0.2)" }}>
          AI Course Tools ✨
        </h1>
        <p style={{ color: "var(--ink-muted)", marginTop: "var(--space-2)" }}>
          Generate high-quality study materials instantly from your curriculum.
        </p>
      </header>

      <div className="tabs" style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
        <button 
          className={`btn ${activeTab === "flashcards" ? "btn--primary" : "btn--secondary"}`} 
          onClick={() => setActiveTab("flashcards")}
          style={{ flex: 1 }}
        >
          🃏 Flashcards
        </button>
        <button 
          className={`btn ${activeTab === "assessments" ? "btn--primary" : "btn--secondary"}`} 
          onClick={() => setActiveTab("assessments")}
          style={{ flex: 1 }}
        >
          📝 Assessments
        </button>
      </div>

      <div className="card glass-panel page-enter">
        {activeTab === "flashcards" ? <FlashcardGeneratorTab /> : <AssessmentGeneratorTab />}
      </div>
    </div>
  );
}

function FlashcardGeneratorTab() {
  const [sourceType, setSourceType] = useState<"text" | "lesson">("text");
  const [text, setText] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AIFlashcardGenerateResponse | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const payload = sourceType === "text"
        ? { text, count }
        : { lesson_id: parseInt(lessonId, 10), count };
      const res = await generateAIFlashcards(payload);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to generate flashcards");
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
      alert("Deck published successfully!");
    } catch (err: any) {
      alert("Failed to publish: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <h3>Generate Flashcard Deck</h3>
      
      <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-2)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
          <input type="radio" checked={sourceType === "text"} onChange={() => setSourceType("text")} />
          Paste Text
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
          <input type="radio" checked={sourceType === "lesson"} onChange={() => setSourceType("lesson")} />
          From Lesson ID
        </label>
      </div>

      {sourceType === "text" ? (
        <textarea 
          className="input"
          rows={6} 
          placeholder="Paste syllabus or notes here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      ) : (
        <input 
          className="input"
          type="number" 
          placeholder="Enter Lesson ID"
          value={lessonId}
          onChange={(e) => setLessonId(e.target.value)}
        />
      )}

      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <label>Number of Cards:</label>
        <input 
          className="input"
          type="number" 
          min={1} max={30} 
          value={count} 
          onChange={(e) => setCount(parseInt(e.target.value, 10))}
          style={{ width: 100 }}
        />
      </div>

      <button className="btn btn--primary" onClick={handleGenerate} disabled={loading}>
        {loading ? "Generating..." : "Generate ✨"}
      </button>

      {error && <div style={{ color: "var(--error)", padding: "var(--space-2)" }}>{error}</div>}

      {result && (
        <div style={{ marginTop: "var(--space-6)", borderTop: "1px solid var(--border)", paddingTop: "var(--space-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
            <h4 style={{ color: "var(--success)" }}>✅ {result.title} Created</h4>
            {result.status === "draft" && (
              <button className="btn btn--secondary" onClick={handlePublish} disabled={loading}>
                Publish to Students
              </button>
            )}
            {result.status === "published" && (
              <span style={{ color: "var(--success)", fontWeight: "bold" }}>Published!</span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", maxHeight: 400, overflowY: "auto" }}>
            {result.cards.map((card, idx) => (
              <div key={idx} style={{ padding: "var(--space-3)", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
                <strong>Q:</strong> {card.front} <br/>
                <strong>A:</strong> <span style={{ color: "var(--ink-muted)" }}>{card.back}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AssessmentGeneratorTab() {
  const [sourceType, setSourceType] = useState<"text" | "lesson">("text");
  const [text, setText] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [count, setCount] = useState(5);
  const [passPercent, setPassPercent] = useState(70);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AIAssessmentGenerateResponse | null>(null);

  const handleGenerate = async () => {
    if (!courseId) return setError("Course ID is required to bind the assessment.");
    const cId = parseInt(courseId, 10);
    if (isNaN(cId)) return setError("Invalid Course ID.");

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const payload = sourceType === "text"
        ? { text, count, pass_percent: passPercent }
        : { lesson_id: parseInt(lessonId, 10), count, pass_percent: passPercent };
      const res = await generateAIAssessment(cId, payload);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to generate assessment");
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
      alert("Assessment published successfully!");
    } catch (err: any) {
      alert("Failed to publish: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <h3>Generate MCQ Assessment</h3>
      
      <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-2)" }}>
        <input 
          className="input"
          type="number" 
          placeholder="Required: Course ID"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          style={{ maxWidth: 200 }}
        />
      </div>

      <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-2)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
          <input type="radio" checked={sourceType === "text"} onChange={() => setSourceType("text")} />
          Paste Text
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
          <input type="radio" checked={sourceType === "lesson"} onChange={() => setSourceType("lesson")} />
          From Lesson ID
        </label>
      </div>

      {sourceType === "text" ? (
        <textarea 
          className="input"
          rows={6} 
          placeholder="Paste lesson material here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      ) : (
        <input 
          className="input"
          type="number" 
          placeholder="Enter Lesson ID"
          value={lessonId}
          onChange={(e) => setLessonId(e.target.value)}
        />
      )}

      <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          Question Count:
          <input className="input" type="number" min={1} max={20} value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))} style={{ width: 80 }} />
        </label>
        <label style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          Pass %:
          <input className="input" type="number" min={1} max={100} value={passPercent} onChange={(e) => setPassPercent(parseInt(e.target.value, 10))} style={{ width: 80 }} />
        </label>
      </div>

      <button className="btn btn--primary" onClick={handleGenerate} disabled={loading}>
        {loading ? "Generating..." : "Generate ✨"}
      </button>

      {error && <div style={{ color: "var(--error)", padding: "var(--space-2)" }}>{error}</div>}

      {result && (
        <div style={{ marginTop: "var(--space-6)", borderTop: "1px solid var(--border)", paddingTop: "var(--space-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
            <h4 style={{ color: "var(--success)" }}>✅ {result.title} Created</h4>
            {result.status === "draft" && (
              <button className="btn btn--secondary" onClick={handlePublish} disabled={loading}>
                Publish to Students
              </button>
            )}
            {result.status === "published" && (
              <span style={{ color: "var(--success)", fontWeight: "bold" }}>Published!</span>
            )}
          </div>

          <p style={{ fontSize: "14px", color: "var(--ink-muted)", marginBottom: "var(--space-4)" }}>
            Total Marks: {result.total_marks} | Pass Marks: {result.pass_marks}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", maxHeight: 400, overflowY: "auto" }}>
            {result.questions.map((q, idx) => (
              <div key={idx} style={{ padding: "var(--space-3)", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
                <strong>Q{idx+1}:</strong> {q.text} <br/>
                <ul style={{ margin: "10px 0 0 20px", padding: 0 }}>
                  {q.options.map((o, oIdx) => (
                    <li key={oIdx} style={{ color: o.is_correct ? "var(--success)" : "var(--ink-primary)", fontWeight: o.is_correct ? "bold" : "normal" }}>
                      {o.text} {o.is_correct && "✓"}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
