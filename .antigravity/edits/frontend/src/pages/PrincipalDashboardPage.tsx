 // pages.PrincipalDashboardPage
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import { useAuth } from "../auth/AuthContext";

type ClassData = {
  class_id: number;
  class_name: string;
  institution: string;
  total_students: number;
  total_attempts: number;
  average_score: number;
  pass_rate: number;
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--space-4)" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-box" style={{ height, borderRadius: "var(--radius-lg)" }} />
      ))}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="section-header animate-fade-up" style={{ marginTop: "var(--space-8)", marginBottom: "var(--space-4)" }}>
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
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
    <div className="page-shell">
      <TopBar title="Principal" />
      <main className="page-content page-enter">

        {/* Institution banner */}
        {user?.institution && (
          <div className="glass-card animate-fade-up" style={{
            marginBottom: "var(--space-6)",
            border: "1px solid rgba(245,158,11,0.2)",
            background: "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, var(--glass-bg) 60%)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)" }}>
              <div>
                <div className="role-tag role-tag--principal" style={{ marginBottom: "var(--space-2)" }}>🏫 YOUR INSTITUTION</div>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
                  {user.institution}
                </h2>
                {user.district && (
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>{user.district} District</p>
                )}
              </div>
              {!loadingClasses && (
                <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap" }}>
                  {[
                    { value: classes.length,    label: "Classes",  color: "var(--text-primary)" },
                    { value: totalStudents,     label: "Students", color: "var(--role-student)" },
                    { value: `${avgPassRate}%`, label: "Avg Pass", color: avgPassRate >= 70 ? "var(--role-student)" : "var(--warning)" },
                    { value: teachers.length,   label: "Teachers", color: "var(--role-teacher)" },
                  ].map(({ value, label, color }, idx, arr) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)" }}>{label.toUpperCase()}</div>
                      </div>
                      {idx < arr.length - 1 && (
                        <div style={{ width: 1, height: 40, background: "var(--glass-border)" }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-8)", flexWrap: "wrap" }}>
          <button className="btn--secondary" onClick={() => navigate("/principal/users")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Manage Join Codes
          </button>
        </div>

        {error && <div className="alert alert--error animate-fade-up">{error}</div>}

        {/* ── Classes ──────────────────────────────────────────── */}
        <SectionHeader title="Classes" subtitle="Click any class to view student breakdown" />

        {loadingClasses ? (
          <GridSkeleton count={6} height={130} />
        ) : classes.length === 0 ? (
          <div className="glass-card empty-well animate-fade-up">
            <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>🏫</span>
            <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>NO CLASSES YET</p>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Classes will appear once they are set up.</span>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
              {shownClasses.map((c, i) => {
                const passColor = c.pass_rate >= 70 ? "var(--role-student)"
                  : c.pass_rate >= 40 ? "var(--warning)" : "var(--error)";
                return (
                  <div
                    key={c.class_id}
                    className="glass-card animate-fade-up"
                    style={{ animationDelay: `${i * 40}ms`, cursor: "pointer" }}
                    onClick={() => navigate(`/principal/classes/${c.class_id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/principal/classes/${c.class_id}`)}
                  >
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>CLASS</div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--text-primary)", marginBottom: "var(--space-4)", letterSpacing: "-0.03em" }}>
                      {c.class_name}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
                      <span>{c.total_students} students</span>
                      <span style={{ fontWeight: 800, color: passColor }}>{c.pass_rate}% pass</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${c.pass_rate}%`, background: passColor, borderRadius: 99, transition: "width 0.6s" }} />
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-3)" }}>
                      {c.total_attempts} assessment attempts
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMoreClasses && (
              <button className="btn--secondary" onClick={() => setVisibleClasses((v) => v + CLASS_PAGE)} style={{ marginBottom: "var(--space-4)" }}>
                Load more ({classes.length - visibleClasses} remaining)
              </button>
            )}
          </>
        )}

        {/* ── Course Completion ────────────────────────────────── */}
        <SectionHeader
          title="Course Completion"
          subtitle={`${courses.length} courses across your school${courses.length > COURSE_PREVIEW ? ` — showing ${COURSE_PREVIEW}` : ""}`}
        />

        {loadingCourses ? (
          <GridSkeleton count={6} height={110} />
        ) : courses.length === 0 ? (
          <div className="glass-card empty-well animate-fade-up">
            <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>📚</span>
            <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>NO COURSE DATA YET</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
              {shownCourses.map((course, i) => (
                <div
                  key={course.course_id}
                  className="glass-card animate-fade-up"
                  style={{ animationDelay: `${i * 30}ms`, cursor: "pointer" }}
                  onClick={() => navigate(`/principal/courses/${course.course_id}/lessons`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/principal/courses/${course.course_id}/lessons`)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                    <span className="role-tag role-tag--student" style={{ fontSize: 9 }}>CLASS {course.grade}</span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{course.subject}</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)", marginBottom: "var(--space-3)", letterSpacing: "-0.01em" }}>
                    {course.title}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
                    <span>{course.completed_lessons}/{course.total_lessons} lessons</span>
                    <span style={{ fontWeight: 800, color: course.percentage >= 70 ? "var(--role-student)" : "var(--role-teacher)" }}>{course.percentage}%</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${course.percentage}%`, background: course.percentage >= 70 ? "var(--role-student)" : "var(--role-teacher)", borderRadius: 99, transition: "width 0.6s" }} />
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--role-principal)", marginTop: "var(--space-2)", fontWeight: 600 }}>Manage lessons →</div>
                </div>
              ))}
            </div>
            {courses.length > COURSE_PREVIEW && (
              <button className="btn--secondary" onClick={() => setShowAllCourses((v) => !v)} style={{ marginBottom: "var(--space-4)" }}>
                {showAllCourses ? "Show less" : `Show all ${courses.length} courses`}
              </button>
            )}
          </>
        )}

        {/* ── Assessment Analytics ─────────────────────────────── */}
        <SectionHeader
          title="Assessment Performance"
          subtitle={`${assessments.length} assessments${assessments.length > ASSESSMENT_PREVIEW ? ` — showing top ${ASSESSMENT_PREVIEW}` : ""}`}
        />

        {loadingAssessments ? (
          <GridSkeleton count={5} height={140} />
        ) : assessments.length === 0 ? (
          <div className="glass-card empty-well animate-fade-up">
            <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>📋</span>
            <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>NO ASSESSMENT DATA YET</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
              {shownAssessments.map((a, i) => {
                const passColor = a.pass_rate >= 70 ? "var(--role-student)"
                  : a.pass_rate >= 40 ? "var(--warning)" : "var(--error)";
                return (
                  <div key={a.assessment_id} className="glass-card animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
                      {(a.subject ?? a.course).toUpperCase()}
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)", marginBottom: "var(--space-4)", letterSpacing: "-0.01em" }}>
                      {a.title}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                      {[
                        { label: "Attempts",  value: a.total_attempts },
                        { label: "Students",  value: a.unique_students },
                        { label: "Pass Rate", value: `${a.pass_rate}%` },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-base)", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{value}</div>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)" }}>{label.toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${a.pass_rate}%`, background: passColor, borderRadius: 99, transition: "width 0.6s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {assessments.length > ASSESSMENT_PREVIEW && (
              <button className="btn--secondary" onClick={() => setShowAllAssessments((v) => !v)} style={{ marginBottom: "var(--space-4)" }}>
                {showAllAssessments ? "Show less" : `Show all ${assessments.length} assessments`}
              </button>
            )}
          </>
        )}

        {/* ── Teachers ─────────────────────────────────────────── */}
        <SectionHeader title="Teachers" subtitle="All teachers assigned to your institution" />

        {loadingTeachers ? (
          <GridSkeleton count={4} height={80} />
        ) : teachers.length === 0 ? (
          <div className="glass-card empty-well animate-fade-up">
            <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>👩‍🏫</span>
            <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>NO TEACHERS YET</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
            {teachers.map((t, i) => (
              <div key={t.id} className="glass-card animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
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
                    <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{t.username}</div>
                    <div className="role-tag role-tag--teacher" style={{ fontSize: 9, marginTop: 4 }}>TEACHER</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
