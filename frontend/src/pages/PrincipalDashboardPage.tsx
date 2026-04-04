 // pages.PrincipalDashboardPage
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import { useAuth } from "../auth/AuthContext";

type ClassData = {
  class_id: number;
  class_name: string;
  institution: string;
  total_students: number;
  total_attempts: number;
  average_score: number;
  pass_rate: number;
  high_risk_count?: number;
  medium_risk_count?: number;
};

type TeacherData = {
  id: number;
  username: string;
};

type CourseAnalytics = {
  course_id: number;
  title: string;
  subject: string;
  grade: number;
  total_lessons: number;
  completed_lessons: number;
  percentage: number;
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

const CLASS_PAGE          = 6;
const COURSE_PREVIEW      = 6;
const ASSESSMENT_PREVIEW  = 5;

function GridSkeleton({ count = 6, height = 130 }: { count?: number; height?: number }) {
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

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="section-header" style={{ marginTop: "var(--space-10)" }}>
      <div>
        <h2 className="section-header__title">{title}</h2>
        {subtitle && <p className="section-header__subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function PrincipalDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [classes, setClasses]         = useState<ClassData[]>([]);
  const [teachers, setTeachers]       = useState<TeacherData[]>([]);
  const [courses, setCourses]         = useState<CourseAnalytics[]>([]);
  const [assessments, setAssessments] = useState<AssessmentAnalytics[]>([]);
  const [visibleClasses, setVisibleClasses]        = useState(CLASS_PAGE);
  const [showAllCourses, setShowAllCourses]         = useState(false);
  const [showAllAssessments, setShowAllAssessments] = useState(false);
  const [loadingClasses, setLoadingClasses]         = useState(true);
  const [loadingTeachers, setLoadingTeachers]       = useState(true);
  const [loadingCourses, setLoadingCourses]         = useState(true);
  const [loadingAssessments, setLoadingAssessments] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      apiGet<ClassData[]>("/teacher/analytics/classes/"),
      apiGet<TeacherData[]>("/accounts/teachers/"),
      apiGet<CourseAnalytics[]>("/teacher/analytics/courses/"),
      apiGet<AssessmentAnalytics[]>("/teacher/analytics/assessments/"),
    ]).then(([classRes, teacherRes, courseRes, assessmentRes]) => {
      if (classRes.status === "fulfilled")      setClasses(classRes.value ?? []);
      if (teacherRes.status === "fulfilled")    setTeachers(teacherRes.value ?? []);
      if (courseRes.status === "fulfilled")     setCourses(courseRes.value ?? []);
      if (assessmentRes.status === "fulfilled") setAssessments(assessmentRes.value ?? []);
      if (
        classRes.status === "rejected" &&
        teacherRes.status === "rejected" &&
        courseRes.status === "rejected" &&
        assessmentRes.status === "rejected"
      ) {
        setError("Failed to load dashboard data. Please refresh.");
      }
    }).finally(() => {
      setLoadingClasses(false);
      setLoadingTeachers(false);
      setLoadingCourses(false);
      setLoadingAssessments(false);
    });
  }, []);

  const totalStudents = classes.reduce((s, c) => s + c.total_students, 0);
  const avgPassRate   = classes.length
    ? Math.round(classes.reduce((s, c) => s + c.pass_rate, 0) / classes.length)
    : 0;

  const shownClasses     = classes.slice(0, visibleClasses);
  const hasMoreClasses   = visibleClasses < classes.length;
  const shownCourses     = showAllCourses     ? courses     : courses.slice(0, COURSE_PREVIEW);
  const shownAssessments = showAllAssessments ? assessments : assessments.slice(0, ASSESSMENT_PREVIEW);

  return (
    <>

        {/* Institution banner */}
        {user?.institution && (
          <div className="card" style={{
            marginBottom: "var(--space-6)",
            background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, var(--bg-surface) 60%)",
            borderColor: "rgba(245,158,11,0.2)",
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
                  color: "var(--role-principal)",
                  marginBottom: "var(--space-2)",
                }}>
                  Your Institution
                </div>
                <h2 style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  color: "var(--ink-primary)",
                  letterSpacing: "-0.03em",
                }}>
                  {user.institution}
                </h2>
                {user.district && (
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
                    {user.district} District
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap" }}>
                {[
                  { value: classes.length,    label: "Classes",  color: "var(--ink-primary)" },
                  { value: totalStudents,     label: "Students", color: "var(--role-student)" },
                  { value: `${avgPassRate}%`, label: "Avg Pass", color: avgPassRate >= 70 ? "var(--success)" : "var(--warning)" },
                  { value: teachers.length,   label: "Teachers", color: "var(--role-teacher)" },
                ].map(({ value, label, color }, idx, arr) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 800, color }}>
                        {value}
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{label}</div>
                    </div>
                    {idx < arr.length - 1 && (
                      <div style={{ width: 1, height: 40, background: "var(--border-light)" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Quick Actions ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-8)", flexWrap: "wrap" }}>
          <button className="btn btn--secondary" onClick={() => navigate("/principal/users")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Manage Join Codes
          </button>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        {/* ── Classes ──────────────────────────────────────────────────── */}
        <div className="section-header">
          <div>
            <h2 className="section-header__title">Classes</h2>
            <p className="section-header__subtitle">Click any class to view student breakdown</p>
          </div>
        </div>

        {loadingClasses ? (
          <GridSkeleton count={6} height={130} />
        ) : classes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏫</div>
            <h3 className="empty-state__title">No classes yet</h3>
            <p className="empty-state__message">Classes will appear once they are set up.</p>
          </div>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "var(--space-4)",
              marginBottom: "var(--space-4)",
            }}>
              {shownClasses.map((c, i) => {
                const passColor = c.pass_rate >= 70 ? "var(--success)"
                  : c.pass_rate >= 40 ? "var(--warning)" : "var(--error)";
                return (
                  <div
                    key={c.class_id}
                    className="card card--clickable page-enter"
                    style={{ animationDelay: `${i * 40}ms` }}
                    // FIX 2026-03-18: was /teacher/classes/:id — now uses principal-namespaced URL
                    onClick={() => navigate(`/principal/classes/${c.class_id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/principal/classes/${c.class_id}`)}
                  >
                    <div className="card__label">Class</div>
                    <div style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--text-xl)",
                      fontWeight: 800,
                      color: "var(--ink-primary)",
                      marginBottom: "var(--space-4)",
                    }}>
                      {c.class_name}
                    </div>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "var(--text-xs)",
                      color: "var(--ink-muted)",
                      marginBottom: "var(--space-2)",
                    }}>
                      <span>{c.total_students} students</span>
                      <span style={{ fontWeight: 700, color: passColor }}>{c.pass_rate}% pass</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar__fill" style={{ width: `${c.pass_rate}%`, background: passColor }} />
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-3)", marginBottom: "var(--space-2)" }}>
                      {c.total_attempts} assessment attempts
                    </div>
                    {/* Risk Indicators */}
                    <div style={{ display: "flex", gap: "var(--space-2)", minHeight: 20 }}>
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
                  </div>
                );
              })}
            </div>
            {hasMoreClasses && (
              <button
                className="btn btn--secondary"
                onClick={() => setVisibleClasses((v) => v + CLASS_PAGE)}
                style={{ marginBottom: "var(--space-4)" }}
              >
                Load more ({classes.length - visibleClasses} remaining)
              </button>
            )}
          </>
        )}

        {/* ── Course Analytics ──────────────────────────────────────────── */}
        <SectionHeader
          title="Course Completion"
          subtitle={`${courses.length} courses across your school${courses.length > COURSE_PREVIEW ? ` — showing ${COURSE_PREVIEW}` : ""}`}
        />

        {loadingCourses ? (
          <GridSkeleton count={6} height={110} />
        ) : courses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📚</div>
            <h3 className="empty-state__title">No course data yet</h3>
          </div>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "var(--space-4)",
              marginBottom: "var(--space-4)",
            }}>
              {shownCourses.map((course, i) => (
                <div
                  key={course.course_id}
                  className="card card--clickable page-enter"
                  style={{ animationDelay: `${i * 30}ms` }}
                  onClick={() => navigate(`/principal/courses/${course.course_id}/lessons`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/principal/courses/${course.course_id}/lessons`)}
                >
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "var(--space-2)",
                  }}>
                    <span className="badge badge--info">Class {course.grade}</span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                      {course.subject}
                    </span>
                  </div>
                  <div className="card__title" style={{ marginBottom: "var(--space-3)" }}>
                    {course.title}
                  </div>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "var(--text-xs)",
                    color: "var(--ink-muted)",
                    marginBottom: "var(--space-2)",
                  }}>
                    <span>{course.completed_lessons}/{course.total_lessons} lessons</span>
                    <span style={{ fontWeight: 700, color: course.percentage >= 70 ? "var(--success)" : "var(--saffron)" }}>
                      {course.percentage}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar__fill"
                      style={{
                        width: `${course.percentage}%`,
                        background: course.percentage >= 70 ? "var(--success)" : "var(--saffron)",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--role-principal)", marginTop: "var(--space-2)" }}>
                    Manage lessons →
                  </div>
                </div>
              ))}
            </div>
            {courses.length > COURSE_PREVIEW && (
              <button
                className="btn btn--secondary"
                onClick={() => setShowAllCourses((v) => !v)}
                style={{ marginBottom: "var(--space-4)" }}
              >
                {showAllCourses ? "Show less" : `Show all ${courses.length} courses`}
              </button>
            )}
          </>
        )}

        {/* ── Assessment Analytics ──────────────────────────────────────── */}
        <SectionHeader
          title="Assessment Performance"
          subtitle={`${assessments.length} assessments${assessments.length > ASSESSMENT_PREVIEW ? ` — showing top ${ASSESSMENT_PREVIEW}` : ""}`}
        />

        {loadingAssessments ? (
          <GridSkeleton count={5} height={140} />
        ) : assessments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <h3 className="empty-state__title">No assessment data yet</h3>
          </div>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "var(--space-4)",
              marginBottom: "var(--space-4)",
            }}>
              {shownAssessments.map((a, i) => {
                const passColor = a.pass_rate >= 70 ? "var(--success)"
                  : a.pass_rate >= 40 ? "var(--warning)" : "var(--error)";
                return (
                  <div key={a.assessment_id} className="card page-enter" style={{ animationDelay: `${i * 40}ms` }}>
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
                        { label: "Pass Rate", value: `${a.pass_rate}%` },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--ink-primary)" }}>
                            {value}
                          </div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar__fill" style={{ width: `${a.pass_rate}%`, background: passColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {assessments.length > ASSESSMENT_PREVIEW && (
              <button
                className="btn btn--secondary"
                onClick={() => setShowAllAssessments((v) => !v)}
                style={{ marginBottom: "var(--space-4)" }}
              >
                {showAllAssessments ? "Show less" : `Show all ${assessments.length} assessments`}
              </button>
            )}
          </>
        )}

        {/* ── Teachers ─────────────────────────────────────────────────── */}
        <SectionHeader
          title="Teachers"
          subtitle="All teachers assigned to your institution"
        />

        {loadingTeachers ? (
          <GridSkeleton count={4} height={80} />
        ) : teachers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">👩‍🏫</div>
            <h3 className="empty-state__title">No teachers yet</h3>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "var(--space-3)",
          }}>
            {teachers.map((t, i) => (
              <div key={t.id} className="card page-enter" style={{ animationDelay: `${i * 30}ms` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-display)", fontSize: "var(--text-xs)",
                    fontWeight: 800, color: "var(--role-teacher)", flexShrink: 0,
                  }}>
                    {t.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--ink-primary)" }}>
                      {t.username}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Teacher</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </>
  );
}
