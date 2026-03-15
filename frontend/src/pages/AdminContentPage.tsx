import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCourses, type CourseItem } from "../services/content";
import TopBar from "../components/TopBar";

type GroupedCourses = Record<string, CourseItem[]>;

function CourseSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-line skeleton-line--short" />
      <div className="skeleton skeleton-line skeleton-line--title" style={{ marginTop: "var(--space-3)" }} />
      <div className="skeleton skeleton-line skeleton-line--medium" style={{ marginTop: "var(--space-2)" }} />
    </div>
  );
}

export default function AdminContentPage() {
  const navigate = useNavigate();
  const [courses, setCourses]       = useState<CourseItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);

  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch(() => setError("Failed to load courses."))
      .finally(() => setLoading(false));
  }, []);

  const grades = [...new Set(courses.map((c) => c.grade))].sort((a, b) => a - b);

  const filtered = selectedGrade
    ? courses.filter((c) => c.grade === selectedGrade)
    : courses;

  // Group by subject name
  const grouped: GroupedCourses = filtered.reduce((acc, course) => {
    const key = course.subject__name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(course);
    return acc;
  }, {} as GroupedCourses);

  return (
    <div className="page-shell">
      <TopBar title="Content" />
      <main className="page-content page-enter">

        <div className="section-header">
          <div>
            <h2 className="section-header__title">Curriculum Management</h2>
            <p className="section-header__subtitle">
              Shared curriculum — edits here apply to all students across Punjab
            </p>
          </div>
          <button
            className="btn btn--primary"
            onClick={() => navigate("/admin/content/courses/new")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Course
          </button>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        {/* Grade filter pills */}
        {!loading && grades.length > 0 && (
          <div style={{
            display: "flex",
            gap: "var(--space-2)",
            flexWrap: "wrap",
            marginBottom: "var(--space-6)",
          }}>
            <button
              className="badge"
              style={{
                cursor: "pointer",
                border: "1px solid var(--border-default)",
                background: selectedGrade === null ? "var(--brand-primary-glow)" : "transparent",
                color: selectedGrade === null ? "var(--brand-primary)" : "var(--text-muted)",
                padding: "var(--space-1) var(--space-3)",
              }}
              onClick={() => setSelectedGrade(null)}
            >
              All Grades
            </button>
            {grades.map((grade) => (
              <button
                key={grade}
                className="badge"
                style={{
                  cursor: "pointer",
                  border: "1px solid var(--border-default)",
                  background: selectedGrade === grade ? "var(--brand-primary-glow)" : "transparent",
                  color: selectedGrade === grade ? "var(--brand-primary)" : "var(--text-muted)",
                  padding: "var(--space-1) var(--space-3)",
                }}
                onClick={() => setSelectedGrade(grade)}
              >
                Class {grade}
              </button>
            ))}
          </div>
        )}

        {/* Stats row */}
        {!loading && (
          <div className="stat-grid" style={{ marginBottom: "var(--space-8)" }}>
            <div className="card">
              <div className="card__label">Total Courses</div>
              <div className="card__value">{courses.length}</div>
            </div>
            <div className="card">
              <div className="card__label">Grades Covered</div>
              <div className="card__value">{grades.length}</div>
            </div>
            <div className="card">
              <div className="card__label">Subjects</div>
              <div className="card__value">
                {new Set(courses.map((c) => c.subject__name)).size}
              </div>
            </div>
            <div className="card">
              <div className="card__label">Shown</div>
              <div className="card__value">{filtered.length}</div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-4)",
          }}>
            {Array.from({ length: 12 }).map((_, i) => <CourseSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📚</div>
            <h3 className="empty-state__title">No courses yet</h3>
            <p className="empty-state__message">
              Run <code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4 }}>
                python manage.py seed_content
              </code> to populate sample curriculum, or create a course manually.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
            {Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([subjectName, subjectCourses]) => (
                <div key={subjectName}>
                  <h3 style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-base)",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "var(--space-4)",
                  }}>
                    {subjectName}
                  </h3>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: "var(--space-3)",
                  }}>
                    {subjectCourses
                      .sort((a, b) => a.grade - b.grade)
                      .map((course, i) => (
                        <div
                          key={course.id}
                          className="card card--clickable page-enter"
                          style={{ animationDelay: `${i * 30}ms` }}
                          onClick={() => navigate(`/admin/content/courses/${course.id}`)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === "Enter" && navigate(`/admin/content/courses/${course.id}`)}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)" }}>
                            <span className="badge badge--info">Class {course.grade}</span>
                            {course.is_core && (
                              <span style={{ fontSize: "var(--text-xs)", color: "var(--success)" }}>Core</span>
                            )}
                          </div>
                          <div className="card__title" style={{ fontSize: "var(--text-base)" }}>
                            {course.title}
                          </div>
                          {course.description && (
                            <p className="card__description" style={{ marginTop: "var(--space-2)", fontSize: "var(--text-xs)" }}>
                              {course.description.length > 80
                                ? course.description.slice(0, 80) + "…"
                                : course.description}
                            </p>
                          )}
                          <div style={{
                            marginTop: "var(--space-3)",
                            fontSize: "var(--text-xs)",
                            color: "var(--brand-primary)",
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-1)",
                          }}>
                            Manage lessons →
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}