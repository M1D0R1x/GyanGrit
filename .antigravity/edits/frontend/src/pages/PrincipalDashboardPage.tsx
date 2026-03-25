import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import { useAuth } from "../auth/AuthContext";

type ClassData = { class_id: number; class_name: string; institution: string; total_students: number; total_attempts: number; average_score: number; pass_rate: number; };
type TeacherData = { id: number; username: string; };
type CourseAnalytics = { course_id: number; title: string; subject: string; grade: number; total_lessons: number; completed_lessons: number; percentage: number; };
type AssessmentAnalytics = { assessment_id: number; title: string; total_attempts: number; unique_students: number; average_score: number; pass_rate: number; };

const PrincipalDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [courses, setCourses] = useState<CourseAnalytics[]>([]);
  const [assessments, setAssessments] = useState<AssessmentAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      apiGet<ClassData[]>("/teacher/analytics/classes/"),
      apiGet<TeacherData[]>("/accounts/teachers/"),
      apiGet<CourseAnalytics[]>("/teacher/analytics/courses/"),
      apiGet<AssessmentAnalytics[]>("/teacher/analytics/assessments/"),
    ]).then(([cl, te, co, as]) => {
      if (cl.status === "fulfilled") setClasses(cl.value ?? []);
      if (te.status === "fulfilled") setTeachers(te.value ?? []);
      if (co.status === "fulfilled") setCourses(co.value ?? []);
      if (as.status === "fulfilled") setAssessments(as.value ?? []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-shell"><TopBar /><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="btn__spinner" /></main></div>;

  const totalStudents = classes.reduce((s, c) => s + c.total_students, 0);
  const avgPass = classes.length ? Math.round(classes.reduce((s, c) => s + c.pass_rate, 0) / classes.length) : 0;

  return (
    <div className="page-shell">
      <TopBar title="Institutional Overwatch" />
      <main className="page-content page-enter has-bottom-nav" style={{ padding: 'var(--space-10) var(--space-6)' }}>
        
        {/* Strategic Command Banner */}
        <header className="glass-card animate-fade-up" style={{ padding: 'var(--space-10)', marginBottom: 'var(--space-10)', borderLeft: '4px solid var(--role-principal)' }}>
           <div className="role-tag role-tag--principal" style={{ marginBottom: 'var(--space-4)' }}>ADMINISTRATIVE OVERWATCH</div>
           <h1 className="text-gradient" style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>{user?.institution}</h1>
           <p style={{ color: 'var(--text-dim)', fontSize: '12px', fontWeight: 700 }}>COMMANDER AUTHENTICATED: {user?.full_name?.toUpperCase()}</p>
           
           <div style={{ marginTop: 'var(--space-10)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-10)' }}>
              <div>
                 <div style={{ color: 'var(--role-principal)', fontSize: 'var(--text-3xl)', fontWeight: 900 }}>{classes.length}</div>
                 <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900 }}>CLASS UNITS</div>
              </div>
              <div>
                 <div style={{ color: 'var(--text-primary)', fontSize: 'var(--text-3xl)', fontWeight: 900 }}>{totalStudents}</div>
                 <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900 }}>SCHOLAR FORCE</div>
              </div>
              <div>
                 <div style={{ color: avgPass >= 70 ? 'var(--role-student)' : 'var(--role-teacher)', fontSize: 'var(--text-3xl)', fontWeight: 900 }}>{avgPass}%</div>
                 <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900 }}>PASS VELOCITY</div>
              </div>
              <div>
                 <div style={{ color: 'var(--text-primary)', fontSize: 'var(--text-3xl)', fontWeight: 900 }}>{teachers.length}</div>
                 <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900 }}>FACULTY UNITS</div>
              </div>
           </div>
        </header>

        {/* Tactical Class Registry */}
        <section style={{ marginBottom: 'var(--space-16)' }}>
           <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 900, marginBottom: 'var(--space-6)' }}>Class Operations</h2>
           <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                 <thead>
                    <tr>
                       <th>UNIT NAME</th>
                       <th>STRENGTH</th>
                       <th>PASS RATE</th>
                       <th>STATUS</th>
                    </tr>
                 </thead>
                 <tbody>
                    {classes.map(c => (
                      <tr key={c.class_id} onClick={() => navigate(`/principal/classes/${c.class_id}`)} style={{ cursor: 'pointer' }}>
                         <td style={{ fontWeight: 800 }}>{c.class_name}</td>
                         <td>{c.total_students}</td>
                         <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                               <div style={{ flex: 1, height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px' }}>
                                  <div style={{ width: `${c.pass_rate}%`, height: '100%', background: c.pass_rate >= 70 ? 'var(--role-student)' : 'var(--role-teacher)' }} />
                               </div>
                               <span style={{ fontSize: '11px', fontWeight: 900 }}>{c.pass_rate}%</span>
                            </div>
                         </td>
                         <td><div className="role-tag" style={{ background: c.pass_rate >= 70 ? 'rgba(61,214,140,0.1)' : 'rgba(77,171,247,0.1)', color: c.pass_rate >= 70 ? 'var(--role-student)' : 'var(--role-teacher)', fontSize: '9px' }}>{c.pass_rate >= 70 ? 'OPTIMAL' : 'MONITOR'}</div></td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </section>

        {/* Faculty Roster */}
        <section>
           <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 900, marginBottom: 'var(--space-6)' }}>Faculty Deployment</h2>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
              {teachers.map(t => (
                <div key={t.id} className="glass-card" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                   <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900, color: 'var(--role-teacher)' }}>{t.username.charAt(0).toUpperCase()}</div>
                   <div style={{ fontWeight: 800, fontSize: '13px' }}>{t.username.toUpperCase()}</div>
                </div>
              ))}
           </div>
        </section>

      </main>
      <BottomNav />
    </div>
  );
};

export default PrincipalDashboardPage;
