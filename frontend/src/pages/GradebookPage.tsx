// pages.GradebookPage
/**
 * Teacher/Principal gradebook for a specific classroom.
 * Route: /teacher/classes/:classId/gradebook
 *
 * Features:
 * - View all grade entries for the class, grouped by student
 * - Filter by term, subject, category
 * - Inline "Add mark" form per student row
 * - Edit / delete existing entries
 */
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getClassGrades,
  getGradeChoices,
  createGradeEntry,
  updateGradeEntry,
  deleteGradeEntry,
  type ClassGrades,
  type ClassGradeStudent,
  type GradeEntry,
  type GradeChoices,
  type GradeTerm,
  type GradeCategory,
  type CreateEntryPayload,
} from "../services/gradebook";
import { apiGet } from "../services/api";

type SubjectOption = { id: number; name: string };

// ── Helpers ───────────────────────────────────────────────────────────────

function pctColor(pct: number) {
  if (pct >= 70) return "var(--success)";
  if (pct >= 40) return "var(--warning)";
  return "var(--error)";
}

// ── Add/Edit mark modal ────────────────────────────────────────────────────

type EntryFormProps = {
  studentId:   number;
  studentName: string;
  subjects:    SubjectOption[];
  choices:     GradeChoices;
  existing?:   GradeEntry;        // present when editing
  onSave:      (entry: GradeEntry) => void;
  onClose:     () => void;
};

function EntryForm({
  studentId, studentName, subjects, choices,
  existing, onSave, onClose,
}: EntryFormProps) {
  const [subjectId,  setSubjectId]  = useState<number | "">(existing?.subject_id ?? "");
  const [term,       setTerm]       = useState<GradeTerm>(existing?.term ?? "term_1");
  const [category,   setCategory]   = useState<GradeCategory>(existing?.category ?? "unit_test");
  const [marks,      setMarks]      = useState(existing?.marks?.toString() ?? "");
  const [totalMarks, setTotalMarks] = useState(existing?.total_marks?.toString() ?? "");
  const [notes,      setNotes]      = useState(existing?.notes ?? "");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleSubmit() {
    if (!subjectId) { setError("Select a subject."); return; }
    const m  = parseFloat(marks);
    const tm = parseFloat(totalMarks);
    if (isNaN(m) || isNaN(tm)) { setError("Enter valid marks."); return; }
    if (tm <= 0)               { setError("Total marks must be > 0."); return; }
    if (m < 0 || m > tm)      { setError(`Marks must be 0–${tm}.`); return; }

    setSaving(true);
    setError(null);
    try {
      let saved: GradeEntry;
      if (existing) {
        saved = await updateGradeEntry(existing.id, { marks: m, total_marks: tm, term, category, notes });
      } else {
        const payload: CreateEntryPayload = {
          student_id: studentId, subject_id: Number(subjectId),
          marks: m, total_marks: tm, term, category, notes,
        };
        saved = await createGradeEntry(payload);
      }
      onSave(saved);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: "var(--space-4)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card page-enter" style={{ width: "100%", maxWidth: 460 }}>
        {/* Header */}
        <div className="section-header" style={{ marginBottom: "var(--space-5)" }}>
          <div>
            <h2 className="section-header__title">
              {existing ? "Edit Mark" : "Add Mark"}
            </h2>
            <p className="section-header__subtitle">{studentName}</p>
          </div>
          <button className="btn btn--ghost" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert--error" style={{ marginBottom: "var(--space-4)" }}>{error}</div>}

        {/* Subject */}
        {!existing && (
          <div className="form-group">
            <label className="form-label">Subject *</label>
            <select
              className="form-input"
              value={subjectId}
              onChange={(e) => setSubjectId(Number(e.target.value))}
            >
              <option value="">Select subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Term + Category row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <div className="form-group">
            <label className="form-label">Term</label>
            <select className="form-input" value={term} onChange={(e) => setTerm(e.target.value as GradeTerm)}>
              {choices.terms.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value as GradeCategory)}>
              {choices.categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Marks row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <div className="form-group">
            <label className="form-label">Marks Obtained *</label>
            <input
              className="form-input"
              type="number"
              min={0}
              step="0.5"
              placeholder="e.g. 18"
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Out Of *</label>
            <input
              className="form-input"
              type="number"
              min={1}
              step="0.5"
              placeholder="e.g. 25"
              value={totalMarks}
              onChange={(e) => setTotalMarks(e.target.value)}
            />
          </div>
        </div>

        {/* Live percentage preview */}
        {marks && totalMarks && !isNaN(parseFloat(marks)) && parseFloat(totalMarks) > 0 && (
          <div style={{
            padding: "var(--space-3) var(--space-4)",
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-4)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>Score</span>
            <span style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "var(--text-xl)",
              color: pctColor(Math.round(parseFloat(marks) / parseFloat(totalMarks) * 100)),
            }}>
              {Math.round(parseFloat(marks) / parseFloat(totalMarks) * 100)}%
            </span>
          </div>
        )}

        {/* Notes */}
        <div className="form-group">
          <label className="form-label">Notes (optional)</label>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Any remarks about this mark…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button className="btn btn--primary" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? <><span className="btn__spinner" aria-hidden="true" /> Saving…</> : (existing ? "Save Changes" : "Add Mark")}
          </button>
          <button className="btn btn--secondary" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Student grade row ─────────────────────────────────────────────────────

function StudentRow({
  student,
  subjects,
  choices,
  onEntryAdded,
  onEntryUpdated,
  onEntryDeleted,
}: {
  student:        ClassGradeStudent;
  subjects:       SubjectOption[];
  choices:        GradeChoices;
  onEntryAdded:   (studentId: number, entry: GradeEntry) => void;
  onEntryUpdated: (entry: GradeEntry) => void;
  onEntryDeleted: (entryId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<GradeEntry | null>(null);
  const [deleting, setDeleting]   = useState<number | null>(null);

  const avgPct = student.entries.length
    ? Math.round(student.entries.reduce((s, e) => s + e.percentage, 0) / student.entries.length)
    : null;

  async function handleDelete(entry: GradeEntry) {
    setDeleting(entry.id);
    try {
      await deleteGradeEntry(entry.id);
      onEntryDeleted(entry.id);
    } catch {
      // silently ignore — entry stays in list
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div style={{
      border: "1px solid var(--border-light)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
      marginBottom: "var(--space-3)",
    }}>
      {/* Student header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          padding: "var(--space-4) var(--space-5)",
          background: "var(--bg-elevated)",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-light)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-display)", fontWeight: 800,
          fontSize: "var(--text-xs)", color: "var(--ink-secondary)",
          flexShrink: 0,
        }}>
          {student.student.slice(0, 2).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--ink-primary)" }}>
            {student.student}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            @{student.username}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: "var(--space-5)", alignItems: "center", flexShrink: 0 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", color: "var(--ink-primary)" }}>
              {student.entries.length}
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-muted)" }}>marks</div>
          </div>
          {avgPct !== null && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", color: pctColor(avgPct) }}>
                {avgPct}%
              </div>
              <div style={{ fontSize: 10, color: "var(--ink-muted)" }}>avg</div>
            </div>
          )}
          <button
            className="btn btn--primary"
            style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-xs)" }}
            onClick={(e) => { e.stopPropagation(); setShowForm(true); }}
          >
            + Mark
          </button>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--ink-muted)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Entry list */}
      {expanded && (
        <div style={{ padding: "var(--space-4) var(--space-5)", background: "var(--bg-surface)" }}>
          {student.entries.length === 0 ? (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", textAlign: "center", padding: "var(--space-4) 0" }}>
              No marks entered yet.
            </p>
          ) : (
            <table className="data-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Term</th>
                  <th>Category</th>
                  <th>Score</th>
                  <th>%</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {student.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>{entry.subject}</td>
                    <td style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                      {entry.term.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </td>
                    <td style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                      {entry.category.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </td>
                    <td style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-sm)" }}>
                      {entry.marks}/{entry.total_marks}
                    </td>
                    <td>
                      <span style={{
                        fontFamily: "var(--font-display)", fontWeight: 800,
                        fontSize: "var(--text-sm)", color: pctColor(entry.percentage),
                      }}>
                        {entry.percentage}%
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "var(--space-2)" }}>
                        <button
                          className="btn btn--ghost"
                          style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}
                          onClick={() => setEditEntry(entry)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn--ghost"
                          style={{ fontSize: "var(--text-xs)", padding: "2px 8px", color: "var(--error)" }}
                          disabled={deleting === entry.id}
                          onClick={() => void handleDelete(entry)}
                        >
                          {deleting === entry.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add mark modal */}
      {showForm && (
        <EntryForm
          studentId={student.student_id}
          studentName={student.student}
          subjects={subjects}
          choices={choices}
          onSave={(entry) => { onEntryAdded(student.student_id, entry); setShowForm(false); }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Edit mark modal */}
      {editEntry && (
        <EntryForm
          studentId={student.student_id}
          studentName={student.student}
          subjects={subjects}
          choices={choices}
          existing={editEntry}
          onSave={(entry) => { onEntryUpdated(entry); setEditEntry(null); }}
          onClose={() => setEditEntry(null)}
        />
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function GradebookPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate    = useNavigate();

  const [data,      setData]      = useState<ClassGrades | null>(null);
  const [choices,   setChoices]   = useState<GradeChoices | null>(null);
  const [subjects,  setSubjects]  = useState<SubjectOption[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Filters
  const [filterTerm,    setFilterTerm]    = useState<GradeTerm | "">("");
  const [filterSubject, setFilterSubject] = useState<number | "">("");

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const [classData, choiceData, subjectData] = await Promise.all([
        getClassGrades(Number(classId), {
          term:       filterTerm     || undefined,
          subject_id: filterSubject  ? Number(filterSubject) : undefined,
        }),
        getGradeChoices(),
        apiGet<SubjectOption[]>("/academics/subjects/"),
      ]);
      setData(classData);
      setChoices(choiceData);
      setSubjects(subjectData);
    } catch {
      setError("Failed to load gradebook.");
    } finally {
      setLoading(false);
    }
  }, [classId, filterTerm, filterSubject]);

  useEffect(() => { void load(); }, [load]);

  // Optimistic state mutations — no full reload needed
  function handleEntryAdded(studentId: number, entry: GradeEntry) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        students: prev.students.map((s) =>
          s.student_id === studentId
            ? { ...s, entries: [entry, ...s.entries] }
            : s
        ),
      };
    });
  }

  function handleEntryUpdated(entry: GradeEntry) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        students: prev.students.map((s) => ({
          ...s,
          entries: s.entries.map((e) => (e.id === entry.id ? entry : e)),
        })),
      };
    });
  }

  function handleEntryDeleted(entryId: number) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        students: prev.students.map((s) => ({
          ...s,
          entries: s.entries.filter((e) => e.id !== entryId),
        })),
      };
    });
  }

  const totalEntries = data?.students.reduce((s, st) => s + st.entries.length, 0) ?? 0;

  return (
    <>

        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        {/* Header */}
        <div className="section-header">
          <div>
            <h2 className="section-header__title">
              {data ? `Class ${data.class_name} — Gradebook` : "Gradebook"}
            </h2>
            <p className="section-header__subtitle">
              {data
                ? `${data.students.length} students · ${totalEntries} mark entries`
                : "Manual marks for oral, practical, and project assessments"}
            </p>
          </div>
        </div>

        {/* Filters */}
        {choices && subjects.length > 0 && (
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
            <select
              className="form-input"
              style={{ width: "auto", minWidth: 140 }}
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value as GradeTerm | "")}
            >
              <option value="">All Terms</option>
              {choices.terms.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              className="form-input"
              style={{ width: "auto", minWidth: 160 }}
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {(filterTerm || filterSubject) && (
              <button
                className="btn btn--ghost"
                onClick={() => { setFilterTerm(""); setFilterSubject(""); }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {error && <div className="alert alert--error">{error}</div>}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 64, borderRadius: "var(--radius-lg)" }} />
            ))}
          </div>
        ) : !data || data.students.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📊</div>
            <h3 className="empty-state__title">No students in this class</h3>
            <p className="empty-state__message">
              Students will appear here once they are enrolled.
            </p>
          </div>
        ) : (
          <div>
            {data.students.map((student) => (
              choices && (
                <StudentRow
                  key={student.student_id}
                  student={student}
                  subjects={subjects}
                  choices={choices}
                  onEntryAdded={handleEntryAdded}
                  onEntryUpdated={handleEntryUpdated}
                  onEntryDeleted={handleEntryDeleted}
                />
              )
            ))}
          </div>
        )}
    </>
  );
}
