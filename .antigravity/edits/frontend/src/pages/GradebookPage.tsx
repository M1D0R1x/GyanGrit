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
import { 
  GraduationCap, 
  BookOpen, 
  Plus, 
  List, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft,
  Database,
  BarChart3,
  Award,
  Filter,
  CheckCircle2,
  X
} from 'lucide-react';
import './GradebookPage.css';

type SubjectOption = { id: number; name: string };

const pctColor = (pct: number) => {
  if (pct >= 70) return "var(--role-student)";
  if (pct >= 40) return "var(--warning)";
  return "var(--error)";
};

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

  const calculatedPct = marks && totalMarks ? Math.round(parseFloat(marks) / parseFloat(totalMarks) * 100) : null;

  return (
    <div className="obsidian-modal-overlay animate-fade-in" onClick={onClose}>
      <div className="glass-card obsidian-modal animate-scale-up" onClick={e => e.stopPropagation()}>
        <div className="modal-header-nexus">
           <div className="inst-label">MARK PROTOCOL: {studentName}</div>
           <h2 className="modal-title">{existing ? "EDIT EVALUATION" : "ADD EVALUATION"}</h2>
        </div>

        {error && <div className="alert alert--error" style={{ marginBottom: '20px' }}>{error}</div>}

        <div className="joincode-form-grid" style={{ gridTemplateColumns: '1fr' }}>
           {!existing && (
             <div className="obsidian-form-group">
                <label className="obsidian-label">SUBJECT NODE *</label>
                <select className="obsidian-select" value={subjectId} onChange={e => setSubjectId(Number(e.target.value))}>
                   <option value="">Select subject...</option>
                   {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
             </div>
           )}

           <div className="obsidian-form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                 <label className="obsidian-label">TERM</label>
                 <select className="obsidian-select" value={term} onChange={e => setTerm(e.target.value as any)}>
                    {choices.terms.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                 </select>
              </div>
              <div>
                 <label className="obsidian-label">CATEGORY</label>
                 <select className="obsidian-select" value={category} onChange={e => setCategory(e.target.value as any)}>
                    {choices.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                 </select>
              </div>
           </div>

           <div className="obsidian-form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                 <label className="obsidian-label">OBTAINED MARKS *</label>
                 <input className="obsidian-input" type="number" step="0.5" value={marks} onChange={e => setMarks(e.target.value)} />
              </div>
              <div>
                 <label className="obsidian-label">TOTAL MARKS *</label>
                 <input className="obsidian-input" type="number" step="0.5" value={totalMarks} onChange={e => setTotalMarks(e.target.value)} />
              </div>
           </div>

           {calculatedPct !== null && !isNaN(calculatedPct) && calculatedPct >= 0 && (
             <div className="glass-card" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)' }}>
                <span className="inst-label" style={{ margin: 0 }}>TELEMETRY SCORE</span>
                <span className="score-pct" style={{ color: pctColor(calculatedPct), fontSize: '24px' }}>{calculatedPct}%</span>
             </div>
           )}

           <div className="obsidian-form-group">
              <label className="obsidian-label">NOTES (REMARKS)</label>
              <textarea className="obsidian-textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Entry notes..." />
           </div>
        </div>

        <div className="mgmt-actions" style={{ gap: '12px', marginTop: 'var(--space-8)' }}>
           <button className="btn--primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={saving}>
              {saving ? "SYNCING..." : (existing ? "SAVE EVAL" : "ADD EVAL")}
           </button>
           <button className="btn--secondary" onClick={onClose} disabled={saving}>CANCEL</button>
        </div>
      </div>
    </div>
  );
};

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
    if (!confirm(`NULLIFY mark entry for ${entry.subject}?`)) return;
    setDeleting(entry.id);
    try {
      await deleteGradeEntry(entry.id);
      onEntryDeleted(entry.id);
    } catch { } finally { setDeleting(null); }
  };

  return (
    <div className={`glass-card gradebook-student-card ${expanded ? 'expanded' : ''} animate-fade-up`}>
      <header className="student-row-nexus" onClick={() => setExpanded(!expanded)}>
         <div className="student-identity-nexus">
            <div className="user-avatar-init">{student.student.slice(0, 2).toUpperCase()}</div>
            <div className="student-name-block">
               <span className="student-name">{student.student}</span>
               <span className="student-handle">@{student.username}</span>
            </div>
         </div>

         <div className="student-stat-group">
            <div className="inst-metrics">
               <div className="inst-stat">
                  <span className="inst-val">{student.entries.length}</span>
                  <span className="inst-lbl">EVALS</span>
               </div>
            </div>
            {avgPct !== null && (
               <div className="inst-metrics">
                  <div className="inst-stat">
                     <span className="inst-val" style={{ color: pctColor(avgPct) }}>{avgPct}%</span>
                     <span className="inst-lbl">AVG</span>
                  </div>
               </div>
            )}
            <button className="btn--primary sm" onClick={e => { e.stopPropagation(); setShowForm(true); }}>
               <Plus size={14} /> EVAL
            </button>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
         </div>
      </header>

      {expanded && (
        <section className="grade-entry-list animate-fade-in">
           {student.entries.length === 0 ? (
             <div className="empty-state sm">
                <Database size={24} color="var(--text-dim)" />
                <p>No evaluation telemetry recorded for this node.</p>
             </div>
           ) : (
             <table className="student-table">
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
                        <td style={{ fontSize: '12px' }}>
                           <span className="role-tag" style={{ background: 'var(--bg-elevated)', color: 'var(--text-dim)' }}>
                              {entry.term.replace("_", " ").toUpperCase()}
                           </span>
                           <span className="role-tag" style={{ marginLeft: '4px' }}>
                              {entry.category.replace("_", " ").toUpperCase()}
                           </span>
                        </td>
                        <td className="score-cell">{entry.marks} <span className="stat-lbl">/ {entry.total_marks}</span></td>
                        <td><span className="score-pct" style={{ color: pctColor(entry.percentage) }}>{entry.percentage}%</span></td>
                        <td style={{ textAlign: 'right' }}>
                           <div className="score-btn-nexus" style={{ justifyContent: 'flex-end' }}>
                              <button className="btn--ghost sm" onClick={() => setEditEntry(entry)}>EDIT</button>
                              <button className="btn--ghost sm" style={{ color: 'var(--error)' }} onClick={() => handleDelete(entry)} disabled={deleting === entry.id}>
                                 {deleting === entry.id ? "NULLING..." : "TRASH"}
                              </button>
                           </div>
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
           )}
        </section>
      )}

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

const GradebookPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate    = useNavigate();

  const [data,      setData]      = useState<ClassGrades | null>(null);
  const [choices,   setChoices]   = useState<GradeChoices | null>(null);
  const [subjects,  setSubjects]  = useState<SubjectOption[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

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
        <main className="page-content">
          <div className="skeleton-box" style={{ height: '500px' }} />
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title="Analytical Gradebook" />
      <main className="page-content page-enter gradebook-layout">

        <section className="class-nav-nexus animate-fade-up">
           <button className="btn--ghost sm" onClick={() => navigate(-1)}>
              <ChevronLeft size={16} /> BACK TO Breakdown
           </button>
           <div className="inst-info" style={{ flex: 1, textAlign: 'center' }}>
              <span className="inst-label">MATRIX OVERVIEW</span>
              <h2 className="inst-name" style={{ fontSize: '20px' }}>CLASS {data?.class_name} EVALUATION HUB</h2>
           </div>
           <div style={{ width: '120px' }} /> {/* Spacer */}
        </section>

        {error && <div className="alert alert--error animate-fade-up">{error}</div>}

        {/* Global Matrix Stats */}
        <div className="stat-nexus-grid animate-fade-up" style={{ animationDelay: '50ms' }}>
           <div className="glass-card stat-tile">
              <span className="stat-tile__label">STUDENT NODES</span>
              <span className="stat-tile__val">{data?.students.length}</span>
           </div>
           <div className="glass-card stat-tile">
              <span className="stat-tile__label">TOTAL EVAL MARKS</span>
              <span className="stat-tile__val">{totalEntries}</span>
           </div>
           <div className="glass-card stat-tile" style={{ borderColor: 'var(--brand-primary)' }}>
              <span className="stat-tile__label">MATRIX SCOPE</span>
              <span className="stat-tile__val" style={{ color: 'var(--brand-primary)' }}>{filterTerm || "ALL TERMS"}</span>
           </div>
        </div>

        {/* Matrix Filters */}
        <section className="gradebook-filters animate-fade-up" style={{ animationDelay: '100ms' }}>
           <div className="obsidian-form-group" style={{ marginBottom: 0, flex: 1 }}>
              <select className="obsidian-select" value={filterTerm} onChange={e => setFilterTerm(e.target.value as any)}>
                 <option value="">ALL EVALUATION TERMS</option>
                 {choices?.terms.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
           </div>
           <div className="obsidian-form-group" style={{ marginBottom: 0, flex: 1 }}>
              <select className="obsidian-select" value={filterSubject} onChange={e => setFilterSubject(e.target.value ? Number(e.target.value) : "")}>
                 <option value="">ALL CURRICULUM SUBJECTS</option>
                 {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
           </div>
           {(filterTerm || filterSubject) && (
             <button className="btn--ghost sm" onClick={() => { setFilterTerm(""); setFilterSubject(""); }}>CLEAR FILTERS</button>
           )}
        </section>

        {/* Matrix Registry */}
        {!data || data.students.length === 0 ? (
          <div className="empty-state animate-fade-up">
             <BarChart3 size={48} color="var(--text-dim)" />
             <h3 className="empty-state__title">MATRIX VOID</h3>
             <p className="empty-state__message">No student data detected in this jurisdictional segment.</p>
          </div>
        ) : (
          <div className="grade-registry-stack">
             {data.students.map((student, i) => (
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
