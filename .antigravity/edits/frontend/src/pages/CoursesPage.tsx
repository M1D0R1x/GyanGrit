// pages.CoursesPage
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
    <div className="glass-card" style={{ minHeight: 120 }}>
      <div className="skeleton-box" style={{ width: 60, height: 12, borderRadius: 4, marginBottom: "var(--space-3)" }} />
      <div className="skeleton-box" style={{ width: "80%", height: 18, borderRadius: 4, marginBottom: "var(--space-3)" }} />
      <div className="skeleton-box" style={{ width: "100%", height: 12, borderRadius: 4 }} />
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
      <TopBar title={subjectName ? `${subjectName} Courses` : "Courses"} />
      <main className="page-content page-enter has-bottom-nav">

        {subjectName && (
          <button
            className="btn--ghost"
            style={{ marginBottom: "var(--space-6)", display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "12px", fontWeight: 800, letterSpacing: "0.05em" }}
            onClick={() => navigate("/dashboard")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            BACK TO DASHBOARD
          </button>
        )}

        {/* Hero */}
        <header className="page-hero animate-fade-up" style={{ marginBottom: "var(--space-6)" }}>
          <div className="role-tag role-tag--student" style={{ marginBottom: "var(--space-4)" }}>
            🎓 COURSES
          </div>
          <h1 className="text-gradient md-display">
            {subjectName ? subjectName : "Knowledge\nVault."}
          </h1>
          <p className="hero-subtitle">
            {subjectName
              ? "Select a course to start learning"
              : "All your enrolled courses — curated for your curriculum."}
          </p>
        </header>

        {/* Section header */}
        <div className="section-header animate-fade-up" style={{ marginBottom: "var(--space-4)" }}>
          <h2 className="section-title">
            {subjectName ? subjectName : "Your Courses"}
          </h2>
          {subjectName && (
            <button
              className="btn--ghost"
              onClick={() => navigate("/courses")}
              style={{ fontSize: "var(--text-sm)" }}
            >
              View all
            </button>
          )}
        </div>

        {error && <div className="alert alert--error animate-fade-up">{error}</div>}

        {loading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-4)",
          }}>
            {Array.from({ length: 6 }).map((_, i) => <CourseSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card empty-well animate-fade-up">
            <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>🎓</span>
            <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>NO COURSES AVAILABLE</p>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Courses will appear here once they are assigned to your class.</span>
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
                className="glass-card animate-fade-up"
                style={{ animationDelay: `${i * 50}ms`, cursor: "pointer" }}
                onClick={() => navigate(courseDetailPath(course.grade, course.subject__name))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  navigate(courseDetailPath(course.grade, course.subject__name))
                }
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "var(--space-3)",
                }}>
                  <span className="role-tag role-tag--student" style={{ fontSize: 9 }}>CLASS {course.grade}</span>
                  {!subjectName && course.subject__name && (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.03em" }}>
                      {course.subject__name}
                    </span>
                  )}
                </div>
                <div style={{
                  fontFamily:    "var(--font-display)",
                  fontWeight:    800,
                  fontSize:      "var(--text-base)",
                  color:         "var(--text-primary)",
                  letterSpacing: "-0.02em",
                  marginBottom:  "var(--space-2)",
                }}>{course.title}</div>
                {course.description && (
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "var(--space-3)" }}>
                    {course.description.length > 100
                      ? course.description.slice(0, 100) + "…"
                      : course.description}
                  </p>
                )}
                <div style={{
                  marginTop:     "auto",
                  fontSize:      "10px",
                  fontWeight:    800,
                  letterSpacing: "0.08em",
                  color:         "var(--role-student)",
                }}>
                  VIEW LESSONS →
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
