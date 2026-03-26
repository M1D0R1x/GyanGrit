import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getTeacherClassStudents,
  type TeacherClassStudent,
} from "../services/teacherAnalytics";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { 
  Users, 
  Activity, 
  TrendingUp, 
  ChevronLeft, 
  LayoutDashboard, 
  Database,
  ArrowRight
} from 'lucide-react';
import './TeacherClassDetailPage.css';

const LessonProgress: React.FC<{ completed: number; total: number }> = ({ completed, total }) => {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const color = pct >= 70 ? "var(--role-student)" : pct >= 30 ? "var(--warning)" : "var(--error)";

  return (
    <div className="progress-pill-nexus">
      <div className="pill-bar-container">
        <div className="pill-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="pill-val" style={{ color }}>{total > 0 ? `${pct}%` : "—"}</span>
    </div>
  );
};

const TeacherClassDetailPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate    = useNavigate();
  const location    = useLocation();

  const prefix = location.pathname.startsWith("/principal") ? "/principal"
    : location.pathname.startsWith("/official") ? "/official"
    : "/teacher";

  const [students, setStudents] = useState<TeacherClassStudent[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    async function loadData() {
      try {
        const data = await getTeacherClassStudents(Number(classId));
        if (!cancelled) {
          setStudents(data ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("TELEMETRY ERROR: Student registry unreachable.");
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [classId]);

  const totalStudents  = students.length;
  const activeStudents = students.filter((s) => s.completed_lessons > 0).length;
  const avgProgress    = totalStudents > 0
    ? Math.round(
        students.reduce((sum, s) =>
          sum + (s.total_lessons > 0 ? s.completed_lessons / s.total_lessons * 100 : 0), 0
        ) / totalStudents
      )
    : 0;

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar title="Class Terminal" />
        <main className="page-content">
          <div className="skeleton-stack animate-pulse-subtle">
             <div className="skeleton-box" style={{ height: '100px', marginBottom: '20px' }} />
             <div className="skeleton-box" style={{ height: '300px' }} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title="Node Breakdown" />
      <main className="page-content page-enter class-detail-layout">

        {/* Navigation Nexus */}
        <section className="class-nav-nexus animate-fade-up">
           <button className="btn--ghost sm" onClick={() => navigate(prefix)}>
              <ChevronLeft size={16} /> BACK TO DASHBOARD
           </button>
           <button className="btn--secondary sm" onClick={() => navigate(`${prefix}/classes/${classId}/gradebook`)}>
              <Database size={14} /> GRADEBOOK TERMINAL
           </button>
        </section>

        {/* Global Summary */}
        {!error && totalStudents > 0 && (
          <div className="class-summary-grid animate-fade-up" style={{ animationDelay: '50ms' }}>
             <div className="glass-card class-stat-tile">
                <span className="stat-tile__label">STUDENT NODES</span>
                <span className="stat-tile__val">{totalStudents}</span>
                <Users size={12} color="var(--text-dim)" style={{ marginTop: 'auto' }} />
             </div>
             <div className="glass-card class-stat-tile">
                <span className="stat-tile__label">ACTIVE ENGINES</span>
                <span className="stat-tile__val" style={{ color: 'var(--role-student)' }}>{activeStudents}</span>
                <Activity size={12} color="var(--role-student)" style={{ marginTop: 'auto' }} />
             </div>
             <div className="glass-card class-stat-tile">
                <span className="stat-tile__label">AVG PROGRESS</span>
                <span className="stat-tile__val" style={{ color: 'var(--role-student)' }}>{avgProgress}%</span>
                <TrendingUp size={12} color="var(--role-student)" style={{ marginTop: 'auto' }} />
             </div>
          </div>
        )}

        {error && <div className="alert alert--error">{error}</div>}

        {/* Student Breakdown */}
        <div className="section-nexus-header animate-fade-up" style={{ animationDelay: '100ms' }}>
           <div className="nexus-header-text">
              <h2><LayoutDashboard size={14} color="var(--role-teacher)" /> STUDENT TELEMETRY</h2>
           </div>
        </div>

        {students.length === 0 ? (
          <div className="empty-state animate-fade-up">
             <Users size={48} color="var(--text-dim)" />
             <h3 className="empty-state__title">NO NODES DETECTED</h3>
             <p className="empty-state__message">Enrollment data for this class instance is currently void.</p>
          </div>
        ) : (
          <div className="glass-card student-grid-card animate-fade-up" style={{ animationDelay: '150ms' }}>
             <table className="student-table">
                <thead>
                   <tr>
                      <th>IDENTIFIER</th>
                      <th>UNIT SYNC</th>
                      <th style={{ minWidth: '180px' }}>PROGRESS SATURATION</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                   </tr>
                </thead>
                <tbody>
                   {students.map((s) => (
                     <tr key={s.id} onClick={() => navigate(`${prefix}/classes/${classId}/students/${s.id}`)} style={{ cursor: 'pointer' }}>
                        <td>
                           <div className="student-cell-nexus">
                              <div className="student-avatar">{(s.display_name || s.username).slice(0, 2).toUpperCase()}</div>
                              <div className="student-name-block">
                                 <span className="student-name">{s.display_name || s.username}</span>
                                 <span className="student-handle">@{s.username}</span>
                              </div>
                           </div>
                        </td>
                        <td>
                           <span className="stat-val" style={{ fontSize: '14px' }}>{s.completed_lessons}</span>
                           <span className="stat-lbl" style={{ marginLeft: '4px' }}>/ {s.total_lessons} UNITS</span>
                        </td>
                        <td>
                           <LessonProgress completed={s.completed_lessons} total={s.total_lessons} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                           <button className="btn--ghost sm">
                              <ArrowRight size={14} color="var(--role-student)" />
                           </button>
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  );
};

export default TeacherClassDetailPage;
