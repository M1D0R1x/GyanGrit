import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiGet, apiPost, apiPatch, apiDelete } from '../services/api';
import TopBar from '../components/TopBar';

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

const AdminAssessmentBuilderPage: React.FC = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const backPath = location.pathname.startsWith('/teacher')
    ? `/teacher/courses/${courseId}/lessons`
    : location.pathname.startsWith('/principal')
    ? `/principal/courses/${courseId}/lessons`
    : `/admin/content/courses/${courseId}/lessons`;

  const [assessment, setAssessment] = useState<AssessmentItem | null>(null);
  const [questions, setQuestions] = useState<ExistingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [aTitle, setATitle] = useState("");
  const [aDesc, setADesc] = useState("");
  const [aPassMarks, setAPassMarks] = useState(3);
  const [aPublished, setAPublished] = useState(false);
  
  const [showQForm, setShowQForm] = useState(false);
  const [qDraft, setQDraft] = useState<QuestionDraft>(BLANK_QUESTION());

  useEffect(() => {
    if (!courseId) return;
    async function load() {
      try {
        const assessments = await apiGet<AssessmentItem[]>(`/assessments/course/${courseId}/`);
        if (assessments.length > 0) {
          const a = assessments[0];
          setAssessment(a);
          setATitle(a.title);
          setADesc(a.description);
          setAPassMarks(a.pass_marks);
          setAPublished(a.is_published);

          const detail = await apiGet<{ questions: ExistingQuestion[] }>(`/assessments/${a.id}/admin/`);
          setQuestions(detail.questions);
        }
      } catch (err) {
        console.error("Assessment builder load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  if (loading) return (
    <div className="page-shell">
      <TopBar />
      <main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn__spinner" style={{ width: 40, height: 40 }} />
      </main>
    </div>
  );

  return (
    <div className="page-shell">
      <TopBar title="Assessment Architect" />
      <main className="page-content page-enter">
        {/* Editorial Header */}
        <section className="editorial-header animate-fade-up">
           <button 
             className="btn--ghost" 
             style={{ marginBottom: 'var(--space-6)', padding: 0, fontSize: 'var(--text-sm)', color: 'var(--brand-primary)' }}
             onClick={() => navigate(backPath)}
           >
             ← Curriculum Framework
           </button>
           <h1 className="text-gradient" style={{ fontSize: 'clamp(28px, 6vw, 40px)', lineHeight: 1.1, marginBottom: 'var(--space-1)' }}>
             Knowledge Schema<br/>
             Orchestration.
           </h1>
           <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-lg)', maxWidth: '500px' }}>
             Define the validation criteria for this curriculum node.
           </p>
        </section>

        {/* Meta Form */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-12)', padding: 'var(--space-8)' }}>
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>SCHEME TITLE</label>
                <input 
                  className="form-input" 
                  value={aTitle} 
                  onChange={(e) => setATitle(e.target.value)} 
                  placeholder="e.g. Fundamental Logic Phase 1"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>PASS THRESHOLD</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={aPassMarks} 
                  onChange={(e) => setAPassMarks(Number(e.target.value))} 
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)' }}
                />
              </div>
           </div>
           
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4)', background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-xl)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>Deployment State</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{aPublished ? 'VISIBLE TO ALL SCHOLARS' : 'RESTRICTED TO DRAFT MODE'}</div>
              </div>
              <button 
                className={`btn--${aPublished ? 'primary' : 'ghost'}`} 
                onClick={() => setAPublished(!aPublished)}
                style={{ fontSize: '10px', padding: 'var(--space-2) var(--space-4)' }}
              >
                {aPublished ? 'PUBLISHED' : 'MARK AS DRAFT'}
              </button>
           </div>
        </div>

        {/* Questions Section */}
        <div className="section-header">
           <h2 className="section-header__title">Validation Nodes</h2>
           <button 
             className="btn--ghost" 
             style={{ fontSize: '10px', color: 'var(--brand-primary)', fontWeight: 800 }}
             onClick={() => setShowQForm(true)}
           >
             + ADD NODE
           </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {questions.map((q, i) => (
            <div key={q.id} className="glass-card page-enter" style={{ padding: 'var(--space-6)', animationDelay: `${i * 100}ms` }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-dim)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '4px' }}>NODE #{q.order}</span>
                    <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--brand-primary)' }}>{q.marks} QP</span>
                  </div>
                  <button className="btn--ghost" style={{ fontSize: '9px', color: 'var(--role-admin)' }}>DECOMMISSION</button>
               </div>
               <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-6)', color: 'var(--text-primary)' }}>{q.text}</h3>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  {q.options.map((opt) => (
                    <div key={opt.id} style={{ padding: 'var(--space-3)', background: opt.is_correct ? 'var(--role-teacher)12' : 'var(--bg-elevated)', border: `1px solid ${opt.is_correct ? 'var(--role-teacher)22' : 'var(--glass-border)'}`, borderRadius: 'var(--radius-lg)', fontSize: '12px', color: opt.is_correct ? 'var(--role-teacher)' : 'var(--text-secondary)', fontWeight: opt.is_correct ? 700 : 400 }}>
                      {opt.is_correct ? '✅ ' : '• '}{opt.text}
                    </div>
                  ))}
               </div>
            </div>
          ))}
          
          {questions.length === 0 && !showQForm && (
            <div className="empty-state glass-card" style={{ padding: 'var(--space-12)' }}>
               <div style={{ fontSize: '40px', marginBottom: 'var(--space-4)' }}>🧩</div>
               <h3 className="empty-state__title">Empty Schema</h3>
               <p className="empty-state__message">Begin orchestration by adding your first validation node.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminAssessmentBuilderPage;
