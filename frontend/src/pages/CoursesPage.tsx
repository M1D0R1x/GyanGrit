import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

type Course = {
  id: number;
  title: string;
  description: string;
  grade: number;
  subject__name: string;
  subject__id: number;
};

function CourseSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-line skeleton-line--short" />
      <div className="skeleton skeleton-line skeleton-line--title" style={{ marginTop: "var(--space-3)" }} />
      <div className="skeleton skeleton-line skeleton-line--long" style={{ marginTop: "var(--space-3)" }} />
    </div>
  );
}

export default function CoursesPage() {
  const [courses, setCourses]   = useState<Course[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const navigate                = useNavigate();
  const [searchParams]          = useSearchParams();

  const subjectIdParam = searchParams.get("subject_id");
  const subjectId      = subjectIdParam ? Number(subjectIdParam) : null;

  useEffect(() => {
    apiGet<Course[]>("/courses/")
      .then(setCourses)
      .catch(() => setError("Failed to load courses."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = subjectId
    ? courses.filter((c) => c.subject__id === subjectId)
    : courses;

  const subjectName = subjectId
    ? courses.find((c) => c.subject__id === subjectId)?.subject__name ?? null
    : null;

  return (
    <div className="page-shell">
      <TopBar title={subjectName ? `${subjectName} Courses` : "Courses"} />
      <main className="page-content page-enter has-bottom-nav">

        {subjectName && (
          <button className="back-btn" onClick={() => navigate("/dashboard")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Dashboard
          </button>
        )}

        <div className="section-header">
          <div>
            <h2 className="section-header__title">
              {subjectName ? `${subjectName}` : "Your Courses"}
            </h2>
            <p className="section-header__subtitle">
              {subjectName
                ? "Select a course to start learning"
                : "All your enrolled courses"}
            </p>
          </div>
          {subjectName && (
            <button
              className="btn btn--ghost"
              onClick={() => navigate("/courses")}
              style={{ fontSize: "var(--text-sm)" }}
            >
              View all courses
            </button>
          )}
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        {loading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-4)",
          }}>
            {Array.from({ length: 6 }).map((_, i) => <CourseSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🎓</div>
            <h3 className="empty-state__title">No courses available</h3>
            <p className="empty-state__message">
              Courses will appear here once they are assigned to your class.
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-4)",
          }}>
            {filtered.map((course, i) => (
              <div
                key={course.id}
                className="card card--clickable page-enter"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => navigate(`/courses/${course.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/courses/${course.id}`)}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "var(--space-3)",
                }}>
                  <span className="badge badge--info">Class {course.grade}</span>
                  {!subjectName && course.subject__name && (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      {course.subject__name}
                    </span>
                  )}
                </div>
                <div className="card__title">{course.title}</div>
                {course.description && (
                  <p className="card__description" style={{ marginTop: "var(--space-2)" }}>
                    {course.description.length > 100
                      ? course.description.slice(0, 100) + "…"
                      : course.description}
                  </p>
                )}
                <div style={{
                  marginTop: "var(--space-3)",
                  fontSize: "var(--text-xs)",
                  color: "var(--brand-primary)",
                }}>
                  View lessons →
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}