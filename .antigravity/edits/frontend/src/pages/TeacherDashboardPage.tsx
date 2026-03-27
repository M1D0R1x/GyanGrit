// pages.TeacherDashboardPage
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
import BottomNav from "../components/BottomNav"; // Added for Obsidian UI shell

type MyAssignment = {
  subject_id:   number;
  subject_name: string;
  section_id:   number;
  section_name: string;
  class_name:   string;
};

// ── Skeleton helpers ────────────────────────────────────────────────────────

function GridSkeleton({ count = 3, height = 130 }: { count?: number; height?: number }) {
  return (
    <div style={{
      display:             "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
      gap:                 "var(--space-4)",
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: "var(--radius-lg)" }} />
      ))}
    </div>
  );
}

function SectionBlock({ title, subtitle, children }: {
  title:     string;
  subtitle?: string;
  children:  React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "var(--space-12)" }}>
      <div className="section-header">
        <div>
          <h2 className="section-header__title" style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{title.toUpperCase()}</h2>
          {subtitle && <p className="section-header__subtitle" style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", fontStyle: "italic", padding: "var(--space-6) 0" }}>
      {message}
    </p>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TeacherDashboardPage() {
  const navigate = useNavigate();

  const [courses,     setCourses]     = useState<TeacherCourseAnalytics[]>([]);
  const [assessments, setAssessments] = useState<TeacherAssessmentAnalytics[]>([]);
  const [classes,     setClasses]     = useState<TeacherClassAnalytics[]>([]);
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);

  const [loadingCourses,     setLoadingCourses]     = useState(true);
  const [loadingAssessments, setLoadingAssessments] = useState(true);
  const [loadingClasses,     setLoadingClasses]     = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  useEffect(() => {
    getTeacherCourseAnalytics()
      .then((d) => setCourses(d ?? []))
      .catch(() => {})
      .finally(() => setLoadingCourses(false));

    getTeacherAssessmentAnalytics()
      .then((d) => setAssessments(d ?? []))
      .catch(() => {})
      .finally(() => setLoadingAssessments(false));

    getTeacherClassAnalytics()
      .then((d) => setClasses(d ?? []))
      .catch(() => {})
      .finally(() => setLoadingClasses(false));

    apiGet<MyAssignment[]>("/academics/my-assignments/")
      .then((d) => setAssignments(d ?? []))
      .catch(() => {})
      .finally(() => setLoadingAssignments(false));
  }, []);

  // Group assignments by subject for the "My Subjects" cards
  const subjectMap = assignments.reduce<Record<string, Set<string>>>((acc, a) => {
    if (!acc[a.subject_name]) acc[a.subject_name] = new Set();
    acc[a.subject_name].add(`Class ${a.class_name}`);
    return acc;
  }, {});

  return (
    <div className="page-shell">
      <TopBar title="Instructor Interface" />
      <main className="page-content page-enter has-bottom-nav" style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--space-10) var(--space-6)' }}>

        {/* ── Quick Actions ──────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-8)", flexWrap: "wrap" }}>
          <button className="btn--secondary" onClick={() => navigate("/teacher/users")} style={{ padding: '12px 24px', fontSize: '12px', letterSpacing: '0.1em' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            GENERATE STUDENT CODES
          </button>
        </div>

        {/* ── My Subjects ────────────────────────────────────────────── */}
        <SectionBlock title="My Subjects" subtitle="Assigned Modules">
          {loadingAssignments ? (
            <GridSkeleton count={3} height={90} />
          ) : Object.keys(subjectMap).length === 0 ? (
            <EmptyState message="No teaching assignments found." />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
              {Object.entries(subjectMap).map(([subject, classSet], i) => (
                <div
                  key={subject}
                  className="glass-card page-enter"
                  style={{
                    animationDelay: `${i * 50}ms`,
                    borderBottom: '2px solid var(--role-teacher)'
                  }}
                >
                  <div style={{
                    fontSize: '16px', fontWeight: 900, letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '12px'
                  }}>
                    {subject.toUpperCase()}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                    {[...classSet].sort().map((c) => (
                      <span key={c} style={{ fontSize: '10px', fontWeight: 800, background: 'rgba(56, 189, 248, 0.1)', color: 'var(--role-student)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionBlock>

        {/* ── Class Performance ──────────────────────────────────────── */}
        {/*
          FIX 2026-03-18:
          - Uses class_id (not c.id) for navigate and key
          - Uses class_name (not c.name) for display
          - Renders total_students and pass_rate from enriched backend response
          - No more NaN in URL
        */}
        <SectionBlock
          title="Class Performance"
          subtitle="Click a class to see individual student breakdowns"
        >
          {loadingClasses ? (
            <GridSkeleton count={4} height={130} />
          ) : classes.length === 0 ? (
            <EmptyState message="No classes found. You may not be assigned to any classrooms yet." />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "var(--space-4)" }}>
              {classes.map((c, i) => {
                const passColor =
                  c.pass_rate >= 70 ? "var(--role-student)" :
                  c.pass_rate >= 40 ? "var(--warning)" :
                  c.total_attempts > 0 ? "var(--error)" :
                  "var(--text-muted)";

                return (
                  <div
                    key={c.class_id}
                    className="glass-card page-enter"
                    style={{ animationDelay: `${i * 40}ms`, cursor: 'pointer', position: 'relative' }}
                    onClick={() => navigate(`/teacher/classes/${c.class_id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/teacher/classes/${c.class_id}`)}
                  >
                    <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{c.institution || "INSTITUTION"}</span>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px', marginBottom: '16px' }}>CLASS {c.class_name}</div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <div>
                        <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>{c.total_students}</span>
                        <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>STUDENTS</span>
                      </div>
                      {c.total_attempts > 0 ? (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '20px', fontWeight: 800, color: passColor, display: 'block' }}>{c.pass_rate}%</span>
                          <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>PASS RATE</span>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>NO LOGS</span>
                        </div>
                      )}
                    </div>

                    {c.total_attempts > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1, height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${c.pass_rate}%`, background: passColor }} />
                        </div>
                        <span style={{ fontSize: '14px', color: 'var(--role-teacher)' }}>➔</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionBlock>

        {/* ── Course Completion ──────────────────────────────────────── */}
        {/*
          FIX 2026-03-18:
          - Uses course_id (not course.id) for navigate and key
          - Renders percentage and completed_lessons from enriched backend response
          - Scoped to teacher's subjects only on backend — no more all-course bleed
        */}
        <SectionBlock
          title="Course Completion"
          subtitle="Progress of your enrolled students through each course"
        >
          {loadingCourses ? (
            <GridSkeleton count={3} height={120} />
          ) : courses.length === 0 ? (
            <EmptyState message="No courses found for your assigned subjects." />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
              {courses.map((course, i) => {
                const barColor = course.percentage >= 70 ? "var(--success)" : "var(--brand-primary)";
                return (
                  <div
                    key={course.course_id}
                    className="glass-card page-enter"
                    style={{ animationDelay: `${i * 40}ms`, cursor: 'pointer' }}
                    onClick={() => navigate(`/teacher/courses/${course.course_id}/lessons`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/teacher/courses/${course.course_id}/lessons`)}
                  >
                    <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{course.subject} · GRADE {course.grade}</span>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px', marginBottom: '16px', lineHeight: 1.3 }}>{course.title}</div>
    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                       <div>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>{course.completed_lessons}/{course.total_lessons}</span>
                          <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>UNITS SYNCED</span>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--role-student)', display: 'block' }}>{course.percentage}%</span>
                          <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>COMPLETION</span>
                       </div>
                    </div>
    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <div style={{ flex: 1, height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${course.percentage}%`, background: barColor }} />
                       </div>
                       <span style={{ fontSize: '14px', color: 'var(--role-teacher)' }}>📈</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionBlock>

        {/* ── Assessment Performance ─────────────────────────────────── */}
        {/*
          FIX 2026-03-18:
          - Uses assessment_id (not a.id) for key
          - Renders unique_students, pass_rate, average_score, fail_count
          - Scoped to teacher's subjects only on backend
        */}
        <SectionBlock
          title="Assessment Performance"
          subtitle="Pass rates and attempt stats for assessments in your subjects"
        >
          {loadingAssessments ? (
            <GridSkeleton count={3} height={160} />
          ) : assessments.length === 0 ? (
            <EmptyState message="No assessments published for your subjects yet." />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
               {assessments.map((a, i) => {
                 const passColor =
                   a.pass_rate >= 70 ? "var(--success)" :
                   a.pass_rate >= 40 ? "var(--warning)" :
                   a.total_attempts > 0 ? "var(--error)" :
                   "var(--text-muted)";
 
                 return (
                  <div
                    key={a.assessment_id}
                    className="glass-card page-enter"
                    style={{ animationDelay: `${i * 40}ms`, cursor: 'pointer' }}
                    onClick={() => navigate(`/teacher/courses/${a.course_id}/assessments`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/teacher/courses/${a.course_id}/assessments`)}
                  >
                     <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{a.subject} · GRADE {a.grade}</span>
                     <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px', marginBottom: '16px', lineHeight: 1.3 }}>{a.title}</div>
     
                     {a.total_attempts > 0 ? (
                       <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '4px' }}>
                         <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{a.total_attempts}</div>
                            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>ATTEMPTS</div>
                         </div>
                         <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{a.unique_students}</div>
                            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>STUDENTS</div>
                         </div>
                         <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: passColor }}>{a.pass_rate}%</div>
                            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>PASS</div>
                         </div>
                       </div>
                     ) : (
                       <p style={{ fontSize: '12px', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '16px' }}>No attempts yet</p>
                     )}
                     
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AVG SCORE: <strong style={{ color: 'var(--text-primary)' }}>{a.average_score}</strong></span>
                        {a.total_attempts > 0 && <span style={{ fontSize: '14px', color: 'var(--success)' }}>✓ {a.pass_count} passed</span>}
                     </div>
                   </div>
                 );
               })}
             </div>
          )}
        </SectionBlock>

      </main>
      <BottomNav />
    </div>
  );
}
