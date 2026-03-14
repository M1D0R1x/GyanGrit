import { useEffect, useState, useCallback } from "react";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import { useAuth } from "../auth/AuthContext";

type CourseAnalytics = {
  course_id: number;
  title: string;
  subject: string;
  grade: number;
  total_lessons: number;
  completed_lessons: number;
  percentage: number;
};

type ClassAnalytics = {
  class_id: number;
  class_name: string;
  institution: string;
  total_students: number;
  total_attempts: number;
  average_score: number;
  pass_rate: number;
};

type AssessmentAnalytics = {
  assessment_id: number;
  title: string;
  course: string;
  subject: string | null;
  total_attempts: number;
  unique_students: number;
  average_score: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
};

// Loading and data are a single state object.
// This means only ONE setState call fires in the effect — no cascading renders.
type DashboardState =
  | { loading: true }
  | {
      loading: false;
      classes: ClassAnalytics[];
      courses: CourseAnalytics[];
      assessments: AssessmentAnalytics[];
    };

function StatCard({ label, value, accent }: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="card">
      <div className="card__label">{label}</div>
      <div className="card__value" style={{ color: accent ?? "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-header__title">{title}</h2>
        {subtitle && <p className="section-header__subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}

function GridSkeleton({ count = 3, height = 120 }: { count?: number; height?: number }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      gap: "var(--space-4)",
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: "var(--radius-lg)" }} />
      ))}
    </div>
  );
}

export default function OfficialDashboardPage() {
  const { user } = useAuth();

  const [state, setState] = useState<DashboardState>({ loading: true });
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    const [classRes, courseRes, assessmentRes] = await Promise.allSettled([
      apiGet<ClassAnalytics[]>("/teacher/analytics/classes/"),
      apiGet<CourseAnalytics[]>("/teacher/analytics/courses/"),
      apiGet<AssessmentAnalytics[]>("/teacher/analytics/assessments/"),
    ]);

    // Single setState call — loading + data transition in one update.
    // This is the only way to fully satisfy react-hooks/set-state-in-effect
    // when multiple pieces of state must change together.
    setState({
      loading: false,
      classes:     classRes.status      === "fulfilled" ? (classRes.value      ?? []) : [],
      courses:     courseRes.status     === "fulfilled" ? (courseRes.value     ?? []) : [],
      assessments: assessmentRes.status === "fulfilled" ? (assessmentRes.value ?? []) : [],
    });
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Derived values — only computed when not loading
  const classes     = state.loading ? [] : state.classes;
  const courses     = state.loading ? [] : state.courses;
  const assessments = state.loading ? [] : state.assessments;

  const institutions = [...new Set(classes.map((c) => c.institution))].sort();
  const filteredClasses = selectedInstitution
    ? classes.filter((c) => c.institution === selectedInstitution)
    : classes;
  const totalStudents = classes.reduce((sum, c) => sum + c.total_students, 0);
  const avgPassRate = classes.length
    ? Math.round(classes.reduce((sum, c) => sum + c.pass_rate, 0) / classes.length)
    : 0;

  const loading = state.loading;

  return (
    <div className="page-shell">
      <TopBar title="Official" />
      <main className="page-content page-enter">

        {/* District Banner */}
        <div className="card" style={{
          marginBottom: "var(--space-8)",
          background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, var(--bg-surface) 60%)",
          borderColor: "rgba(139,92,246,0.2)",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--space-4)",
          }}>
            <div>
              <div style={{
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--role-official)",
                marginBottom: "var(--space-2)",
              }}>
                District Scope
              </div>
              <h2 style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-2xl)",
                fontWeight: 800,
                color: "var(--text-primary)",
                letterSpacing: "-0.03em",
              }}>
                {user?.district ?? "All Districts"}
              </h2>
              <p style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                marginTop: "var(--space-1)",
              }}>
                Data is automatically scoped to your district
              </p>
            </div>

            {!loading && (
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-3xl)",
                    fontWeight: 800,
                    color: "var(--role-official)",
                  }}>
                    {institutions.length}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    Schools
                  </div>
                </div>
                <div style={{ width: 1, background: "var(--border-subtle)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-3xl)",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                  }}>
                    {totalStudents}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    Students
                  </div>
                </div>
                <div style={{ width: 1, background: "var(--border-subtle)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-3xl)",
                    fontWeight: 800,
                    color: avgPassRate >= 70 ? "var(--success)" : "var(--warning)",
                  }}>
                    {avgPassRate}%
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    Avg Pass Rate
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary stats */}
        {loading ? (
          <div className="stat-grid" style={{ marginBottom: "var(--space-8)" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 90, borderRadius: "var(--radius-lg)" }} />
            ))}
          </div>
        ) : (
          <div className="stat-grid" style={{ marginBottom: "var(--space-8)" }}>
            <StatCard label="Total Classes"  value={classes.length} />
            <StatCard label="Total Students" value={totalStudents}
              accent="var(--role-student)" />
            <StatCard label="Avg Pass Rate"  value={`${avgPassRate}%`}
              accent={avgPassRate >= 70 ? "var(--success)" : "var(--warning)"} />
            <StatCard label="Active Courses" value={courses.length}
              accent="var(--brand-primary)" />
          </div>
        )}

        {/* Class Performance */}
        <SectionHeader
          title="Class Performance"
          subtitle="Filter by school to drill down"
        />

        {!loading && institutions.length > 1 && (
          <div style={{
            display: "flex",
            gap: "var(--space-2)",
            flexWrap: "wrap",
            marginBottom: "var(--space-5)",
          }}>
            {[null, ...institutions].map((inst) => (
              <button
                key={inst ?? "__all__"}
                className="badge"
                style={{
                  cursor: "pointer",
                  border: "1px solid var(--border-default)",
                  background: selectedInstitution === inst
                    ? "rgba(88,166,255,0.12)"
                    : "transparent",
                  color: selectedInstitution === inst
                    ? "var(--info)"
                    : "var(--text-muted)",
                  padding: "var(--space-1) var(--space-3)",
                }}
                onClick={() => setSelectedInstitution(inst)}
              >
                {inst ?? "All Schools"}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <GridSkeleton count={6} height={130} />
        ) : filteredClasses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏫</div>
            <h3 className="empty-state__title">No class data</h3>
            <p className="empty-state__message">
              Class analytics will appear once students are enrolled and active.
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "var(--space-4)",
            marginBottom: "var(--space-10)",
          }}>
            {filteredClasses.map((c, i) => {
              const passColor = c.pass_rate >= 70
                ? "var(--success)"
                : c.pass_rate >= 40
                ? "var(--warning)"
                : "var(--error)";

              return (
                <div
                  key={c.class_id}
                  className="card page-enter"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                    marginBottom: "var(--space-2)",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}>
                    {c.institution}
                  </div>
                  <div style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-lg)",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: "var(--space-4)",
                  }}>
                    Class {c.class_name}
                  </div>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                    marginBottom: "var(--space-2)",
                  }}>
                    <span>{c.total_students} students</span>
                    <span style={{ fontWeight: 700, color: passColor }}>
                      {c.pass_rate}% pass
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar__fill"
                      style={{ width: `${c.pass_rate}%`, background: passColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Course Analytics */}
        <SectionHeader
          title="Course Analytics"
          subtitle="Aggregated completion rates across your district"
        />

        {loading ? (
          <GridSkeleton count={4} height={100} />
        ) : courses.length === 0 ? (
          <div className="empty-state" style={{ padding: "var(--space-8)" }}>
            <div className="empty-state__icon">📚</div>
            <h3 className="empty-state__title">No course data yet</h3>
            <p className="empty-state__message">
              Courses will appear here once content is published.
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "var(--space-4)",
            marginBottom: "var(--space-10)",
          }}>
            {courses.map((course, i) => (
              <div
                key={course.course_id}
                className="card page-enter"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "var(--space-2)",
                }}>
                  <span className="badge badge--info">Class {course.grade}</span>
                  {course.subject && (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      {course.subject}
                    </span>
                  )}
                </div>
                <div className="card__title" style={{ marginBottom: "var(--space-3)" }}>
                  {course.title}
                </div>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
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
                      background: course.percentage >= 70
                        ? "var(--success)"
                        : "var(--brand-primary)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Assessment Analytics */}
        <SectionHeader
          title="Assessment Analytics"
          subtitle="Pass rates and attempt counts across your district"
        />

        {loading ? (
          <GridSkeleton count={3} height={140} />
        ) : assessments.length === 0 ? (
          <div className="empty-state" style={{ padding: "var(--space-8)" }}>
            <div className="empty-state__icon">📋</div>
            <h3 className="empty-state__title">No assessment data yet</h3>
          </div>
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
                  className="card page-enter"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="card__label">{a.subject ?? a.course}</div>
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
                      { label: "Avg Score", value: a.average_score },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ textAlign: "center" }}>
                        <div style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: "var(--text-lg)",
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
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                    marginBottom: "var(--space-1)",
                  }}>
                    <span>{a.pass_count} passed · {a.fail_count} failed</span>
                    <span style={{ fontWeight: 700, color: passColor }}>{a.pass_rate}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar__fill"
                      style={{ width: `${a.pass_rate}%`, background: passColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}