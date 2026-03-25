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

type SubjectOption = { id: number; name: string };

const GradebookPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<ClassGrades | null>(null);
  const [choices, setChoices] = useState<GradeChoices | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!classId) return;
      try {
        const [classData, choiceData, subjectData] = await Promise.all([
          getClassGrades(Number(classId)),
          getGradeChoices(),
          apiGet<SubjectOption[]>("/academics/subjects/"),
        ]);
        setData(classData);
        setChoices(choiceData);
        setSubjects(subjectData);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [classId]);

  if (loading) return <div className="page-shell"><TopBar /><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="btn__spinner" /></main></div>;

  return (
    <div className="page-shell">
      <TopBar title="Institutional Ledger" />
      <main className="page-content page-enter" style={{ padding: 'var(--space-10) var(--space-6)' }}>
        
        {/* Editorial Header */}
        <header className="editorial-header animate-fade-up" style={{ marginBottom: 'var(--space-10)' }}>
           <div className="role-tag role-tag--teacher" style={{ marginBottom: 'var(--space-4)' }}>
             📊 Grade Orchestration
           </div>
           <h1 className="text-gradient" style={{ fontSize: 'clamp(28px, 6vw, 44px)', lineHeight: 1.1, marginBottom: 'var(--space-2)' }}>
             Academic Mastery<br />
             Ledger.
           </h1>
           <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-lg)', maxWidth: '500px' }}>
             High-precision record of class performance across all subject domains.
           </p>
        </header>

        {/* Stats Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-12)' }}>
           <div className="glass-card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 800 }}>CLASSROOM</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 900 }}>{data?.class_name || 'N/A'}</div>
           </div>
           <div className="glass-card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 800 }}>ENTITY COUNT</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 900 }}>{data?.students.length} SCHOLARS</div>
           </div>
           <div className="glass-card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 800 }}>AGGREGATE ENTRIES</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 900 }}>{data?.students.reduce((acc, s) => acc + s.entries.length, 0)} RECORDS</div>
           </div>
        </div>

        {/* Dense Ledger Table */}
        <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
           <table className="data-table">
             <thead>
               <tr>
                 <th>SCHOLAR ENTITY</th>
                 <th>SUBJECT DOMAIN</th>
                 <th>ASSESSMENT CATEGORY</th>
                 <th>MASTERY SCORE</th>
                 <th>STATUS</th>
               </tr>
             </thead>
             <tbody>
               {data?.students.map((student, sIdx) => (
                 student.entries.length > 0 ? (
                   student.entries.map((entry, eIdx) => (
                     <tr key={`${sIdx}-${eIdx}`} className="page-enter" style={{ animationDelay: `${(sIdx * 10) + eIdx * 5}ms` }}>
                       <td>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div className="role-avatar role-avatar--student" style={{ width: 24, height: 24 }} />
                            <span style={{ fontWeight: 700 }}>{student.student}</span>
                         </div>
                       </td>
                       <td><div className="role-tag role-tag--teacher" style={{ fontSize: '7px' }}>{entry.subject}</div></td>
                       <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{entry.category.toUpperCase()}</td>
                       <td style={{ fontFamily: 'monospace', fontWeight: 900, color: entry.percentage > 70 ? 'var(--role-student)' : 'var(--role-teacher)' }}>
                         {entry.marks}/{entry.total_marks} ({entry.percentage}%)
                       </td>
                       <td>
                         <div style={{ fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'inline-block' }}>RECORDED</div>
                       </td>
                     </tr>
                   ))
                 ) : (
                    <tr key={sIdx} className="page-enter" style={{ animationDelay: `${sIdx * 10}ms` }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                           <div className="role-avatar role-avatar--student" style={{ width: 24, height: 24 }} />
                           <span style={{ fontWeight: 700 }}>{student.student}</span>
                        </div>
                      </td>
                      <td colSpan={4} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic' }}>No archival records available for this entity.</td>
                    </tr>
                 )
               ))}
             </tbody>
           </table>
        </div>

      </main>
    </div>
  );
};

export default GradebookPage;
