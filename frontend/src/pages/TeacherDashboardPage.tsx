// pages.TeacherDashboardPage
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
import TopBar from "../components/TopBar";

type MyAssignment = {
  subject_id: number;
  subject_name: string;
  section_id: number;
  section_name: string;
  class_name: string;
};

function GridSkeleton({ count = 3, height = 130 }: { count?: number; height?: number }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
      gap: "var(--space-4)",
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: "var(--radius-lg)" }} />
      ))}
    </div>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--space-12)" }}>
      <div className="section-header">
        <h2 className="section-header__title">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: "var(--space-8) 0" }}>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", fontStyle: "italic" }}>
        {message}
      </p>
    </div>
  );
}

export default function TeacherDashboardPage() {
  const navigate = useNavigate();

  const [courses, setCourses]         = useState<TeacherCourseAnalytics[]>([]);
  const [assessments, setAssessments] = useState<TeacherAssessmentAnalytics[]>([]);
  const [classes, setClasses]         = useState<TeacherClassAnalytics[]>([]);
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);

  const [loadingCourses, setLoadingCourses]         = useState(true);
  const [loadingAssessments, setLoadingAssessments] = useState(true);
  const [loadingClasses, setLoadingClasses]         = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  useEffect(() => {
    getTeacherCourseAnalytics()
      .then((d) => setCourses(d ?? []))
      .finally(() => setLoadingCourses(false));

    getTeacherAssessmentAnalytics()
      .then((d) => setAssessments(d ?? []))
      .finally(() => setLoadingAssessments(false));

    getTeacherClassAnalytics()
      .then((d) => setClasses(d ?? []))
      .finally(() => setLoadingClasses(false));

    apiGet<MyAssignment[]>("/academics/my-assignments/")
      .then((d) => setAssignments(d ?? []))
      .finally(() => setLoadingAssignments(false));
  }, []);

  // Group assignments by subject, deduplicate class names
  const subjectMap = assignments.reduce<Record<string, Set<string>>>((acc, a) => {
    if (!acc[a.subject_name]) acc[a.subject_name] = new Set();
    acc[a.subject_name].add(`Class ${a.class_name}`);
    return acc;
  }, {});

  return (
    <div className="page-shell">
      <TopBar title="Teacher" />
      <main className="page-content page-enter">

        {/* ── Quick Actions ─────────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          gap: "var(--space-3)",
          marginBottom: "var(--space-8)",
          flexWrap: "wrap",
        }}>
          <button
            className="btn btn--secondary"
            onClick={() => navigate("/teacher/users")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Manage Student Codes
          </button>
        </div>

        {/* ── My Subjects ────────────────────────────────────────────────── */}
        <SectionBlock title="My Subjects">
          {loadingAssignments ? (
            <GridSkeleton count={3} height={90} />
          ) : Object.keys(subjectMap).length === 0 ? (
            <EmptyState message="No teaching assignments found." />
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "var(--space-3)",
            }}>
              {Object.entries(subjectMap).map(([subject, classSet], i) => (
                <div
                  key={subject}
                  className="card page-enter"
                  style={{
                    animationDelay: `${i * 50}ms`,
                    borderColor: "rgba(59,130,246,0.2)",
                    background: "rgba(59,130,246,0.04)",
                  }}
                >
                  <div style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "var(--text-base)",
                    color: "var(--brand-primary)",
                    marginBottom: "var(--space-3)",
                  }}>
                    {subject}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                    {[...classSet].sort().map((c) => (
                      <span key={c} className="badge badge--info">{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionBlock>

        {/* ── Class Performance ──────────────────────────────────────────── */}
        <SectionBlock title="Class Performance">
          {loadingClasses ? (
            <GridSkeleton count={5} height={130} />
          ) : classes.length === 0 ? (
            <EmptyState message="No class data yet — students may not be enrolled." />
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "var(--space-3)",
            }}>
              {classes.map((c, i) => {
                const passColor = c.pass_rate >= 70
                  ? "var(--success)"
                  : c.pass_rate >= 40
                  ? "var(--warning)"
                  : "var(--error)";

                return (
                  <div
                    key={c.class_id}
                    className="card card--clickable page-enter"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => navigate(`/teacher/classes/${c.class_id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/teacher/classes/${c.class_id}`)}
                  >
                    <div className="card__label">Class</div>
                    <div style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--text-xl)",
                      fontWeight: 800,
                      color: "var(--text-primary)",
                      marginBottom: "var(--space-3)",
                    }}>
                      {c.class_name}
                    </div>
                    <div style={{
                      display: "flex",
                      gap: "var(--space-4)",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-muted)",
                      marginBottom: "var(--space-2)",
                    }}>
                      <span>{c.total_students} students</span>
                      <span style={{ color: passColor, fontWeight: 600 }}>{c.pass_rate}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-bar__fill"
                        style={{ width: `${c.pass_rate}%`, background: passColor }}
                      />
                    </div>
                    <div style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-muted)",
                      marginTop: "var(--space-2)",
                    }}>
                      View students →
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionBlock>

        {/* ── Course Completion ──────────────────────────────────────────── */}
        <SectionBlock title="Course Completion">
          {loadingCourses ? (
            <GridSkeleton count={3} height={120} />
          ) : courses.length === 0 ? (
            <EmptyState message="No courses found for your subject." />
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "var(--space-4)",
            }}>
              {courses.map((course, i) => (
                <div
                  key={course.course_id}
                  className="card card--clickable page-enter"
                  style={{ animationDelay: `${i * 40}ms` }}
                  onClick={() => navigate(`/teacher/courses/${course.course_id}/lessons`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/teacher/courses/${course.course_id}/lessons`)}
                >
                  {course.subject && (
                    <div className="card__label">{course.subject}</div>
                  )}
                  <div className="card__title" style={{ marginBottom: "var(--space-3)" }}>
                    {course.title}
                  </div>
                  <div style={{
                    display: "flex",
                    gap: "var(--space-4)",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                    marginBottom: "var(--space-2)",
                  }}>
                    <span>{course.completed_lessons}/{course.total_lessons} lessons</span>
                    <span style={{
                      fontWeight: 700,
                      color: course.percentage >= 70 ? "var(--success)" : "var(--brand-primary)",
                    }}>
                      {course.percentage}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar__fill"
                      style={{
                        width: `${course.percentage}%`,
                        background: course.percentage >= 70 ? "var(--success)" : "var(--brand-primary)",
                      }}
                    />
                  </div>
                  <div style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--brand-primary)",
                    marginTop: "var(--space-2)",
                  }}>
                    Manage lessons →
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionBlock>

        {/* ── Assessment Performance ─────────────────────────────────────── */}
        <SectionBlock title="Assessment Performance">
          {loadingAssessments ? (
            <GridSkeleton count={3} height={140} />
          ) : assessments.length === 0 ? (
            <EmptyState message="No assessment data yet." />
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "var(--space-4)",
            }}>
              {assessments.map((a, i) => {
                const passColor = a.pass_rate >= 70
                  ? "var(--success)"
                  : a.pass_rate >= 40
                  ? "var(--warning)"
                  : "var(--error)";

                return (
                  <div
                    key={a.assessment_id}
                    className="card card--clickable page-enter"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => navigate(`/teacher/courses/${a.course_id}/assessments`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/teacher/courses/${a.course_id}/assessments`)}
                  >
                    <div className="card__label">{a.course}</div>
                    <div className="card__title" style={{ marginBottom: "var(--space-4)" }}>
                      {a.title}
                    </div>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "var(--space-3)",
                      marginBottom: "var(--space-3)",
                    }}>
                      {[
                        { label: "Attempts", value: a.total_attempts },
                        { label: "Students", value: a.unique_students },
                        { label: "Pass Rate", value: `${a.pass_rate}%` },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ textAlign: "center" }}>
                          <div style={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            fontSize: "var(--text-base)",
                            color: "var(--text-primary)",
                          }}>
                            {value}
                          </div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-bar__fill"
                        style={{ width: `${a.pass_rate}%`, background: passColor }}
                      />
                    </div>
                    <div style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--warning)",
                      marginTop: "var(--space-2)",
                    }}>
                      Manage assessment →
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionBlock>

      </main>
    </div>
  );
}