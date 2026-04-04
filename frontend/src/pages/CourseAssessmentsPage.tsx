// pages.CourseAssessmentsPage
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCourseAssessments, getAssessment, type AssessmentListItem } from "../services/assessments";
import { getCourseBySlug } from "../services/content";
import { assessmentPath, fromSlug } from "../utils/slugs";
import {
  saveAssessmentOffline,
  getOfflineAssessment,
  isOnline,
} from "../services/offline";

// ── Assessment download button ────────────────────────────────────────────────

function AssessmentDownloadBtn({
  assessmentId,
}: {
  assessmentId: number;
}) {
  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOfflineAssessment(assessmentId).then((a) => setSaved(!!a)).catch(() => {});
  }, [assessmentId]);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saved || saving || !isOnline()) return;
    setSaving(true);
    try {
      // Fetch full questions so the offline take works
      const full = await getAssessment(assessmentId);
      await saveAssessmentOffline({
        id:         full.id,
        courseId:   0, // not available in list, OK — we store by id
        title:      full.title,
        totalMarks: full.total_marks,
        passMarks:  full.pass_marks,
        questions:  full.questions.map((q) => ({
          id:      q.id,
          text:    q.text,
          marks:   q.marks,
          order:   q.order,
          options: q.options,
        })),
        savedAt: new Date().toISOString(),
      });
      setSaved(true);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      onClick={handleSave}
      disabled={saving || saved}
      title={saved ? "Saved for offline" : "Save assessment for offline"}
      aria-label={saved ? "Assessment saved offline" : "Download assessment for offline"}
      style={{
        flexShrink: 0,
        width: 32, height: 32,
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${saved ? "rgba(16,185,129,0.35)" : "var(--border-light)"}`,
        background: saved ? "rgba(16,185,129,0.08)" : "transparent",
        color: saved ? "var(--success)" : "var(--ink-muted)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: saved ? "default" : "pointer",
        transition: "all 180ms ease",
        marginLeft: "var(--space-2)",
      }}
      onMouseEnter={(e) => {
        if (!saved && !saving) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = "var(--saffron)";
          el.style.color = "var(--saffron)";
          el.style.background = "rgba(245,158,11,0.06)";
        }
      }}
      onMouseLeave={(e) => {
        if (!saved) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = "var(--border-light)";
          el.style.color = "var(--ink-muted)";
          el.style.background = "transparent";
        }
      }}
    >
      {saving ? (
        <span className="btn__spinner" style={{ width: 11, height: 11 }} />
      ) : saved ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
                  <div style={{ flex: 1, minWidth: 0 }}>
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

                  {/* Actions: download + start */}
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginLeft: "var(--space-4)", flexShrink: 0 }}>
                    <AssessmentDownloadBtn
                      assessmentId={a.id}
                    />
                    <button
                      className="btn btn--primary"
                      onClick={() =>
                        grade && subjectSlug
                          ? navigate(assessmentPath(grade, subjectSlug, a.id))
                          : navigate(`/assessments`)
                      }
                    >
                      Start
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </>
  );
}
