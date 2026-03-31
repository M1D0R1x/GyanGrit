// pages.DashboardPage — Chalk & Sunlight v3
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiGet } from "../services/api";
import { getMySummary, type MySummary } from "../services/gamification";
import { type AssessmentWithStatus } from "../services/assessments";
import { getCourseProgress } from "../services/content";
import { assessmentPath } from "../utils/slugs";

// ── Types ─────────────────────────────────────────────────────────

type StudentSubject = {
  id:                number;
  name:              string;
  total_lessons:     number;
  completed_lessons: number;
  progress:          number;
  course_id:         number | null;
};

type ResumeMap = Record<number, number | null>;

// ── Skeletons ─────────────────────────────────────────────────────

function SubjectCardSkeleton() {
  return (
    <div className="skeleton-card" style={{ minHeight: 160 }}>
      <div className="skeleton skeleton-line" style={{ height: 10, width: "40%", marginBottom: "var(--space-3)" }} />
      <div className="skeleton skeleton-line" style={{ height: 22, width: "70%", marginBottom: "var(--space-6)" }} />
      <div className="skeleton skeleton-line" style={{ height: 5, width: "100%", marginBottom: "var(--space-3)" }} />
      <div className="skeleton skeleton-line" style={{ height: 10, width: "30%" }} />
    </div>
  );
}

function AssessmentRowSkeleton() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "var(--space-4)",
      padding: "var(--space-4)", borderBottom: "1px solid var(--border-light)",
    }}>
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-line" style={{ height: 12, width: "65%", marginBottom: "var(--space-2)" }} />
        <div className="skeleton skeleton-line" style={{ height: 9, width: "40%" }} />
      </div>
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────

function StatPill({ icon, value, label, color, onClick }: {
  icon: string; value: string | number; label: string; color?: string; onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      style={{
        flex:         "0 0 auto",
        minWidth:     160,
        display:      "flex",
        alignItems:   "center",
        gap:          "var(--space-4)",
        padding:      "var(--space-4) var(--space-5)",
        background:   hov ? "var(--bg-elevated)" : "var(--bg-surface)",
        border:       `1px solid ${hov ? "var(--border-medium)" : "var(--border-light)"}`,
        borderRadius: "var(--radius-xl)",
        cursor:       onClick ? "pointer" : "default",
        transition:   "all 0.2s ease",
        transform:    hov ? "translateY(-2px)" : "translateY(0)",
        boxShadow:    hov ? "var(--shadow-md)" : "var(--shadow-card)",
      }}
    >
      <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{
          fontFamily: "var(--font-display)", fontWeight: 800,
          fontSize: "var(--text-xl)", color: color ?? "var(--ink-primary)", lineHeight: 1,
        }}>
          {value}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.06em", color: "var(--ink-muted)", marginTop: 4,
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ── Subject card ──────────────────────────────────────────────────

function SubjectCard({ subject, resumeLessonId }: {
  subject: StudentSubject;
  resumeLessonId: number | null | undefined;
}) {
  const navigate    = useNavigate();
  const [hov, setHov] = useState(false);

  const progressColor =
    subject.progress >= 80 ? "var(--success)" :
    subject.progress >= 40 ? "var(--warning)" :
    "var(--saffron)";

  const hasCourse  = subject.course_id != null;
  const hasResume  = typeof resumeLessonId === "number";
  const showButton = hasCourse && subject.total_lessons > 0;
  const buttonLabel = hasResume ? "Continue" : subject.progress === 0 ? "Start" : "Resume";

  function handleContinue(e: React.MouseEvent) {
    e.stopPropagation();
    if (hasResume) navigate(`/lessons/${resumeLessonId}`);
    else navigate(`/courses?subject_id=${subject.id}`);
  }

  return (
    <div
      onClick={() => navigate(`/courses?subject_id=${subject.id}`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/courses?subject_id=${subject.id}`)}
      aria-label={`${subject.name} — ${subject.progress}% complete`}
      style={{
        padding:       "var(--space-6)",
        background:    "var(--bg-surface)",
        border:        `1px solid ${hov ? "rgba(245,158,11,0.4)" : "var(--border-light)"}`,
        borderLeft:    `4px solid ${progressColor}`,
        borderRadius:  "var(--radius-lg)",
        cursor:        "pointer",
        transition:    "all 0.2s ease",
        transform:     hov ? "translateY(-3px)" : "translateY(0)",
        boxShadow:     hov ? "var(--shadow-card-hover)" : "var(--shadow-card)",
        display:       "flex",
        flexDirection: "column",
        minHeight:     160,
      }}
    >
      {/* Overline */}
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
        color: "var(--ink-muted)", marginBottom: "var(--space-2)",
        textTransform: "uppercase",
      }}>
        Subject
      </div>

      {/* Title */}
      <div style={{
        fontFamily: "var(--font-display)", fontSize: "var(--text-xl)",
        fontWeight: 800, color: "var(--ink-primary)",
        letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: "var(--space-6)",
      }}>
        {subject.name}
      </div>

      {/* Progress */}
      <div style={{ marginTop: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
          <div className="progress-bar" style={{ flex: 1 }}>
            <div className="progress-bar__fill" style={{ width: `${subject.progress}%`, background: progressColor }} />
          </div>
          <span style={{
            fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: "var(--text-sm)", color: progressColor, minWidth: 32,
          }}>
            {subject.progress}%
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--ink-muted)", fontWeight: 600 }}>
            {subject.completed_lessons}/{subject.total_lessons} lessons
          </span>
          {showButton && (
            <button
              className="btn btn--primary btn--sm"
              onClick={handleContinue}
              aria-label={`${buttonLabel} ${subject.name}`}
            >
              {buttonLabel}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Assessment row ────────────────────────────────────────────────

function AssessmentRow({ a, index }: { a: AssessmentWithStatus; index: number }) {
  const navigate    = useNavigate();
  const [hov, setHov] = useState(false);
  const isAttempted = (a.attempt_count ?? 0) > 0;
  const pct         = (a.best_score != null && a.total_marks > 0) ? a.best_score / a.total_marks : 0;
  const size        = 40;
  const r           = (size - 6) / 2;
  const circ        = 2 * Math.PI * r;
  const filled      = circ * pct;
  const ringColor   = pct >= 0.6 ? "var(--success)" : pct >= 0.4 ? "var(--warning)" : "var(--error)";

  return (
    <button
      className="assessment-row page-enter"
      style={{
        animationDelay: `${index * 50}ms`,
        background:     hov ? "var(--saffron-light)" : "transparent",
        transform:      hov ? "translateX(4px)" : "translateX(0)",
        transition:     "all 0.15s ease",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => navigate(assessmentPath(a.grade, a.subject, a.id))}
    >
      {isAttempted && a.best_score !== null ? (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-sunken)" strokeWidth={5} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={ringColor} strokeWidth={5}
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeDashoffset={circ / 4} strokeLinecap="round" />
          <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
            fill={ringColor}
            style={{ fontSize: size * 0.22, fontWeight: 800, fontFamily: "var(--font-display)" }}>
            {Math.round(pct * 100)}
          </text>
        </svg>
      ) : (
        <div className="assessment-row__icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
      )}

      <div className="assessment-row__body">
        <div className="assessment-row__subject">{a.subject}</div>
        <div className="assessment-row__title">{a.title}</div>
        <div className="assessment-row__meta">
          <span>Class {a.grade}</span>
          <span>·</span>
          <span>{a.total_marks} marks</span>
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        {a.passed ? (
          <span className="badge badge--success" style={{ fontSize: 9 }}>Passed</span>
        ) : isAttempted ? (
          <span className="badge badge--warning" style={{ fontSize: 9 }}>{a.attempt_count}×</span>
        ) : (
          <span className="badge badge--saffron" style={{ fontSize: 9 }}>New</span>
        )}
      </div>

      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: hov ? 0.7 : 0.25 }}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}

// ── Streak card ───────────────────────────────────────────────────

function StreakCard({ gamification, onNavigate }: { gamification: MySummary; onNavigate: (path: string) => void }) {
  return (
    <div style={{
      display: "flex", gap: "var(--space-4)",
      overflowX: "auto", paddingBottom: "var(--space-2)",
      marginBottom: "var(--space-10)",
      scrollbarWidth: "none",
    }}>
      <StatPill
        icon="⭐"
        value={gamification.total_points}
        label={`Points · #${gamification.class_rank ?? "—"} in class`}
        color="var(--saffron-dark)"
        onClick={() => onNavigate("/leaderboard")}
      />
      <StatPill
        icon={gamification.current_streak >= 7 ? "⚡" : gamification.current_streak >= 3 ? "🔥" : "📅"}
        value={gamification.current_streak}
        label="Day streak"
        color={gamification.current_streak >= 3 ? "var(--warning)" : "var(--ink-primary)"}
      />
      {gamification.badge_count > 0 && (
        <StatPill
          icon="🏅"
          value={gamification.badge_count}
          label={`Badge${gamification.badge_count !== 1 ? "s" : ""}`}
          color="var(--warning)"
          onClick={() => onNavigate("/profile")}
        />
      )}
      <button
        onClick={() => onNavigate("/leaderboard")}
        style={{
          flex: "0 0 auto", display: "flex", alignItems: "center",
          gap: "var(--space-2)", padding: "var(--space-3) var(--space-5)",
          background: "var(--bg-surface)", border: "1.5px dashed var(--border-medium)",
          borderRadius: "var(--radius-xl)", cursor: "pointer", color: "var(--ink-secondary)",
          fontSize: "var(--text-sm)", fontWeight: 600, whiteSpace: "nowrap",
          transition: "all 0.15s ease", fontFamily: "var(--font-body)",
        }}
        onMouseEnter={(e) => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.borderColor = "var(--saffron)";
          b.style.color = "var(--saffron-dark)";
          b.style.background = "var(--saffron-light)";
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.borderColor = "var(--border-medium)";
          b.style.color = "var(--ink-secondary)";
          b.style.background = "var(--bg-surface)";
        }}
      >
        🏆 Leaderboard
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const auth     = useAuth();

  const [subjects,      setSubjects]      = useState<StudentSubject[]>([]);
  const [assessments,   setAssessments]   = useState<AssessmentWithStatus[]>([]);
  const [gamification,  setGamification]  = useState<MySummary | null>(null);
  const [resumeMap,     setResumeMap]     = useState<ResumeMap>({});
  const [loadingSubj,   setLoadingSubj]   = useState(true);
  const [loadingAssess, setLoadingAssess] = useState(true);
  const [assessError,   setAssessError]   = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const greetingEmoji = hour < 12 ? "🌤️" : hour < 17 ? "☀️" : "🌙";

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
        else setError("Failed to load subjects. Please refresh.");
        if (gData.status === "fulfilled") setGamification(gData.value);
        if (assessData.status === "fulfilled") setAssessments(assessData.value ?? []);
        else setAssessError(true);
      } finally {
        if (!cancelled) { setLoadingSubj(false); setLoadingAssess(false); }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (subjects.length === 0) return;
    const coursed = subjects.filter((s) => s.course_id != null);
    if (coursed.length === 0) return;
    let cancelled = false;
    async function loadResume() {
      const results = await Promise.allSettled(coursed.map((s) => getCourseProgress(s.course_id!)));
      if (cancelled) return;
      const map: ResumeMap = {};
      results.forEach((result, idx) => {
        const courseId = coursed[idx].course_id!;
        if (result.status === "fulfilled") map[courseId] = result.value.resume_lesson_id;
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
    <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* ── Greeting ── */}
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)",
            fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1,
            marginBottom: "var(--space-2)", color: "var(--ink-primary)",
          }}>
            {greeting}{auth.user ? `, ${auth.user.username.split("_")[0]}` : ""}
            {" "}{greetingEmoji}
          </h1>
          <p style={{ fontSize: "var(--text-base)", color: "var(--ink-muted)", margin: 0 }}>
            Here's what's happening with your learning today.
          </p>
        </div>

        {/* ── Gamification strip ── */}
        {gamification && (
          <StreakCard gamification={gamification} onNavigate={navigate} />
        )}

        {/* ── Assessments ── */}
        <div style={{ marginBottom: "var(--space-12)" }}>
          <div className="section-header">
            <div>
              <h2 className="section-header__title">
                Assessments
                {pendingCount > 0 && !loadingAssess && (
                  <span style={{
                    marginLeft: "var(--space-2)", fontSize: 9, fontWeight: 800,
                    padding: "2px 8px", borderRadius: "var(--radius-full)",
                    background: "var(--error-bg)", color: "var(--error)",
                    verticalAlign: "middle", letterSpacing: "0.05em",
                  }}>
                    {pendingCount} pending
                  </span>
                )}
              </h2>
              <p className="section-header__subtitle">Your tests — attempt them to earn points</p>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => navigate("/assessments")}>
              View all →
            </button>
          </div>

          {assessError ? (
            <div className="alert alert--error">
              Failed to load assessments.
              <button className="btn btn--ghost btn--sm" style={{ marginLeft: "var(--space-3)" }} onClick={() => window.location.reload()}>
                Retry
              </button>
            </div>
          ) : loadingAssess ? (
            <div style={{
              background: "var(--bg-surface)", border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-xl)", overflow: "hidden",
            }}>
              {Array.from({ length: 3 }).map((_, i) => <AssessmentRowSkeleton key={i} />)}
            </div>
          ) : prioritisedAssessments.length === 0 ? (
            <div style={{
              padding: "var(--space-10) var(--space-6)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-xl)", textAlign: "center",
            }}>
              <div style={{ fontSize: 40, marginBottom: "var(--space-4)" }}>📋</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--ink-primary)", marginBottom: "var(--space-2)" }}>
                No assessments yet
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginBottom: "var(--space-6)" }}>
                Tests will appear here once your teacher publishes them.
              </p>
              <button className="btn btn--primary" onClick={() => navigate("/assessments")}>
                Browse assessments
              </button>
            </div>
          ) : (
            <>
              <div style={{
                background: "var(--bg-surface)", border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-xl)", overflow: "hidden",
                boxShadow: "var(--shadow-card)",
              }}>
                {prioritisedAssessments.map((a, i) => (
                  <AssessmentRow key={a.id} a={a} index={i} />
                ))}
              </div>
              {assessments.length > 4 && (
                <button
                  className="history-shortcut"
                  onClick={() => navigate("/assessments")}
                >
                  <span>View all {assessments.length} assessments</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Subjects ── */}
        <div>
          <div className="section-header">
            <div>
              <h2 className="section-header__title">Your Subjects</h2>
              <p className="section-header__subtitle">Track progress across all enrolled subjects</p>
            </div>
          </div>

          {error && <div className="alert alert--error" role="alert">{error}</div>}

          {loadingSubj ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--space-5)" }}>
              {Array.from({ length: 6 }).map((_, i) => <SubjectCardSkeleton key={i} />)}
            </div>
          ) : subjects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📚</div>
              <h3 className="empty-state__title">No subjects yet</h3>
              <p className="empty-state__message">Your subjects will appear here once your teacher assigns them.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--space-5)" }}>
              {subjects.map((subject, i) => (
                <div key={subject.id} className="page-enter" style={{ animationDelay: `${i * 50}ms` }}>
                  <SubjectCard
                    subject={subject}
                    resumeLessonId={subject.course_id != null ? resumeMap[subject.course_id] : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
