import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getCourseAllLessons,
  createLesson,
  updateLesson,
  type LessonItem,
} from "../services/content";
import TopBar from "../components/TopBar";

const AdminLessonEditorPage: React.FC = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (courseId) {
      getCourseAllLessons(Number(courseId)).then(setLessons).finally(() => setLoading(false));
    }
  }, [courseId]);

  if (loading) return <div className="page-shell"><TopBar /><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="btn__spinner" /></main></div>;

  return (
    <div className="page-shell">
      <TopBar title="Institutional Studio" />
      <main className="page-content page-enter has-bottom-nav" style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-10) var(--space-6)' }}>
        
        <header style={{ marginBottom: 'var(--space-10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div>
              <div className="role-tag" style={{ background: 'rgba(52, 64, 84, 0.1)', color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>CONTENT ORCHESTRATION</div>
              <h1 className="text-gradient" style={{ fontSize: 'var(--text-3xl)' }}>Lesson Studio.</h1>
           </div>
           {mode === "list" && <button className="btn--primary" onClick={() => setMode("form")}>NEW LESSON</button>}
        </header>

        {mode === "list" ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
             {lessons.map((l, i) => (
               <div key={i} className="glass-card page-enter" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                     <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 900 }}>LESSON ID: {l.id}</div>
                     <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-primary)' }}>{l.title.toUpperCase()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                     <button className="btn--ghost" style={{ fontSize: '10px' }} onClick={() => navigate(`/lesson/${l.id}`)}>VIEW</button>
                     <button className="btn--secondary" style={{ fontSize: '10px' }}>EDIT</button>
                  </div>
               </div>
             ))}
          </div>
        ) : (
          <div className="glass-card page-enter">
             <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label className="form-label">LESSON TITLE</label>
                <input className="form-input" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter lesson name..." />
             </div>
             <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label className="form-label">CONTENT MODE</label>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                   DRAG & DROP MEDIA (VIDEO/PDF) OR START TYPING MARKDOWN
                </div>
             </div>
             <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                <button className="btn--primary" style={{ flex: 1 }}>PUBLISH LESSON</button>
                <button className="btn--ghost" style={{ flex: 1 }} onClick={() => setMode("list")}>CANCEL</button>
             </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default AdminLessonEditorPage;
