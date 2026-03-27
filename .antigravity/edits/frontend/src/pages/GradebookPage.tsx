import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
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

type SubjectOption = { id: number; name: string };

// ── Helpers ───────────────────────────────────────────────────────────────

const pctColor = (pct: number) => {
  if (pct >= 70) return "var(--role-student)";
  if (pct >= 40) return "var(--warning)";
  return "var(--error)";
};

// ── Add/Edit mark modal ────────────────────────────────────────────────────

const EntryForm: React.FC<{
  studentId:   number;
  studentName: string;
  subjects:    SubjectOption[];
  choices:     GradeChoices;
  existing?:   GradeEntry;
  onSave:      (entry: GradeEntry) => void;
  onClose:     () => void;
}> = ({ studentId, studentName, subjects, choices, existing, onSave, onClose }) => {
  const [subjectId,  setSubjectId]  = useState<number | "">(existing?.subject_id ?? "");
  const [term,       setTerm]       = useState<GradeTerm>(existing?.term ?? "term_1");
  const [category,   setCategory]   = useState<GradeCategory>(existing?.category ?? "unit_test");
  const [marks,      setMarks]      = useState(existing?.marks?.toString() ?? "");
  const [totalMarks, setTotalMarks] = useState(existing?.total_marks?.toString() ?? "");
  const [notes,      setNotes]      = useState(existing?.notes ?? "");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!subjectId) { setError("Select a curriculum subject node."); return; }
    const m = parseFloat(marks);
    const tm = parseFloat(totalMarks);
    if (isNaN(m) || isNaN(tm)) { setError("Enter valid telemetry marks."); return; }
    if (tm <= 0) { setError("Total marks must be > 0."); return; }
    if (m < 0 || m > tm) { setError(`Marks must be 0–${tm}.`); return; }

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
      setError("Protocol Error: Mark synchronization failure.");
    } finally {
      setSaving(false);
    }
  };

  const calculatedPct = marks && totalMarks && !isNaN(parseFloat(marks)) && parseFloat(totalMarks) > 0 ? Math.round(parseFloat(marks) / parseFloat(totalMarks) * 100) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div className="glass-card page-enter" style={{ width: '100%', maxWidth: '480px', padding: 'var(--space-8)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
           <div>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-primary)', letterSpacing: '0.1em', marginBottom: '4px' }}>MARK PROTOCOL: {studentName}</div>
              <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>{existing ? "EDIT EVALUATION" : "ADD EVALUATION"}</h2>
           </div>
           <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }} onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert--error" style={{ marginBottom: '20px' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
           {/* Subject */}
           {!existing && (
             <div>
                <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>SUBJECT NODE *</label>
                <select className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px' }} value={subjectId} onChange={e => setSubjectId(Number(e.target.value))}>
                   <option value="">Select subject...</option>
                   {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
             </div>
           )}

           {/* Term + Category row */}
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                 <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>TERM</label>
                 <select className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px' }} value={term} onChange={e => setTerm(e.target.value as any)}>
                    {choices.terms.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                 </select>
              </div>
              <div>
                 <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>CATEGORY</label>
                 <select className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px' }} value={category} onChange={e => setCategory(e.target.value as any)}>
                    {choices.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                 </select>
              </div>
           </div>

           {/* Marks row */}
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                 <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>OBTAINED MARKS *</label>
                 <input className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px' }} type="number" step="0.5" value={marks} onChange={e => setMarks(e.target.value)} />
              </div>
              <div>
                 <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>TOTAL MARKS *</label>
                 <input className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px' }} type="number" step="0.5" value={totalMarks} onChange={e => setTotalMarks(e.target.value)} />
              </div>
           </div>

           {/* Live percentage preview */}
           {calculatedPct !== null && (
             <div className="glass-card" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>TELEMETRY SCORE</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '24px', color: pctColor(calculatedPct) }}>{calculatedPct}%</span>
             </div>
           )}

           {/* Notes */}
           <div>
              <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>NOTES (REMARKS)</label>
              <textarea className="form-input" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', fontSize: '14px', resize: 'vertical' }} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Entry notes..." />
           </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
           <button className="btn--primary" style={{ flex: 1, padding: '16px', fontSize: '12px', letterSpacing: '0.1em' }} onClick={handleSubmit} disabled={saving}>
              {saving ? "SYNCING..." : (existing ? "SAVE EVAL" : "ADD EVAL")}
           </button>
           <button className="btn--ghost" style={{ padding: '16px', fontSize: '12px', letterSpacing: '0.1em' }} onClick={onClose} disabled={saving}>CANCEL</button>
        </div>
      </div>
    </div>
  );
};

// ── Student grade row ─────────────────────────────────────────────────────

const StudentRow: React.FC<{
  student: ClassGradeStudent;
  subjects: SubjectOption[];
  choices: GradeChoices;
  onEntryAdded: (studentId: number, entry: GradeEntry) => void;
  onEntryUpdated: (entry: GradeEntry) => void;
  onEntryDeleted: (entryId: number) => void;
}> = ({ student, subjects, choices, onEntryAdded, onEntryUpdated, onEntryDeleted }) => {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<GradeEntry | null>(null);
  const [deleting, setDeleting]   = useState<number | null>(null);

  const avgPct = student.entries.length
    ? Math.round(student.entries.reduce((s, e) => s + e.percentage, 0) / student.entries.length)
    : null;

  const handleDelete = async (entry: GradeEntry) => {
    if (!window.confirm(`NULLIFY mark entry for ${entry.subject}?`)) return;
    setDeleting(entry.id);
    try {
      await deleteGradeEntry(entry.id);
      onEntryDeleted(entry.id);
    } catch { } finally { setDeleting(null); }
  };

  return (
    <div className="glass-card page-enter" style={{ padding: 0, marginBottom: 'var(--space-4)', overflow: 'hidden' }}>
      {/* Student header row */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', cursor: 'pointer', background: expanded ? 'var(--bg-elevated)' : 'transparent', transition: 'background 0.2s' }} onClick={() => setExpanded(!expanded)}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Avatar */}
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900, color: 'var(--text-secondary)' }}>
               {student.student.slice(0, 2).toUpperCase()}
            </div>
            <div>
               <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>{student.student}</div>
               <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{student.username}</div>
            </div>
         </div>

         {/* Stats */}
         <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ textAlign: 'center' }}>
               <span style={{ display: 'block', fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{student.entries.length}</span>
               <span style={{ display: 'block', fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>EVALS</span>
            </div>
            {avgPct !== null && (
               <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '18px', fontWeight: 900, color: pctColor(avgPct) }}>{avgPct}%</span>
                  <span style={{ display: 'block', fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>AVG</span>
               </div>
            )}
            <button className="btn--primary" style={{ padding: '8px 16px', fontSize: '10px', letterSpacing: '0.1em' }} onClick={e => { e.stopPropagation(); setShowForm(true); }}>
               ➕ EVAL
            </button>
            <span style={{ color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
         </div>
      </header>

      {/* Entry list */}
      {expanded && (
        <section style={{ padding: '24px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}>
           {student.entries.length === 0 ? (
             <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '16px', filter: 'grayscale(1) opacity(0.5)' }}>🗄️</span>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No evaluation telemetry recorded for this node.</p>
             </div>
           ) : (
             <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: 'none', background: 'var(--bg-elevated)' }}>
               <table className="data-table">
                  <thead>
                     <tr>
                        <th>CURRICULUM NODE</th>
                        <th>TERM / CLASS</th>
                        <th>SCORE</th>
                        <th>SATURATION</th>
                        <th style={{ textAlign: 'right' }}>ACTIONS</th>
                     </tr>
                  </thead>
                  <tbody>
                     {student.entries.map((entry) => (
                       <tr key={entry.id}>
                          <td style={{ fontWeight: 800 }}>{entry.subject}</td>
                          <td>
                             <span style={{ fontSize: '10px', fontWeight: 800, padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', marginRight: '6px' }}>
                                {entry.term.replace("_", " ").toUpperCase()}
                             </span>
                             <span style={{ fontSize: '10px', fontWeight: 800, padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                                {entry.category.replace("_", " ").toUpperCase()}
                             </span>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px' }}>{entry.marks} <span style={{ color: 'var(--text-muted)' }}>/ {entry.total_marks}</span></td>
                          <td><span style={{ fontWeight: 800, color: pctColor(entry.percentage) }}>{entry.percentage}%</span></td>
                          <td style={{ textAlign: 'right' }}>
                             <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button className="btn--ghost" style={{ padding: '6px 12px', fontSize: '10px', letterSpacing: '0.1em' }} onClick={() => setEditEntry(entry)}>EDIT</button>
                                <button className="btn--ghost" style={{ padding: '6px 12px', fontSize: '10px', letterSpacing: '0.1em', color: 'var(--error)' }} onClick={() => handleDelete(entry)} disabled={deleting === entry.id}>
                                   {deleting === entry.id ? "NULLING..." : "TRASH"}
                                </button>
                             </div>
                          </td>
                       </tr>
                     ))}
                  </tbody>
               </table>
             </div>
           )}
        </section>
      )}

      {/* Add mark modal */}
      {showForm && (
        <EntryForm
          studentId={student.student_id}
          studentName={student.student}
          subjects={subjects}
          choices={choices}
          onSave={(e) => { onEntryAdded(student.student_id, e); setShowForm(false); }}
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
          onSave={(e) => { onEntryUpdated(e); setEditEntry(null); }}
          onClose={() => setEditEntry(null)}
        />
      )}
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────

const GradebookPage: React.FC = () => {
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
          term: filterTerm || undefined,
          subject_id: filterSubject ? Number(filterSubject) : undefined,
        }),
        getGradeChoices(),
        apiGet<SubjectOption[]>("/academics/subjects/"),
      ]);
      setData(classData);
      setChoices(choiceData);
      setSubjects(subjectData);
      setLoading(false);
    } catch {
      setError("TELEMETRY ERROR: Gradebook matrix unreachable.");
      setLoading(false);
    }
  }, [classId, filterTerm, filterSubject]);

  useEffect(() => { void load(); }, [load]);

  // Optimistic state mutations — no full reload needed
  const handleEntryAdded = (studentId: number, entry: GradeEntry) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        students: prev.students.map(s => s.student_id === studentId ? { ...s, entries: [entry, ...s.entries] } : s)
      };
    });
  };

  const handleEntryUpdated = (entry: GradeEntry) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        students: prev.students.map(s => ({ ...s, entries: s.entries.map(e => e.id === entry.id ? entry : e) }))
      };
    });
  };

  const handleEntryDeleted = (entryId: number) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        students: prev.students.map(s => ({ ...s, entries: s.entries.filter(e => e.id !== entryId) }))
      };
    });
  };

  const totalEntries = data?.students.reduce((s, st) => s + st.entries.length, 0) ?? 0;

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar title="Grid Terminal" />
        <main className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="btn__spinner" />
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title="Analytical Gradebook" />
      <main className="page-content page-enter" style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--space-10) var(--space-6)' }}>

        {/* Header */}
        <section style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 'var(--space-8)' }}>
           <button className="btn--ghost" style={{ padding: '12px 20px', fontSize: '12px', letterSpacing: '0.1em' }} onClick={() => navigate(-1)}>
              ◀ BACK
           </button>
           <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--brand-primary)', display: 'block', marginBottom: '4px' }}>MATRIX OVERVIEW</span>
              <h2 style={{ fontSize: '24px', margin: 0, color: 'var(--text-primary)' }}>CLASS {data?.class_name} EVALUATION HUB</h2>
           </div>
           <div style={{ width: '100px' }} /> {/* Spacer */}
        </section>

        {error && <div className="alert alert--error animate-fade-up">{error}</div>}

        {/* Global Matrix Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
           <div className="glass-card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>STUDENT NODES</span>
              <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>{data?.students.length}</span>
           </div>
           <div className="glass-card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>TOTAL EVAL MARKS</span>
              <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>{totalEntries}</span>
           </div>
           <div className="glass-card" style={{ padding: 'var(--space-5)', textAlign: 'center', borderBottom: '2px solid var(--brand-primary)' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>MATRIX SCOPE</span>
              <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--brand-primary)' }}>{filterTerm || "ALL TERMS"}</span>
           </div>
        </div>

        {/* Filters */}
        <section className="glass-card" style={{ display: 'flex', gap: '16px', marginBottom: 'var(--space-8)', padding: 'var(--space-4)', background: 'var(--bg-elevated)' }}>
           <div style={{ flex: 1 }}>
              <select className="form-input" style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} value={filterTerm} onChange={e => setFilterTerm(e.target.value as any)}>
                 <option value="">ALL EVALUATION TERMS</option>
                 {choices?.terms.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
           </div>
           <div style={{ flex: 1 }}>
              <select className="form-input" style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} value={filterSubject} onChange={e => setFilterSubject(e.target.value ? Number(e.target.value) : "")}>
                 <option value="">ALL CURRICULUM SUBJECTS</option>
                 {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
           </div>
           {(filterTerm || filterSubject) && (
             <button className="btn--ghost" style={{ padding: '0 24px', fontSize: '12px', letterSpacing: '0.1em', color: 'var(--warning)' }} onClick={() => { setFilterTerm(""); setFilterSubject(""); }}>CLEAR FILTERS</button>
           )}
        </section>

        {/* Matrix Registry */}
        {!data || data.students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)' }}>
             <span style={{ fontSize: '48px', display: 'block', marginBottom: '24px', filter: 'grayscale(1) opacity(0.3)' }}>📊</span>
             <h3 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>MATRIX VOID</h3>
             <p style={{ color: 'var(--text-muted)' }}>No student data detected in this jurisdictional segment.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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

      </main>
    </div>
  );
};

export default GradebookPage;
