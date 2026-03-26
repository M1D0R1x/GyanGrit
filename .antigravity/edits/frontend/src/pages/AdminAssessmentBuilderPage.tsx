import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { apiGet, apiPost, apiPatch, apiDelete } from "../services/api";
import TopBar from "../components/TopBar";
import { 
  HelpCircle, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  ChevronLeft, 
  Globe, 
  Lock,
  Zap
} from 'lucide-react';
import './AdminAssessmentBuilderPage.css';

type AssessmentItem = {
  id: number;
  title: string;
  description: string;
  total_marks: number;
  pass_marks: number;
  is_published: boolean;
};

type OptionDraft = { text: string; is_correct: boolean; };
type QuestionDraft = { text: string; marks: number; options: OptionDraft[]; };
type ExistingQuestion = {
  id: number; text: string; marks: number; order: number;
  options: { id: number; text: string; is_correct: boolean }[];
};

const BLANK_OPTION = (): OptionDraft => ({ text: "", is_correct: false });
const BLANK_QUESTION = (): QuestionDraft => ({
  text: "", marks: 1,
  options: [BLANK_OPTION(), BLANK_OPTION(), BLANK_OPTION(), BLANK_OPTION()],
});

const AdminAssessmentBuilderPage: React.FC = () => {
  const { courseId } = useParams();
  const navigate     = useNavigate();
  const location     = useLocation();

  const backPath = location.pathname.startsWith("/teacher") ? `/teacher/courses/${courseId}/lessons` : `/admin/content/courses/${courseId}/lessons`;

  const [assessment, setAssessment] = useState<AssessmentItem | null>(null);
  const [questions, setQuestions]   = useState<ExistingQuestion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);

  const [aTitle,     setATitle]     = useState("");
  const [aDesc,      setADesc]      = useState("");
  const [aPassMarks, setAPassMarks] = useState(3);
  const [aPublished, setAPublished] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);

  const [showQForm,      setShowQForm]      = useState(false);
  const [qDraft,         setQDraft]         = useState<QuestionDraft>(BLANK_QUESTION());
  const [savingQuestion, setSavingQuestion] = useState(false);

  const numCourseId = Number(courseId);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiGet<AssessmentItem[]>(`/assessments/course/${numCourseId}/`);
        if (res.length > 0) {
          const a = res[0];
          setAssessment(a); setATitle(a.title); setADesc(a.description); setAPassMarks(a.pass_marks); setAPublished(a.is_published);
          const detail = await apiGet<{ questions: ExistingQuestion[] }>(`/assessments/${a.id}/admin/`);
          setQuestions(detail.questions);
        }
      } catch { } // 404 handled gracefully
      finally { setLoading(false); }
    }
    load();
  }, [numCourseId]);

  const handleSaveAssessment = async () => {
    if (!aTitle.trim()) { setError("Assessment Protocol title required."); return; }
    setSavingAssessment(true); setError(null);
    try {
      if (assessment) {
        await apiPatch(`/assessments/${assessment.id}/update/`, { title: aTitle, description: aDesc, pass_marks: aPassMarks, is_published: aPublished });
        setAssessment(p => p ? { ...p, title: aTitle, description: aDesc, pass_marks: aPassMarks, is_published: aPublished } : null);
        setSuccess("TRANSMISSION SUCCESS: Assessment synced.");
      } else {
        const res = await apiPost<AssessmentItem>(`/assessments/course/${numCourseId}/create/`, { title: aTitle, description: aDesc, pass_marks: aPassMarks, is_published: aPublished });
        setAssessment(res); setSuccess("TRANSMISSION SUCCESS: Assessment instantiated.");
      }
    } catch { setError("Transmission Protocol Error."); }
    finally { setSavingAssessment(false); }
  };

  const handleAddQuestion = async () => {
    if (!qDraft.text.trim()) { setError("Question text required."); return; }
    if (qDraft.options.filter(o => o.is_correct).length !== 1) { setError("Matrix error: exactly one valid answer required."); return; }
    setSavingQuestion(true);
    try {
      const res = await apiPost<ExistingQuestion>(`/assessments/${assessment!.id}/questions/create/`, qDraft);
      setQuestions(p => [...p, res]);
      setQDraft(BLANK_QUESTION()); setShowQForm(false);
      setSuccess("NODE ADDED: Question instantiated.");
    } catch { setError("Instantiate Error."); }
    finally { setSavingQuestion(false); }
  };

  const updateOption = (idx: number, field: keyof OptionDraft, val: any) => {
    setQDraft(p => ({
      ...p,
      options: p.options.map((o, i) => {
        if (field === "is_correct" && val === true && i !== idx) return { ...o, is_correct: false };
        return i === idx ? { ...o, [field]: val } : o;
      })
    }));
  };

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar title="Builder Terminal" />
        <main className="page-content"><div className="skeleton-box" style={{ height: '500px' }} /></main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title="Assessment Studio" />
      <main className="page-content page-enter assessment-layout">

        <button className="btn--ghost sm" onClick={() => navigate(backPath)} style={{ marginBottom: 'var(--space-6)' }}>
           <ChevronLeft size={16} /> BACK TO Breakdown
        </button>

        {error && <div className="alert alert--error animate-fade-up">{error}</div>}
        {success && <div className="alert alert--success animate-fade-up">{success}</div>}

        <section className="assessment-meta-nexus animate-fade-up">
           <div className="modal-header-nexus">
              <div className="inst-label">EVALUATION PROTOCOL</div>
              <h2 className="modal-title">{assessment ? "REDACT ASSESSMENT" : "INSTANTIATE ASSESSMENT"}</h2>
           </div>

           <div className="curriculum-form" style={{ marginTop: 'var(--space-8)' }}>
              <div className="obsidian-form-group">
                 <label className="obsidian-label">ASSESSMENT TITLE *</label>
                 <input className="obsidian-input" value={aTitle} onChange={e => setATitle(e.target.value)} placeholder="e.g. Unit 1: Logical Foundations" />
              </div>
              <div className="obsidian-form-group">
                 <label className="obsidian-label">DESCRIPTION SYNOPSIS</label>
                 <textarea className="obsidian-textarea" rows={3} value={aDesc} onChange={e => setADesc(e.target.value)} placeholder="Evaluation instructions..." />
              </div>
              <div className="obsidian-form-group">
                 <label className="obsidian-label">PASSING THRESHOLD (MARKS)</label>
                 <input className="obsidian-input" type="number" value={aPassMarks} onChange={e => setAPassMarks(Number(e.target.value))} />
                 {assessment && <div className="inst-label" style={{ marginTop: '8px' }}>TOTAL SCORE CAP: {assessment.total_marks}</div>}
              </div>

              <div className="glass-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
                 <div>
                    <div className="inst-label" style={{ margin: 0 }}>PROTOCOL STATUS</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{aPublished ? "Public evaluation node" : "Internal evaluation draft"}</div>
                 </div>
                 <button className={`btn--${aPublished ? 'success' : 'ghost'} sm`} onClick={() => setAPublished(!aPublished)}>
                    {aPublished ? <Globe size={14} /> : <Lock size={14} />} {aPublished ? "PUBLISHED" : "DRAFT"}
                 </button>
              </div>

              <button className="btn--primary" onClick={handleSaveAssessment} disabled={savingAssessment}>
                 {savingAssessment ? "SYNCING..." : "SAVE PROTOCOL"}
              </button>
           </div>
        </section>

        {assessment && (
          <section className="question-registry-nexus animate-fade-up" style={{ animationDelay: '50ms' }}>
             <div className="nexus-header-text" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                   <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><HelpCircle size={14} /> QUESTION REGISTRY</h2>
                   <p className="hero-subtitle">{questions.length} Nodes · {assessment.total_marks} Marks</p>
                </div>
                {!showQForm && <button className="btn--primary sm" onClick={() => setShowQForm(true)}><Plus size={14} /> ADD NODE</button>}
             </div>

             {showQForm && (
               <div className="glass-card q-editor-portal animate-fade-up" style={{ marginBottom: 'var(--space-10)' }}>
                  <div className="inst-label">NODE ARCHITECT: NEW QUESTION</div>
                  <div className="obsidian-form-group" style={{ marginTop: 'var(--space-4)' }}>
                     <label className="obsidian-label">QUESTION LOGIC *</label>
                     <textarea className="obsidian-textarea" rows={3} value={qDraft.text} onChange={e => setQDraft(p => ({ ...p, text: e.target.value }))} placeholder="State question clearly..." />
                  </div>
                  <div className="obsidian-form-group">
                     <label className="obsidian-label">SCORE ALLOCATION</label>
                     <input className="obsidian-input" type="number" value={qDraft.marks} onChange={e => setQDraft(p => ({ ...p, marks: Number(e.target.value) }))} />
                  </div>
                  <div className="obsidian-form-group">
                     <label className="obsidian-label">ANSWER MATRIX (SELECT CORRECT)</label>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {qDraft.options.map((opt, i) => (
                          <div key={i} className={`option-item-row ${opt.is_correct ? 'correct' : ''}`} style={{ transition: 'all 0.2s' }}>
                             <input type="radio" checked={opt.is_correct} onChange={() => updateOption(i, "is_correct", true)} style={{ accentColor: 'var(--success)' }} />
                             <input className="obsidian-input" style={{ border: 'none', background: 'transparent', padding: 0 }} value={opt.text} onChange={e => updateOption(i, "text", e.target.value)} placeholder={`Option Delta ${i+1}`} />
                          </div>
                        ))}
                     </div>
                  </div>
                  <div className="mgmt-actions" style={{ gap: '12px' }}>
                     <button className="btn--primary" style={{ flex: 1 }} onClick={handleAddQuestion} disabled={savingQuestion}>SYNC NODE</button>
                     <button className="btn--secondary" onClick={() => { setShowQForm(false); setQDraft(BLANK_QUESTION()); }}>ABORT</button>
                  </div>
               </div>
             )}

             <div className="question-registry-stack">
                {questions.length === 0 && !showQForm && Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton-card" style={{ height: '160px' }} />
                ))}
                {questions.map((q) => (
                  <div key={q.id} className="glass-card question-nexus-card">
                     <header className="q-header">
                        <div className="q-number-blob">{q.order}</div>
                        <div style={{ flex: 1 }}>
                           <p style={{ fontWeight: 800, fontSize: '15px' }}>{q.text}</p>
                           <span className="stat-lbl">{q.marks} MARKS</span>
                        </div>
                        <button className="btn--ghost sm" style={{ color: 'var(--error)' }} onClick={() => window.confirm("Delete Node?") && apiDelete(`/assessments/questions/${q.id}/delete/`).then(() => setQuestions(p => p.filter(x => x.id !== q.id)))}>
                           <Trash2 size={14} />
                        </button>
                     </header>
                     <div className="option-nexus-stack">
                        {q.options.map(opt => (
                          <div key={opt.id} className={`option-item-row ${opt.is_correct ? 'correct' : ''}`}>
                             {opt.is_correct ? <CheckCircle2 size={12} /> : <Zap size={12} color="var(--text-dim)" opacity={0.3} />} {opt.text}
                          </div>
                        ))}
                     </div>
                  </div>
                ))}
             </div>
          </section>
        )}

      </main>
    </div>
  );
};

export default AdminAssessmentBuilderPage;
