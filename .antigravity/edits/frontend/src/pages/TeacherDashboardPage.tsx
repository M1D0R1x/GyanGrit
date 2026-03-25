import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getTeacherCourseAnalytics,
  getTeacherAssessmentAnalytics,
  getTeacherClassAnalytics,
  type TeacherCourseAnalytics,
  type TeacherAssessmentAnalytics,
  type TeacherClassAnalytics,
} from '../services/teacherAnalytics';
import { apiGet } from '../services/api';
import TopBar from '../components/TopBar';

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
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [courseData, assessData, classData, assignData] = await Promise.all([
          getTeacherCourseAnalytics(),
          getTeacherAssessmentAnalytics(),
          getTeacherClassAnalytics(),
          apiGet<MyAssignment[]>("/academics/my-assignments/")
        ]);
        setCourses(courseData || []);
        setAssessments(assessData || []);
        setClasses(classData || []);
        setAssignments(assignData || []);
      } catch (err) {
        console.error("Teacher Dashboard load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

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
      <TopBar title="Command Center" />
      <main className="page-content page-enter">
        {/* Editorial Header */}
        <section className="editorial-header animate-fade-up">
           <div className="role-tag role-tag--teacher" style={{ marginBottom: 'var(--space-4)' }}>
             🌱 Lead Educator
           </div>
           <h1 className="text-gradient" style={{ fontSize: 'clamp(32px, 8vw, 48px)', lineHeight: 1.1, marginBottom: 'var(--space-2)' }}>
             Classroom<br/>
             Health & Progress.
           </h1>
           <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)', maxWidth: '500px' }}>
             Real-time insights across your assigned subjects and classrooms.
           </p>
        </section>

        {/* Quick Insights Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-12)' }}>
          <div className="glass-card" style={{ padding: 'var(--space-5)', border: '1px solid var(--role-teacher)22' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 'var(--space-1)' }}>Total Students</div>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, fontFamily: 'var(--font-display)' }}>124</div>
          </div>
          <div className="glass-card" style={{ padding: 'var(--space-5)', border: '1px solid var(--role-teacher)22' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 'var(--space-1)' }}>Avg. Pass Rate</div>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--role-teacher)' }}>82%</div>
          </div>
          <div className="glass-card" style={{ padding: 'var(--space-5)', border: '1px solid var(--role-teacher)22' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 'var(--space-1)' }}>Pending Reviews</div>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, fontFamily: 'var(--font-display)' }}>12</div>
          </div>
        </div>

        {/* Class Performance Grid */}
        <div className="section-header">
           <h2 className="section-header__title">Classroom Mastery</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-12)' }}>
          {classes.map((c) => (
            <div 
              key={c.class_id} 
              className="glass-card"
              style={{ padding: 'var(--space-6)', cursor: 'pointer' }}
              onClick={() => navigate(`/teacher/classes/${c.class_id}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <span className="role-tag role-tag--teacher" style={{ fontSize: '9px' }}>CLASS {c.class_name}</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--role-teacher)' }}>{c.pass_rate}% PASS</span>
              </div>
              <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)' }}>{c.institution || 'GyanGrit School'}</h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-6)' }}>
                {c.total_students} Students enrolled.
              </p>
              <div className="progress-bar">
                <div className="progress-bar__fill" style={{ width: `${c.pass_rate}%`, background: 'var(--role-teacher)' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Assessment Trends */}
        <div className="section-header">
           <h2 className="section-header__title">Assessment Pulse</h2>
        </div>
        <div style={{ maxWidth: '900px' }}>
          {assessments.map((a) => (
            <div 
              key={a.assessment_id} 
              className="assessment-row"
              onClick={() => navigate(`/teacher/courses/${a.course_id}/assessments`)}
            >
              <div className="assessment-row__icon" style={{ background: 'var(--role-teacher)12', color: 'var(--role-teacher)' }}>
                📈
              </div>
              <div style={{ flex: 1 }}>
                <div className="assessment-row__title">{a.title}</div>
                <div className="assessment-row__meta">
                  <span>{a.subject} • CLASS {a.grade}</span>
                  <span style={{ color: a.pass_rate > 70 ? 'var(--success)' : 'var(--warning)', fontWeight: 800 }}>
                    {a.pass_rate}% PASS RATE ({a.total_attempts} ATTEMPTS)
                  </span>
                </div>
              </div>
              <button className="assessment-row__btn">ANALYZE</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default TeacherDashboardPage;
