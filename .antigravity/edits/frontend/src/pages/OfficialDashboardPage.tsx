import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import { useAuth } from "../auth/AuthContext";

type ClassAnalytics = { class_id: number; class_name: string; institution: string; total_students: number; total_attempts: number; average_score: number; pass_rate: number; };
type CourseAnalytics = { course_id: number; title: string; subject: string; grade: number; total_lessons: number; completed_lessons: number; percentage: number; };
type AssessmentAnalytics = { assessment_id: number; title: string; total_attempts: number; unique_students: number; average_score: number; pass_rate: number; };

const OfficialDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassAnalytics[]>([]);
  const [courses, setCourses] = useState<CourseAnalytics[]>([]);
  const [assessments, setAssessments] = useState<AssessmentAnalytics[]>([]);

  useEffect(() => {
    Promise.allSettled([
      apiGet<ClassAnalytics[]>("/teacher/analytics/classes/"),
      apiGet<CourseAnalytics[]>("/teacher/analytics/courses/"),
      apiGet<AssessmentAnalytics[]>("/teacher/analytics/assessments/"),
    ]).then(([cl, co, as]) => {
      if (cl.status === "fulfilled") setClasses(cl.value ?? []);
      if (co.status === "fulfilled") setCourses(co.value ?? []);
      if (as.status === "fulfilled") setAssessments(as.value ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const totalStudents = classes.reduce((s, c) => s + c.total_students, 0);
  const avgPass = classes.length ? Math.round(classes.reduce((s, c) => s + c.pass_rate, 0) / classes.length) : 0;
  const institutions = [...new Set(classes.map(c => c.institution))];

  if (loading) return <div className="page-shell"><TopBar /><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="btn__spinner" /></main></div>;

  return (
    <div className="page-shell">
      <TopBar title="Governance Overwatch" />
      <main className="page-content page-enter has-bottom-nav" style={{ padding: 'var(--space-10) var(--space-6)' }}>
        
        {/* District HUD */}
        <header className="glass-card animate-fade-up" style={{ padding: 'var(--space-10)', marginBottom: 'var(--space-10)', borderLeft: '4px solid #8b5cf6' }}>
           <div className="role-tag" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', marginBottom: 'var(--space-4)' }}>GOVERNANCE SCOPE: DISTRICT</div>
           <h1 className="text-gradient" style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>District Performance.</h1>
           <p style={{ color: 'var(--text-dim)', fontSize: '12px', fontWeight: 700 }}>GOVERNANCE LEDGER AUTHENTICATED: {user?.full_name?.toUpperCase()}</p>
           
           <div style={{ marginTop: 'var(--space-10)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-10)' }}>
              <div>
                 <div style={{ color: '#8b5cf6', fontSize: 'var(--text-3xl)', fontWeight: 900 }}>{institutions.length}</div>
                 <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900 }}>INSTITUTIONS</div>
              </div>
              <div>
                 <div style={{ color: 'var(--text-primary)', fontSize: 'var(--text-3xl)', fontWeight: 900 }}>{totalStudents}</div>
                 <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900 }}>SCHOLAR FORCE</div>
              </div>
              <div>
                 <div style={{ color: avgPass >= 70 ? 'var(--role-student)' : 'var(--role-teacher)', fontSize: 'var(--text-3xl)', fontWeight: 900 }}>{avgPass}%</div>
                 <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900 }}>AVG PASS RATE</div>
              </div>
              <div>
                 <div style={{ color: 'var(--text-primary)', fontSize: 'var(--text-3xl)', fontWeight: 900 }}>{courses.length}</div>
                 <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900 }}>ACTIVE COURSES</div>
              </div>
           </div>
        </header>

        {/* Institutional Performance Registry */}
        <section style={{ marginBottom: 'var(--space-16)' }}>
           <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 900, marginBottom: 'var(--space-6)' }}>Institutional Ledger</h2>
           <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                 <thead>
                    <tr>
                       <th>INSTITUTION</th>
                       <th>CLASS UNITS</th>
                       <th>STRENGTH</th>
                       <th>PERFORMANCE</th>
                    </tr>
                 </thead>
                 <tbody>
                    {institutions.map((inst, i) => {
                      const instClasses = classes.filter(c => c.institution === inst);
                      const instPass = Math.round(instClasses.reduce((s, c) => s + c.pass_rate, 0) / instClasses.length);
                      return (
                        <tr key={i}>
                           <td style={{ fontWeight: 800 }}>{inst.toUpperCase()}</td>
                           <td>{instClasses.length}</td>
                           <td>{instClasses.reduce((s, c) => s + c.total_students, 0)}</td>
                           <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                 <div style={{ flex: 1, height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px' }}>
                                    <div style={{ width: `${instPass}%`, height: '100%', background: '#8b5cf6' }} />
                                 </div>
                                 <span style={{ fontSize: '11px', fontWeight: 900 }}>{instPass}%</span>
                              </div>
                           </td>
                        </tr>
                      );
                    })}
                 </tbody>
              </table>
           </div>
        </section>

        {/* Global Dispatch Controls */}
        <section>
           <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 900, marginBottom: 'var(--space-6)' }}>Strategic Actions</h2>
           <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              <button className="btn--primary" onClick={() => navigate("/official/users")} style={{ flex: 1 }}>MANAGE PRINCIPALS</button>
              <button className="btn--ghost" onClick={() => navigate("/notifications")} style={{ flex: 1 }}>BROADCAST ALERT</button>
           </div>
        </section>

      </main>
      <BottomNav />
    </div>
  );
};

export default OfficialDashboardPage;
