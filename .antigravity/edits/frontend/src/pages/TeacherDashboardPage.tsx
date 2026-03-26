import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getTeacherCourseAnalytics,
  getTeacherAssessmentAnalytics,
  getTeacherClassAnalytics,
  type TeacherCourseAnalytics,
  type TeacherAssessmentAnalytics,
  type TeacherClassAnalytics,
} from "../services/teacherAnalytics";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { 
  Users, 
  BookOpen, 
  BarChart3, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp,
  Award,
  BookMarked
} from 'lucide-react';
import './TeacherDashboardPage.css';

type MyAssignment = {
  subject_id:   number;
  subject_name: string;
  section_id:   number;
  section_name: string;
  class_name:   string;
};

const TeacherDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [courses,     setCourses]     = useState<TeacherCourseAnalytics[]>([]);
  const [assessments, setAssessments] = useState<TeacherAssessmentAnalytics[]>([]);
  const [classes,     setClasses]     = useState<TeacherClassAnalytics[]>([]);
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      try {
        const [c, a, cl, as] = await Promise.all([
          getTeacherCourseAnalytics(),
          getTeacherAssessmentAnalytics(),
          getTeacherClassAnalytics(),
          apiGet<MyAssignment[]>("/academics/my-assignments/")
        ]);
        if (!cancelled) {
          setCourses(c ?? []);
          setAssessments(a ?? []);
          setClasses(cl ?? []);
          setAssignments(as ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => { cancelled = true; };
  }, []);

  const subjectMap = assignments.reduce<Record<string, Set<string>>>((acc, a) => {
    if (!acc[a.subject_name]) acc[a.subject_name] = new Set();
    acc[a.subject_name].add(`Class ${a.class_name}`);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar title="Teacher Terminal" />
        <main className="page-content has-bottom-nav">
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
      <TopBar title="Instructor Interface" />
      <main className="page-content page-enter has-bottom-nav teacher-dash-layout">

        {/* Action Nexus */}
        <section className="action-nexus animate-fade-up">
          <button className="btn--secondary sm" onClick={() => navigate("/teacher/users")}>
            <ShieldCheck size={14} /> GENERATE STUDENT CODES
          </button>
        </section>

        {/* My Subjects */}
        <section className="section-block animate-fade-up" style={{ animationDelay: '50ms' }}>
          <h3 className="nexus-title"><BookMarked size={16} color="var(--role-teacher)" /> ASSIGNED MODULES</h3>
          <div className="subject-grid">
            {Object.entries(subjectMap).map(([subject, classSet], i) => (
              <div key={subject} className="glass-card subject-card" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="subject-name">{subject.toUpperCase()}</div>
                <div className="class-pills">
                  {[...classSet].sort().map((c) => (
                    <span key={c} className="class-pill">{c}</span>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(subjectMap).length === 0 && <p className="empty-msg">No active assignments detected.</p>}
          </div>
        </section>

        {/* Class Performance */}
        <section className="section-block animate-fade-up" style={{ animationDelay: '100ms' }}>
          <h3 className="nexus-title"><Users size={16} color="var(--role-teacher)" /> CLASS ANALYTICS</h3>
          <div className="metric-grid">
            {classes.map((c, i) => {
              const passColor = c.pass_rate >= 70 ? "var(--role-student)" : c.pass_rate >= 40 ? "var(--warning)" : "var(--error)";
              return (
                <div key={c.class_id} className="glass-card metric-card clickable animate-fade-up" 
                     onClick={() => navigate(`/teacher/classes/${c.class_id}`)}
                     style={{ animationDelay: `${i * 50}ms` }}>
                  <span className="metric-label">{c.institution || "INSTITUTION"}</span>
                  <div className="metric-title">CLASS {c.class_name}</div>
                  
                  <div className="metric-stats">
                    <div className="stat-unit">
                      <span className="stat-val">{c.total_students}</span>
                      <span className="stat-lbl">STUDENTS</span>
                    </div>
                    {c.total_attempts > 0 ? (
                      <div className="stat-unit" style={{ textAlign: 'right' }}>
                        <span className="stat-val" style={{ color: passColor }}>{c.pass_rate}%</span>
                        <span className="stat-lbl">PASS RATE</span>
                      </div>
                    ) : (
                      <span className="stat-lbl">NO LOGS</span>
                    )}
                  </div>

                  {c.total_attempts > 0 && (
                    <div className="pass-rate-nexus">
                      <div className="rate-bar-container">
                        <div className="rate-bar-fill" style={{ width: `${c.pass_rate}%`, background: passColor }} />
                      </div>
                      <ArrowRight size={12} color="var(--role-teacher)" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Course Completion */}
        <section className="section-block animate-fade-up" style={{ animationDelay: '150ms' }}>
          <h3 className="nexus-title"><BookOpen size={16} color="var(--role-teacher)" /> CURRICULUM SYNC</h3>
          <div className="metric-grid">
            {courses.map((course, i) => (
              <div key={course.course_id} className="glass-card metric-card clickable animate-fade-up"
                   onClick={() => navigate(`/teacher/courses/${course.course_id}/lessons`)}
                   style={{ animationDelay: `${i * 50}ms` }}>
                <span className="metric-label">{course.subject} · GRADE {course.grade}</span>
                <div className="metric-title">{course.title}</div>

                <div className="metric-stats">
                   <div className="stat-unit">
                      <span className="stat-val">{course.completed_lessons}/{course.total_lessons}</span>
                      <span className="stat-lbl">UNITS SYNCED</span>
                   </div>
                   <div className="stat-unit" style={{ textAlign: 'right' }}>
                      <span className="stat-val" style={{ color: 'var(--role-student)' }}>{course.percentage}%</span>
                      <span className="stat-lbl">COMPLETION</span>
                   </div>
                </div>

                <div className="pass-rate-nexus">
                   <div className="rate-bar-container">
                      <div className="rate-bar-fill" style={{ width: `${course.percentage}%`, background: 'var(--role-student)' }} />
                   </div>
                   <TrendingUp size={12} color="var(--role-teacher)" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Assessment Performance */}
        <section className="section-block animate-fade-up" style={{ animationDelay: '200ms' }}>
          <h3 className="nexus-title"><Award size={16} color="var(--role-teacher)" /> EVALUATION LOGS</h3>
          <div className="metric-grid">
            {assessments.map((a, i) => (
              <div key={a.assessment_id} className="glass-card metric-card clickable animate-fade-up"
                   onClick={() => navigate(`/teacher/courses/${a.course_id}/assessments`)}
                   style={{ animationDelay: `${i * 50}ms` }}>
                <span className="metric-label">{a.subject} · GRADE {a.grade}</span>
                <div className="metric-title">{a.title}</div>

                {a.total_attempts > 0 ? (
                  <div className="assessment-nexus">
                    <div className="a-stat">
                       <div className="a-val">{a.total_attempts}</div>
                       <div className="a-lbl">ATTEMPTS</div>
                    </div>
                    <div className="a-stat">
                       <div className="a-val">{a.unique_students}</div>
                       <div className="a-lbl">NODES</div>
                    </div>
                    <div className="a-stat">
                       <div className="a-val" style={{ color: 'var(--role-student)' }}>{a.pass_rate}%</div>
                       <div className="a-lbl">PASS</div>
                    </div>
                  </div>
                ) : (
                  <p className="stat-lbl" style={{ fontStyle: 'italic', marginTop: 'var(--space-2)' }}>Awaiting telemetry data...</p>
                )}
                
                <div className="pass-rate-nexus">
                   <span className="stat-lbl" style={{ flex: 1 }}>AVG: <strong>{a.average_score}</strong></span>
                   <BarChart3 size={12} color="var(--role-teacher)" />
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
      <BottomNav />
    </div>
  );
};

export default TeacherDashboardPage;
