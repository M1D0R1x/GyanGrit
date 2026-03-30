// pages.CoursesPage — Glassmorphism 2.0
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet } from "../services/api";
import { courseDetailPath } from "../utils/slugs";
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
    <div className="card" style={{ minHeight: 160 }}>
      <div className="skeleton skeleton-line skeleton-line--short" style={{ height: 10 }} />
      <div className="skeleton skeleton-line skeleton-line--title" style={{ marginTop: "var(--space-3)" }} />
      <div className="skeleton skeleton-line skeleton-line--long" style={{ marginTop: "var(--space-3)" }} />
      <div className="skeleton skeleton-line skeleton-line--medium" style={{ marginTop: "var(--space-2)" }} />
    </div>
  );
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const navigate              = useNavigate();
  const [searchParams]        = useSearchParams();

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
      <TopBar title={subjectName ? `${subjectName}` : "Courses"} />
      <main className="page-content page-enter has-bottom-nav">

        {subjectName && (
          <button className="back-btn" onClick={() => navigate("/dashboard")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Dashboard
          </button>
        )}

        <div className="section-header">
          <div>
            <h2 className="section-header__title">
              {subjectName ?? "Your Courses"}
            </h2>
            <p className="section-header__subtitle">
              {subjectName ? "Select a course to begin" : "All your enrolled courses"}
            </p>
          </div>
          {subjectName && (
            <button className="btn btn--ghost btn--sm" onClick={() => navigate("/courses")}>
              All courses
            </button>
          )}
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-5)" }}>
            {Array.from({ length: 6 }).map((_, i) => <CourseSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🎓</div>
            <h3 className="empty-state__title">No courses available</h3>
            <p className="empty-state__message">Courses appear here once assigned to your class.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-5)" }}>
            {filtered.map((course, i) => (
              <div
                key={course.id}
                className="card card--clickable page-enter"
                style={{ animationDelay: `${i * 50}ms`, minHeight: 160, display: "flex", flexDirection: "column" }}
                onClick={() => navigate(courseDetailPath(course.grade, course.subject__name))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(courseDetailPath(course.grade, course.subject__name))}
              >
                {/* Meta row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                  <span style={{
                    fontSize: 9, fontWeight: 900, letterSpacing: "0.12em",
                    textTransform: "uppercase", color: "var(--ink-muted)",
                  }}>
                    {subjectName ?? course.subject__name}
                  </span>
                  <span className="badge badge--info" style={{ fontSize: 9 }}>Class {course.grade}</span>
                </div>

                {/* Title */}
                <div style={{
                  fontFamily: "var(--font-display)", fontWeight: 800,
                  fontSize: "var(--text-xl)", color: "var(--ink-primary)",
                  lineHeight: 1.2, marginBottom: "var(--space-3)", letterSpacing: "-0.01em",
                }}>
                  {course.title}
                </div>

                {/* Description */}
                {course.description && (
                  <p style={{
                    fontSize: "var(--text-sm)", color: "var(--ink-muted)",
                    lineHeight: 1.6, marginBottom: "var(--space-4)",
                    display: "-webkit-box", WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical", overflow: "hidden",
                    margin: "0 0 var(--space-4) 0",
                  }}>
                    {course.description}
                  </p>
                )}

                {/* CTA */}
                <div style={{
                  marginTop: "auto", display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--saffron)", fontWeight: 700 }}>
                    Start learning
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--saffron)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
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
