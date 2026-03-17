// pages.DashboardPage
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import { getMySummary, type MySummary } from "../services/gamification";
import { type AssessmentWithStatus } from "../services/assessments";
import { assessmentPath } from "../utils/slugs";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

// ── Types ──────────────────────────────────────────────────────────────────

type StudentSubject = {
  id:                number;
  name:              string;
  total_lessons:     number;
  completed_lessons: number;
  progress:          number;
};

// ── Skeletons ──────────────────────────────────────────────────────────────

function SubjectCardSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-line skeleton-line--title" />
      <div className="skeleton skeleton-line skeleton-line--medium" style={{ marginTop: "var(--space-4)" }} />
      <div className="skeleton skeleton-line skeleton-line--full"   style={{ height: 6, marginTop: "var(--space-3)" }} />
      <div className="skeleton skeleton-line skeleton-line--short"  style={{ marginTop: "var(--space-2)" }} />
    </div>
  );
}

function AssessmentRowSkeleton() {
  return (
    <div style={{
      display:      "flex",
      alignItems:   "center",
      gap:          "var(--space-4)",
      padding:      "var(--space-3) var(--space-4)",
      borderBottom: "1px solid var(--border-subtle)",
    }}>
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-line skeleton-line--medium" />
        <div className="skeleton skeleton-line skeleton-line--short" style={{ marginTop: "var(--space-2)" }} />
      </div>
    </div>
  );
}

// ── Subject card ───────────────────────────────────────────────────────────

function SubjectCard({ subject }: { subject: StudentSubject }) {
  const navigate = useNavigate();
  const progressColor =
    subject.progress >= 80 ? "var(--success)" :
    subject.progress >= 40 ? "var(--warning)" :
    "var(--brand-primary)";

  return (
    <div
      className="card card--clickable"
      onClick={() => navigate(`/courses?subject_id=${subject.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/courses?subject_id=${subject.id}`)}
      aria-label={`${subject.name} — ${subject.progress}% complete`}
    >
      <div className="card__label">Subject</div>
      <div className="card__title">{subject.name}</div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: "var(--space-2) 0" }}>
        {subject.completed_lessons} of {subject.total_lessons} lessons completed
      </p>
      <div className="progress-bar">
        <div className="progress-bar__fill" style={{ width: `${subject.progress}%`, background: progressColor }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-1)" }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Progress</span>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: progressColor, fontFamily: "var(--font-display)" }}>
          {subject.progress}%
        </span>
      </div>
    </div>
  );
}

// ── Assessment row ─────────────────────────────────────────────────────────

function AssessmentRow({ a, index }: { a: AssessmentWithStatus; index: number }) {
  const navigate    = useNavigate();
  const isAttempted = (a.attempt_count ?? 0) > 0;

  // Score ring
  const pct    = (a.best_score != null && a.total_marks > 0) ? a.best_score / a.total_marks : 0;
  const size   = 40;
  const r      = (size - 6) / 2;
  const circ   = 2 * Math.PI * r;
  const filled = circ * pct;
  const ringColor = pct >= 0.6 ? "var(--success)" : pct >= 0.4 ? "var(--warning)" : "var(--error)";

  return (
    <button
      className="page-enter"
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            "var(--space-4)",
        padding:        "var(--space-3) var(--space-4)",
        width:          "100%",
        background:     "none",
        border:         "none",
        borderBottom:   "1px solid var(--border-subtle)",
        cursor:         "pointer",
        textAlign:      "left",
        transition:     "background 0.1s",
        animationDelay: `${index * 40}ms`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-overlay)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
      onClick={() => navigate(assessmentPath(a.grade, a.subject, a.id))}
    >
      {/* Score ring or placeholder icon */}
      {isAttempted && a.best_score !== null ? (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth={5} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={ringColor} strokeWidth={5}
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeDashoffset={circ / 4}
            strokeLinecap="round" />
          <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
            fill={ringColor}
            style={{ fontSize: size * 0.22, fontWeight: 800, fontFamily: "var(--font-display)" }}>
            {Math.round(pct * 100)}
          </text>
        </svg>
      ) : (
        <div style={{
          width:          size,
          height:         size,
          borderRadius:   "var(--radius-md)",
          background:     "var(--bg-elevated)",
          border:         "1px solid var(--border-subtle)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          flexShrink:     0,
          color:          "var(--text-muted)",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
      )}

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:     "var(--text-sm)",
          fontWeight:   600,
          color:        "var(--text-primary)",
          overflow:     "hidden",
          textOverflow: "ellipsis",
          whiteSpace:   "nowrap",
        }}>
          {a.title}
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)", marginTop: 2, flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            {a.subject} · Class {a.grade}
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            {a.total_marks} marks
          </span>
        </div>
      </div>

      {/* Status badge */}
      <div style={{ flexShrink: 0, textAlign: "right" }}>
        {a.passed ? (
          <span className="badge badge--success" style={{ fontSize: 10 }}>Passed</span>
        ) : isAttempted ? (
          <span className="badge badge--warning" style={{ fontSize: 10 }}>
            {a.attempt_count} attempt{a.attempt_count !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="badge badge--info" style={{ fontSize: 10 }}>New</span>
        )}
      </div>

      {/* Chevron */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();

  const [subjects,      setSubjects]      = useState<StudentSubject[]>([]);
  const [assessments,   setAssessments]   = useState<AssessmentWithStatus[]>([]);
  const [gamification,  setGamification]  = useState<MySummary | null>(null);
  const [loadingSubj,   setLoadingSubj]   = useState(true);
  const [loadingAssess, setLoadingAssess] = useState(true);
  const [assessError,   setAssessError]   = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [subjectsData, gData, assessData] = await Promise.allSettled([
          apiGet<StudentSubject[]>("/academics/subjects/"),
          getMySummary(),
          apiGet<AssessmentWithStatus[]>("/assessments/my/"),
        ]);

        if (cancelled) return;

        if (subjectsData.status === "fulfilled") setSubjects(subjectsData.value ?? []);
        else setError("Failed to load dashboard. Please refresh.");

        if (gData.status === "fulfilled") setGamification(gData.value);

        if (assessData.status === "fulfilled") {
          setAssessments(assessData.value ?? []);
        } else {
          setAssessError(true);
        }
      } finally {
        if (!cancelled) {
          setLoadingSubj(false);
          setLoadingAssess(false);
        }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  // Pending (not yet passed) first, then passed — show up to 4
  const prioritisedAssessments = [
    ...assessments.filter((a) => !a.passed),
    ...assessments.filter((a) => a.passed),
  ].slice(0, 4);

  const pendingCount = assessments.filter((a) => !a.passed).length;

  return (
    <div className="page-shell">
      <TopBar title="Dashboard" />
      <main className="page-content page-enter has-bottom-nav">

        {/* ── Gamification strip ──────────────────────────────────────── */}
        {gamification && (
          <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-6)", flexWrap: "wrap" }}>

            {/* Points */}
            <div
              className="card card--clickable"
              style={{
                flex:        "1 1 140px",
                display:     "flex",
                alignItems:  "center",
                gap:         "var(--space-3)",
                padding:     "var(--space-4)",
                borderColor: "rgba(59,130,246,0.2)",
                background:  "rgba(59,130,246,0.04)",
              }}
              onClick={() => navigate("/leaderboard")}
              role="button" tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/leaderboard")}
            >
              <div style={{ fontSize: 28 }}>⭐</div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--role-student)", lineHeight: 1 }}>
                  {gamification.total_points}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                  Points · #{gamification.class_rank ?? "—"} in class
                </div>
              </div>
            </div>

            {/* Streak */}
            <div style={{
              flex:         "1 1 140px",
              display:      "flex",
              alignItems:   "center",
              gap:          "var(--space-3)",
              padding:      "var(--space-4)",
              background:   gamification.current_streak >= 3 ? "rgba(245,158,11,0.06)" : "var(--bg-elevated)",
              border:       `1px solid ${gamification.current_streak >= 3 ? "rgba(245,158,11,0.2)" : "var(--border-subtle)"}`,
              borderRadius: "var(--radius-lg)",
            }}>
              <div style={{ fontSize: 28 }}>
                {gamification.current_streak >= 7 ? "⚡" : gamification.current_streak >= 3 ? "🔥" : "📅"}
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: gamification.current_streak >= 3 ? "var(--warning)" : "var(--text-primary)", lineHeight: 1 }}>
                  {gamification.current_streak}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>Day streak</div>
              </div>
            </div>

            {/* Badges */}
            {gamification.badge_count > 0 && (
              <div
                className="card card--clickable"
                style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-4)" }}
                onClick={() => navigate("/profile")}
                role="button" tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate("/profile")}
              >
                <div style={{ fontSize: 24 }}>🏅</div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--warning)", lineHeight: 1 }}>
                    {gamification.badge_count}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                    Badge{gamification.badge_count !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Leaderboard shortcut ────────────────────────────────────── */}
        <button
          className="history-shortcut"
          onClick={() => navigate("/leaderboard")}
          style={{ marginBottom: "var(--space-6)" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontSize: 14 }}>🏆</span>
            View class leaderboard
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* ── Assessments section — shown BEFORE subjects so it's above the fold ── */}
        <div className="section-header">
          <div>
            <h2 className="section-header__title">
              Assessments
              {pendingCount > 0 && !loadingAssess && (
                <span style={{
                  marginLeft:   "var(--space-2)",
                  fontSize:     "var(--text-xs)",
                  fontWeight:   700,
                  padding:      "2px 8px",
                  borderRadius: "var(--radius-full)",
                  background:   "rgba(239,68,68,0.12)",
                  color:        "var(--error)",
                  verticalAlign: "middle",
                }}>
                  {pendingCount} pending
                </span>
              )}
            </h2>
            <p className="section-header__subtitle">
              Your tests — attempt them to earn points
            </p>
          </div>
          <button
            className="btn btn--ghost"
            style={{ fontSize: "var(--text-sm)" }}
            onClick={() => navigate("/assessments")}
          >
            View all →
          </button>
        </div>

        {assessError ? (
          <div className="alert alert--error" style={{ marginBottom: "var(--space-4)" }}>
            Failed to load assessments.
            <button
              className="btn btn--ghost"
              style={{ marginLeft: "var(--space-3)", fontSize: "var(--text-xs)" }}
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : loadingAssess ? (
          <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: "var(--space-8)" }}>
            {Array.from({ length: 3 }).map((_, i) => <AssessmentRowSkeleton key={i} />)}
          </div>
        ) : prioritisedAssessments.length === 0 ? (
          <div style={{ marginBottom: "var(--space-8)" }}>
            <div style={{
              padding:      "var(--space-6) var(--space-5)",
              background:   "var(--bg-elevated)",
              border:       "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              textAlign:    "center",
            }}>
              <div style={{ fontSize: 36, marginBottom: "var(--space-3)" }}>📋</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
                No assessments yet
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
                Tests will appear here once your teacher publishes them.
                Complete your lessons first to prepare!
              </p>
              <button
                className="btn btn--primary"
                onClick={() => navigate("/assessments")}
                style={{ justifyContent: "center" }}
              >
                Browse all assessments
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: "var(--space-3)" }}>
              {prioritisedAssessments.map((a, i) => (
                <AssessmentRow key={a.id} a={a} index={i} />
              ))}
            </div>
            {assessments.length > 4 && (
              <button
                className="history-shortcut"
                style={{ marginBottom: "var(--space-8)" }}
                onClick={() => navigate("/assessments")}
              >
                <span>View all {assessments.length} assessments</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </>
        )}

        {/* ── Subject cards ────────────────────────────────────────────── */}
        <div className="section-header">
          <div>
            <h2 className="section-header__title">Your Subjects</h2>
            <p className="section-header__subtitle">Track progress across all enrolled subjects</p>
          </div>
        </div>

        {error && <div className="alert alert--error" role="alert">{error}</div>}

        {loadingSubj ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
            {Array.from({ length: 6 }).map((_, i) => <SubjectCardSkeleton key={i} />)}
          </div>
        ) : subjects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📚</div>
            <h3 className="empty-state__title">No subjects yet</h3>
            <p className="empty-state__message">
              Your subjects will appear here once your teacher assigns them.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
            {subjects.map((subject, i) => (
              <div key={subject.id} className="page-enter" style={{ animationDelay: `${i * 60}ms` }}>
                <SubjectCard subject={subject} />
              </div>
            ))}
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  );
}
