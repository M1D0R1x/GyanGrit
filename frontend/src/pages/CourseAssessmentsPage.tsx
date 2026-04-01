// pages.CourseAssessmentsPage
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCourseAssessments, type AssessmentListItem } from "../services/assessments";
import { getCourseBySlug } from "../services/content";
import { assessmentPath, fromSlug } from "../utils/slugs";

export default function CourseAssessmentsPage() {
  // Route: /courses/:grade/:subject/assessments
  const { grade: gradeParam, subject: subjectSlug } = useParams<{
    grade: string;
    subject: string;
  }>();
  const navigate = useNavigate();

  const grade = gradeParam ? Number(gradeParam) : null;
  const subjectLabel = subjectSlug ? fromSlug(subjectSlug) : "";

  const [assessments, setAssessments] = useState<AssessmentListItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    if (!grade || !subjectSlug) {
      // Use setTimeout to avoid setState-in-effect lint warning
      const t = setTimeout(() => {
        setError("Invalid course URL.");
        setLoading(false);
      }, 0);
      return () => clearTimeout(t);
    }

    getCourseBySlug(grade, subjectSlug)
      .then((course) => getCourseAssessments(course.id))
      .then(setAssessments)
      .catch(() => setError("Failed to load assessments."))
      .finally(() => setLoading(false));
  }, [grade, subjectSlug]);

  return (
    <>

        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        <div className="section-header">
          <div>
            <h2 className="section-header__title">
              {subjectLabel ? `${subjectLabel} — Assessments` : "Assessments"}
            </h2>
            <p className="section-header__subtitle">
              Complete all assessments to finish this course
            </p>
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton skeleton-line skeleton-line--title" />
                <div className="skeleton skeleton-line skeleton-line--medium" style={{ marginTop: "var(--space-3)" }} />
              </div>
            ))}
          </div>
        ) : assessments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <h3 className="empty-state__title">No assessments yet</h3>
            <p className="empty-state__message">
              Assessments will appear here once your teacher publishes them.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {assessments.map((a, i) => (
              <div
                key={a.id}
                className="card page-enter"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div className="card__title">{a.title}</div>
                    {a.description && (
                      <p className="card__description" style={{ marginTop: "var(--space-2)" }}>
                        {a.description}
                      </p>
                    )}
                    <div style={{
                      display: "flex",
                      gap: "var(--space-4)",
                      marginTop: "var(--space-3)",
                      fontSize: "var(--text-xs)",
                      color: "var(--ink-muted)",
                    }}>
                      <span>Total: <strong style={{ color: "var(--ink-secondary)" }}>{a.total_marks}</strong> marks</span>
                      <span>Pass: <strong style={{ color: "var(--success)" }}>{a.pass_marks}</strong> marks</span>
                    </div>
                  </div>
                  <button
                    className="btn btn--primary"
                    onClick={() =>
                      grade && subjectSlug
                        ? navigate(assessmentPath(grade, subjectSlug, a.id))
                        : navigate(`/assessments`)
                    }
                    style={{ marginLeft: "var(--space-4)", flexShrink: 0 }}
                  >
                    Start
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
    </>
  );
}
