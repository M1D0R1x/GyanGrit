// pages.TeacherDashboardPage — Glassmorphism 2.0
import { useEffect, useState } from "react";
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

type MyAssignment = {
  subject_id:   number;
  subject_name: string;
  section_id:   number;
  section_name: string;
  class_name:   string;
};

function GridSkeleton({ count = 3, height = 130 }: { count?: number; height?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: "var(--radius-lg)" }} />
      ))}
    </div>
  );
}

function SectionBlock({ title, subtitle, action, children }: {
  title: string; subtitle?: string;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "var(--space-12)" }}>
      <div className="section-header">
        <div>
          <h2 className="section-header__title">{title}</h2>
          {subtitle && <p className="section-header__subtitle">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

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

  const subjectMap = assignments.reduce<Record<string, Set<string>>>((acc, a) => {
    if (!acc[a.subject_name]) acc[a.subject_name] = new Set();
    acc[a.subject_name].add(`Class ${a.class_name}`);
    return acc;
  }, {});

  return (
    <>

        {/* Quick actions */}
        <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-10)", flexWrap: "wrap" }}>
          {[
            { label: "Manage Students", icon: "👥", path: "/teacher/users" },
            { label: "My Classes", icon: "🏫", path: "/teacher/classes" },
            { label: "Flashcards", icon: "🃏", path: "/teacher/flashcards" },
            { label: "AI Tutor", icon: "🤖", path: "/teacher/ai-tutor" },
          ].map(({ label, icon, path }) => (
            <button
              key={path}
              className="btn btn--secondary"
              onClick={() => navigate(path)}
              style={{ gap: "var(--space-2)" }}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* My Subjects */}
        <SectionBlock title="My Subjects">
          {loadingAssignments ? (
            <GridSkeleton count={3} height={90} />
          ) : Object.keys(subjectMap).length === 0 ? (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", fontStyle: "italic" }}>
              No teaching assignments found.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
              {Object.entries(subjectMap).map(([subject, classSet], i) => (
                <div
                  key={subject}
                  className="card page-enter"
                  style={{
                    animationDelay: `${i * 50}ms`,
                    borderColor: "rgba(16,185,129,0.2)",
                    background: "rgba(16,185,129,0.03)",
                  }}
                >
                  <div style={{
                    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)",
                    color: "var(--role-teacher)", marginBottom: "var(--space-3)",
                  }}>
                    {subject}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                    {[...classSet].sort().map((c) => (
                      <span key={c} style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        background: "rgba(16,185,129,0.1)", color: "var(--role-teacher)",
                        border: "1px solid rgba(16,185,129,0.2)",
                      }}>{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionBlock>

        {/* Class Performance */}
        <SectionBlock
          title="Class Performance"
          subtitle="Click a class to see individual student breakdowns"
        >
          {loadingClasses ? <GridSkeleton count={4} height={130} />
          : classes.length === 0 ? (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", fontStyle: "italic" }}>
              No classes assigned yet.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
              {classes.map((c, i) => {
                const passColor =
                  c.pass_rate >= 70 ? "var(--success)" :
                  c.pass_rate >= 40 ? "var(--warning)" :
                  c.total_attempts > 0 ? "var(--error)" : "var(--ink-muted)";
                return (
                  <div
                    key={c.class_id}
                    className="card card--clickable page-enter"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => navigate(`/teacher/classes/${c.class_id}`)}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/teacher/classes/${c.class_id}`)}
                  >
                    <div style={{ padding: "4px 8px", background: "rgba(59,130,246,0.1)", color: "#1e40af", borderRadius: "var(--radius-sm)", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "var(--space-3)", display: "inline-block", border: "1px solid rgba(59,130,246,0.2)" }}>
                      {c.institution ?? "Institution"}
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--ink-primary)", marginBottom: "var(--space-2)", letterSpacing: "-0.02em" }}>
                      Class {c.class_name}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: "var(--space-2)" }}>
                      {c.total_students} student{c.total_students !== 1 ? "s" : ""}
                      {c.total_attempts > 0 && (
                        <> · <span style={{ color: passColor, fontWeight: 700 }}>{c.pass_rate}% pass</span></>
                      )}
                      {c.total_attempts === 0 && " · No attempts yet"}
                    </div>
                    {/* Risk Indicators */}
                    <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)", minHeight: 20 }}>
                      {c.high_risk_count && c.high_risk_count > 0 ? (
                        <div style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: 10, background: "rgba(255, 59, 48, 0.15)", color: "#ff3b30", border: "1px solid rgba(255, 59, 48, 0.3)" }}>
                          {c.high_risk_count} High Risk
                        </div>
                      ) : null}
                      {c.medium_risk_count && c.medium_risk_count > 0 ? (
                        <div style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: 10, background: "rgba(255, 149, 0, 0.15)", color: "#ff9500", border: "1px solid rgba(255, 149, 0, 0.3)" }}>
                          {c.medium_risk_count} Medium Risk
                        </div>
                      ) : null}
                    </div>
                    {c.total_attempts > 0 && (
                      <div className="progress-bar" style={{ margin: 0 }}>
                        <div className="progress-bar__fill" style={{ width: `${c.pass_rate}%`, background: passColor }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionBlock>

        {/* Course Completion */}
        <SectionBlock
          title="Course Completion"
          subtitle="Student progress through curriculum courses"
        >
          {loadingCourses ? <GridSkeleton count={3} height={120} />
          : courses.length === 0 ? (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", fontStyle: "italic" }}>
              No courses found for your subjects.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--space-4)" }}>
              {courses.map((course, i) => {
                const barColor = course.percentage >= 70 ? "var(--success)" : "var(--saffron)";
                return (
                  <div
                    key={course.course_id}
                    className="card card--clickable page-enter"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => navigate(`/teacher/courses/${course.course_id}/lessons`)}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/teacher/courses/${course.course_id}/lessons`)}
                  >
                    <div style={{ padding: "4px 8px", background: "rgba(16,185,129,0.1)", color: "#065f46", borderRadius: "var(--radius-sm)", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "var(--space-3)", display: "inline-block", border: "1px solid rgba(16,185,129,0.2)" }}>
                      {course.subject} · Class {course.grade}
                    </div>
                    <div className="card__title" style={{ marginBottom: "var(--space-3)" }}>{course.title}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: "var(--space-2)" }}>
                      <span>{course.completed_lessons}/{course.total_lessons} lessons</span>
                      <span style={{ fontWeight: 700, color: barColor }}>{course.percentage}%</span>
                    </div>
                    <div className="progress-bar" style={{ margin: 0 }}>
                      <div className="progress-bar__fill" style={{ width: `${course.percentage}%`, background: barColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionBlock>

        {/* Assessment Performance */}
        <SectionBlock
          title="Assessment Performance"
          subtitle="Pass rates across your published tests"
        >
          {loadingAssessments ? <GridSkeleton count={3} height={160} />
          : assessments.length === 0 ? (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", fontStyle: "italic" }}>
              No assessments published yet.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
              {assessments.map((a, i) => {
                const passColor =
                  a.pass_rate >= 70 ? "var(--success)" :
                  a.pass_rate >= 40 ? "var(--warning)" :
                  a.total_attempts > 0 ? "var(--error)" : "var(--ink-muted)";
                return (
                  <div
                    key={a.assessment_id}
                    className="card card--clickable page-enter"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => navigate(`/teacher/courses/${a.course_id}/assessments`)}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/teacher/courses/${a.course_id}/assessments`)}
                  >
                    <div style={{ padding: "4px 8px", background: "rgba(245,158,11,0.1)", color: "#92400e", borderRadius: "var(--radius-sm)", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "var(--space-3)", display: "inline-block", border: "1px solid rgba(245,158,11,0.2)" }}>
                      {a.subject} · Class {a.grade}
                    </div>
                    <div className="card__title" style={{ marginBottom: "var(--space-4)" }}>{a.title}</div>
                    {a.total_attempts > 0 ? (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                          {[
                            { label: "Attempts", value: a.total_attempts },
                            { label: "Students", value: a.unique_students },
                            { label: "Pass", value: `${a.pass_rate}%` },
                          ].map(({ label, value }) => (
                            <div key={label} style={{ textAlign: "center" }}>
                              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-base)", color: "var(--ink-primary)" }}>
                                {value}
                              </div>
                              <div style={{ fontSize: 10, color: "var(--ink-muted)" }}>{label}</div>
                            </div>
                          ))}
                        </div>
                        <div className="progress-bar" style={{ margin: 0 }}>
                          <div className="progress-bar__fill" style={{ width: `${a.pass_rate}%`, background: passColor }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-2)" }}>
                          <span>Avg: <strong style={{ color: "var(--ink-primary)" }}>{a.average_score}</strong></span>
                          <span style={{ color: "var(--success)" }}>✓ {a.pass_count} passed</span>
                        </div>
                      </>
                    ) : (
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontStyle: "italic" }}>
                        No attempts yet
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionBlock>
    </>
  );
}
