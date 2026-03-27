// pages.DashboardPage
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import { getMySummary, type MySummary } from "../services/gamification";
import { type AssessmentWithStatus } from "../services/assessments";
import { getCourseProgress } from "../services/content";
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
  course_id:         number | null;
};

// Map of courseId → resumeLessonId (null means no progress yet)
type ResumeMap = Record<number, number | null>;

// ── Skeletons ──────────────────────────────────────────────────────────────

function SubjectCardSkeleton() {
  return (
    <div className="glass-card" style={{ minHeight: 140 }}>
      <div className="skeleton-box" style={{ width: 60, height: 10, borderRadius: 4, marginBottom: "var(--space-3)" }} />
      <div className="skeleton-box" style={{ width: "75%", height: 18, borderRadius: 4, marginBottom: "var(--space-4)" }} />
      <div className="skeleton-box" style={{ width: "100%", height: 4, borderRadius: 99, marginBottom: "var(--space-2)" }} />
      <div className="skeleton-box" style={{ width: 50, height: 12, borderRadius: 4 }} />
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
      borderBottom: "1px solid var(--glass-border)",
    }}>
      <div className="skeleton-box" style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton-box" style={{ height: 13, width: "65%", borderRadius: 4, marginBottom: 6 }} />
        <div className="skeleton-box" style={{ height: 10, width: "40%", borderRadius: 4 }} />
      </div>
    </div>
  );
}

// ── Subject card ───────────────────────────────────────────────────────────

function SubjectCard({
  subject,
  resumeLessonId,
}: {
  subject: StudentSubject;
  resumeLessonId: number | null | undefined;
}) {
  const navigate = useNavigate();
  const progressColor =
    subject.progress >= 80 ? "var(--role-student)" :
    subject.progress >= 40 ? "var(--warning)" :
    "var(--role-teacher)";

  // resumeLessonId === undefined  → progress not yet loaded (or no course)
  // resumeLessonId === null       → course exists but no progress yet → "Start"
  // resumeLessonId === number     → navigate directly to that lesson → "Continue"
  const hasCourse  = subject.course_id != null;
  const hasResume  = typeof resumeLessonId === "number";
  const showButton = hasCourse && subject.total_lessons > 0;

  function handleContinue(e: React.MouseEvent) {
    e.stopPropagation();
    if (hasResume) {
      navigate(`/lessons/${resumeLessonId}`);
    } else {
      navigate(`/courses?subject_id=${subject.id}`);
    }
  }

  const buttonLabel =
    hasResume         ? "Continue" :
    subject.progress === 0 ? "Start" :
    "Resume";

  return (
    <div
      className="glass-card animate-fade-up"
      style={{ cursor: "pointer" }}
      onClick={() => navigate(`/courses?subject_id=${subject.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/courses?subject_id=${subject.id}`)}
      aria-label={`${subject.name} — ${subject.progress}% complete`}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>SUBJECT</div>
      <div style={{
        fontFamily:    "var(--font-display)",
        fontWeight:    800,
        fontSize:      "var(--text-base)",
        color:         "var(--text-primary)",
        letterSpacing: "-0.02em",
        marginBottom:  "var(--space-2)",
      }}>{subject.name}</div>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: "var(--space-2) 0" }}>
        {subject.completed_lessons} of {subject.total_lessons} lessons completed
      </p>
      {/* Progress track */}
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", marginBottom: "var(--space-3)" }}>
        <div style={{
          height:     "100%",
          width:      `${subject.progress}%`,
          background: progressColor,
          borderRadius: 99,
          transition:   "width 0.6s ease",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 800, color: progressColor, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
          {subject.progress}%
        </span>
        {showButton && (
          <button
            className="btn--primary"
            style={{
              padding:    "var(--space-1) var(--space-3)",
              fontSize:   "var(--text-xs)",
              fontWeight: 800,
              gap:        "var(--space-1)",
              lineHeight: 1.4,
              letterSpacing: "0.04em",
            }}
            onClick={handleContinue}
            aria-label={`${buttonLabel} ${subject.name}`}
          >
            {buttonLabel.toUpperCase()}
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Assessment row ─────────────────────────────────────────────────────────

function AssessmentRow({ a, index }: { a: AssessmentWithStatus; index: number }) {
  const navigate    = useNavigate();
  const isAttempted = (a.attempt_count ?? 0) > 0;

  const pct    = (a.best_score != null && a.total_marks > 0) ? a.best_score / a.total_marks : 0;
  const size   = 40;
  const r      = (size - 6) / 2;
  const circ   = 2 * Math.PI * r;
  const filled = circ * pct;
  const ringColor = pct >= 0.6 ? "var(--role-student)" : pct >= 0.4 ? "var(--warning)" : "var(--error)";

  return (
    <button
      className="animate-fade-up"
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            "var(--space-4)",
        padding:        "var(--space-3) var(--space-4)",
        width:          "100%",
        background:     "none",
        border:         "none",
        borderBottom:   "1px solid var(--glass-border)",
        cursor:         "pointer",
        textAlign:      "left",
        transition:     "background 0.12s",
        animationDelay: `${index * 40}ms`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
      onClick={() => navigate(assessmentPath(a.grade, a.subject, a.id))}
    >
      {isAttempted && a.best_score !== null ? (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
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
          width: size, height: size,
          borderRadius: "var(--radius-md)",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--glass-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, color: "var(--text-muted)",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          letterSpacing: "0.01em",
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

      <div style={{ flexShrink: 0, textAlign: "right" }}>
        {a.passed ? (
          <span className="role-tag role-tag--student" style={{ fontSize: 9 }}>PASSED</span>
        ) : isAttempted ? (
          <span className="role-tag role-tag--teacher" style={{ fontSize: 9 }}>
            {a.attempt_count} ATTEMPT{a.attempt_count !== 1 ? "S" : ""}
          </span>
        ) : (
          <span className="role-tag" style={{ fontSize: 9 }}>NEW</span>
        )}
      </div>

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
  const [resumeMap,     setResumeMap]     = useState<ResumeMap>({});
  const [loadingSubj,   setLoadingSubj]   = useState(true);
  const [loadingAssess, setLoadingAssess] = useState(true);
  const [assessError,   setAssessError]   = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // ── Phase 1: subjects, assessments, gamification ──────────────────────
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

  // ── Phase 2: fetch resume_lesson_id for each subject that has a course ──
  // Fires after subjects load. N parallel requests, one per subject with a course_id.
  // Cheap: each call is a single DB lookup (LessonProgress aggregate).
  useEffect(() => {
    if (subjects.length === 0) return;

    const coursedSubjects = subjects.filter((s) => s.course_id != null);
    if (coursedSubjects.length === 0) return;

    let cancelled = false;

    async function loadResume() {
      const results = await Promise.allSettled(
        coursedSubjects.map((s) => getCourseProgress(s.course_id!))
      );

      if (cancelled) return;

      const map: ResumeMap = {};
      results.forEach((result, idx) => {
        const courseId = coursedSubjects[idx].course_id!;
        if (result.status === "fulfilled") {
          map[courseId] = result.value.resume_lesson_id;
        }
        // On failure: courseId absent from map → SubjectCard shows no button
      });

      setResumeMap(map);
    }

    void loadResume();
    return () => { cancelled = true; };
  }, [subjects]);

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
            {/* Points card */}
            <div
              className="glass-card animate-fade-up"
              style={{
                flex: "1 1 140px", display: "flex", alignItems: "center",
                gap: "var(--space-3)", padding: "var(--space-4)",
                border: "1px solid rgba(61,214,140,0.2)",
                background: "rgba(61,214,140,0.04)",
                cursor: "pointer",
              }}
              onClick={() => navigate("/leaderboard")}
              role="button" tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/leaderboard")}
            >
              <div style={{ fontSize: 28 }}>⭐</div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--role-student)", lineHeight: 1, letterSpacing: "-0.03em" }}>
                  {gamification.total_points}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                  Points · #{gamification.class_rank ?? "—"} in class
                </div>
              </div>
            </div>

            {/* Streak card */}
            <div className="glass-card animate-fade-up" style={{
              flex: "1 1 140px", display: "flex", alignItems: "center",
              gap: "var(--space-3)", padding: "var(--space-4)",
              border: `1px solid ${gamification.current_streak >= 3 ? "rgba(245,158,11,0.2)" : "var(--glass-border)"}`,
              background: gamification.current_streak >= 3 ? "rgba(245,158,11,0.05)" : "var(--glass-bg)",
            }}>
              <div style={{ fontSize: 28 }}>
                {gamification.current_streak >= 7 ? "⚡" : gamification.current_streak >= 3 ? "🔥" : "📅"}
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: gamification.current_streak >= 3 ? "var(--warning)" : "var(--text-primary)", lineHeight: 1, letterSpacing: "-0.03em" }}>
                  {gamification.current_streak}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>Day streak</div>
              </div>
            </div>

            {/* Badges card */}
            {gamification.badge_count > 0 && (
              <div
                className="glass-card animate-fade-up"
                style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-4)", cursor: "pointer" }}
                onClick={() => navigate("/profile")}
                role="button" tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate("/profile")}
              >
                <div style={{ fontSize: 24 }}>🏅</div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--warning)", lineHeight: 1, letterSpacing: "-0.03em" }}>
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
          className="glass-card animate-fade-up"
          style={{
            width:          "100%",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            padding:        "var(--space-4) var(--space-5)",
            cursor:         "pointer",
            marginBottom:   "var(--space-6)",
            border:         "1px solid var(--glass-border)",
          }}
          onClick={() => navigate("/leaderboard")}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "12px", fontWeight: 800, letterSpacing: "0.05em", color: "var(--text-primary)" }}>
            🏆 VIEW CLASS LEADERBOARD
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* ── Assessments section ─────────────────────────────────────── */}
        <div className="section-header animate-fade-up" style={{ marginBottom: "var(--space-4)" }}>
          <div>
            <h2 className="section-title">
              Assessments
              {pendingCount > 0 && !loadingAssess && (
                <span className="role-tag" style={{ marginLeft: "var(--space-2)", fontSize: 9, verticalAlign: "middle", background: "rgba(239,68,68,0.12)", color: "var(--error)" }}>
                  {pendingCount} PENDING
                </span>
              )}
            </h2>
            <p className="section-subtitle">Your tests — attempt them to earn points</p>
          </div>
          <button className="btn--ghost" style={{ fontSize: "var(--text-sm)" }} onClick={() => navigate("/assessments")}>
            View all →
          </button>
        </div>

        {assessError ? (
          <div className="alert alert--error animate-fade-up" style={{ marginBottom: "var(--space-4)" }}>
            Failed to load assessments.
            <button className="btn--ghost" style={{ marginLeft: "var(--space-3)", fontSize: "var(--text-xs)" }} onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : loadingAssess ? (
          <div className="glass-card" style={{ padding: 0, overflow: "hidden", marginBottom: "var(--space-8)" }}>
            {Array.from({ length: 3 }).map((_, i) => <AssessmentRowSkeleton key={i} />)}
          </div>
        ) : prioritisedAssessments.length === 0 ? (
          <div className="glass-card empty-well animate-fade-up" style={{ marginBottom: "var(--space-8)" }}>
            <span style={{ fontSize: 36, display: "block", marginBottom: "var(--space-3)", opacity: 0.3 }}>📋</span>
            <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>NO ASSESSMENTS YET</p>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Tests will appear here once your teacher publishes them.</span>
            <button className="btn--primary" onClick={() => navigate("/assessments")} style={{ marginTop: "var(--space-4)" }}>
              Browse all assessments
            </button>
          </div>
        ) : (
          <>
            <div className="glass-card animate-fade-up" style={{ padding: 0, overflow: "hidden", marginBottom: "var(--space-3)" }}>
              {prioritisedAssessments.map((a, i) => (
                <AssessmentRow key={a.id} a={a} index={i} />
              ))}
            </div>
            {assessments.length > 4 && (
              <button
                className="glass-card animate-fade-up"
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  justifyContent: "space-between", padding: "var(--space-4) var(--space-5)",
                  cursor: "pointer", marginBottom: "var(--space-8)", border: "1px solid var(--glass-border)",
                }}
                onClick={() => navigate("/assessments")}
              >
                <span style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.05em" }}>VIEW ALL {assessments.length} ASSESSMENTS</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </>
        )}

        {/* ── Subject cards ────────────────────────────────────────────── */}
        <div className="section-header animate-fade-up" style={{ marginBottom: "var(--space-4)" }}>
          <div>
            <h2 className="section-title">Your Subjects</h2>
            <p className="section-subtitle">Track progress across all enrolled subjects</p>
          </div>
        </div>

        {error && <div className="alert alert--error animate-fade-up" role="alert">{error}</div>}

        {loadingSubj ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
            {Array.from({ length: 6 }).map((_, i) => <SubjectCardSkeleton key={i} />)}
          </div>
        ) : subjects.length === 0 ? (
          <div className="glass-card empty-well animate-fade-up">
            <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>📚</span>
            <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>NO SUBJECTS YET</p>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Your subjects will appear here once your teacher assigns them.</span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
            {subjects.map((subject, i) => (
              <div key={subject.id} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <SubjectCard
                  subject={subject}
                  resumeLessonId={
                    subject.course_id != null
                      ? resumeMap[subject.course_id]
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  );
}
