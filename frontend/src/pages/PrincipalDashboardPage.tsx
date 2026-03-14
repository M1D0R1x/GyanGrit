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

const PAGE_SIZE = 6;

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

export default function PrincipalDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [classes, setClasses]     = useState<ClassData[]>([]);
  const [teachers, setTeachers]   = useState<TeacherData[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [loadingClasses, setLoadingClasses]   = useState(true);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      apiGet<ClassData[]>("/teacher/analytics/classes/"),
      apiGet<TeacherData[]>("/accounts/teachers/"),
    ]).then(([classRes, teacherRes]) => {
      if (classRes.status === "fulfilled")   setClasses(classRes.value ?? []);
      if (teacherRes.status === "fulfilled") setTeachers(teacherRes.value ?? []);
      if (classRes.status === "rejected" && teacherRes.status === "rejected") {
        setError("Failed to load dashboard data. Please refresh.");
      }
    }).finally(() => {
      setLoadingClasses(false);
      setLoadingTeachers(false);
    });
  }, []);

  const visibleClasses = classes.slice(0, visibleCount);
  const hasMore = visibleCount < classes.length;

  // Summary stats
  const totalStudents = classes.reduce((s, c) => s + c.total_students, 0);
  const avgPassRate = classes.length
    ? Math.round(classes.reduce((s, c) => s + c.pass_rate, 0) / classes.length)
    : 0;

  return (
    <div className="page-shell">
      <TopBar title="Principal" />
      <main className="page-content page-enter">

        {/* Institution banner */}
        {user?.institution && (
          <div className="card" style={{
            marginBottom: "var(--space-8)",
            background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, var(--bg-surface) 60%)",
            borderColor: "rgba(245,158,11,0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)" }}>
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
                  color: "var(--text-primary)",
                  letterSpacing: "-0.03em",
                }}>
                  {user.institution}
                </h2>
                {user.district && (
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                    {user.district} District
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: "var(--space-6)" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-3xl)",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                  }}>
                    {classes.length}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Classes</div>
                </div>
                <div style={{ width: 1, background: "var(--border-subtle)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-3xl)",
                    fontWeight: 800,
                    color: "var(--role-student)",
                  }}>
                    {totalStudents}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Students</div>
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
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Avg Pass Rate</div>
                </div>
                <div style={{ width: 1, background: "var(--border-subtle)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-3xl)",
                    fontWeight: 800,
                    color: "var(--role-teacher)",
                  }}>
                    {teachers.length}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Teachers</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && <div className="alert alert--error">{error}</div>}

        {/* Classes */}
        <div className="section-header">
          <div>
            <h2 className="section-header__title">Classes</h2>
            <p className="section-header__subtitle">
              Click any class to view student breakdown
            </p>
          </div>
        </div>

        {loadingClasses ? (
          <GridSkeleton count={6} height={130} />
        ) : classes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏫</div>
            <h3 className="empty-state__title">No classes yet</h3>
            <p className="empty-state__message">
              Classes will appear here once they are set up in your institution.
            </p>
          </div>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "var(--space-4)",
              marginBottom: "var(--space-4)",
            }}>
              {visibleClasses.map((c, i) => {
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
                      marginBottom: "var(--space-4)",
                    }}>
                      {c.class_name}
                    </div>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-muted)",
                      marginBottom: "var(--space-2)",
                    }}>
                      <span>{c.total_students} students</span>
                      <span style={{ fontWeight: 700, color: passColor }}>{c.pass_rate}% pass</span>
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
                      marginTop: "var(--space-3)",
                    }}>
                      {c.total_attempts} assessment attempts
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <button
                className="btn btn--secondary"
                onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              >
                Load more ({classes.length - visibleCount} remaining)
              </button>
            )}
          </>
        )}

        {/* Teachers */}
        <div className="section-header" style={{ marginTop: "var(--space-10)" }}>
          <div>
            <h2 className="section-header__title">Teachers</h2>
            <p className="section-header__subtitle">
              All teachers assigned to your institution
            </p>
          </div>
        </div>

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
              <div
                key={t.id}
                className="card page-enter"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 800,
                    color: "var(--role-teacher)",
                    flexShrink: 0,
                  }}>
                    {t.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                      {t.username}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      Teacher
                    </div>
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