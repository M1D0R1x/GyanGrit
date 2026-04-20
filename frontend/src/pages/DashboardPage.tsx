// pages.DashboardPage — Chalk & Sunlight v3 + Mobile PWA
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiGet } from "../services/api";
import { getMySummary, type MySummary } from "../services/gamification";
import { getMyEngagement, getMyRisk, type DailySummary, type RiskData } from "../services/analytics";
import { type AssessmentWithStatus } from "../services/assessments";
import { getBatchCourseProgress } from "../services/content";
import { assessmentPath } from "../utils/slugs";
import { usePageTitle } from "../hooks/usePageTitle";
import { useIsMobile } from "../hooks/useMobile";

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

// ── Weekly engagement strip ────────────────────────────────────────

function WeeklyEngagementCard({ summary }: { summary: DailySummary[] }) {
  // sum across last 7 days
  const totals = summary.reduce(
    (acc, d) => ({
      lesson:     acc.lesson     + d.lesson_min,
      live:       acc.live       + d.live_min,
      assessment: acc.assessment + d.assessment_min,
      flashcard:  acc.flashcard  + d.flashcard_min,
      ai:         acc.ai         + d.ai_messages,
    }),
    { lesson: 0, live: 0, assessment: 0, flashcard: 0, ai: 0 },
  );

  const total = totals.lesson + totals.live + totals.assessment + totals.flashcard;
  if (total === 0 && totals.ai === 0) return null;

  const items = [
    { icon: "📖", label: "Lessons",     value: `${totals.lesson}m`,     show: totals.lesson > 0 },
    { icon: "🎓", label: "Live",        value: `${totals.live}m`,       show: totals.live > 0 },
    { icon: "📝", label: "Assessments", value: `${totals.assessment}m`, show: totals.assessment > 0 },
    { icon: "🃏", label: "Flashcards",  value: `${totals.flashcard}m`,  show: totals.flashcard > 0 },
    { icon: "🤖", label: "AI Chats",    value: `${totals.ai}`,         show: totals.ai > 0 },
  ].filter(i => i.show);

  return (
    <div style={{
      background: "var(--glass-fill)",
      border: "1px solid var(--glass-stroke)",
      borderRadius: "var(--radius-xl)",
      padding: "var(--space-4) var(--space-6)",
      marginBottom: "var(--space-8)",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)",
      overflowX: "auto",
      scrollbarWidth: "none",
    }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-muted)", marginBottom: 2 }}>This week</div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", color: "var(--ink-primary)" }}>{total}m</div>
      </div>
      <div style={{ width: 1, height: 32, background: "var(--border-light)", flexShrink: 0 }} />
      {items.map(item => (
        <div key={item.label} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ fontSize: 16 }}>{item.icon}</span>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--ink-primary)", lineHeight: 1 }}>{item.value}</div>
            <div style={{ fontSize: 9, color: "var(--ink-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Risk level banner (MEDIUM / HIGH only) ────────────────────────────────────

function RiskBannerCard({ risk }: { risk: RiskData }) {
  if (risk.risk_level === "low") return null;

  const isHigh   = risk.risk_level === "high";
  const color    = isHigh ? "var(--error)"   : "var(--warning)";
  const bg       = isHigh ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)";
  const border   = isHigh ? "rgba(239,68,68,0.22)" : "rgba(245,158,11,0.22)";
  const icon     = isHigh ? "⚠️" : "📊";
  const label    = isHigh ? "High Risk" : "Needs Attention";

  // Human-readable factor reasons (v2 risk algorithm)
  const reasons: string[] = [];
  const f = risk.factors as Record<string, unknown>;
  if (f.login_recency)        reasons.push(String(f.login_recency));
  if (f.engagement_trend)     reasons.push(String(f.engagement_trend));
  if (f.assessment_failures)  reasons.push(String(f.assessment_failures));
  if (f.lesson_completion)    reasons.push(`lesson progress: ${f.lesson_completion}`);
  if (f.assessment_avoidance) reasons.push(String(f.assessment_avoidance));
  if (f.live_session_absence) reasons.push(String(f.live_session_absence));
  if (f.streak_broken)        reasons.push(String(f.streak_broken));
  // Legacy factor names (v1 backward compat)
  if (!reasons.length && f.engagement_drop)  reasons.push("engagement dropped recently");
  if (!reasons.length && f.recent_failures)  reasons.push(`${f.recent_failures} failed assessment(s)`);

  const reasonText = reasons.length > 0 ? reasons.join(" · ") : "review your activity";

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-3) var(--space-5)",
      marginBottom: "var(--space-6)",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-3)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-sm)", color, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
          Your engagement suggests attention needed — {reasonText}. Keep pushing!
        </div>
      </div>
      <div style={{
        flexShrink: 0, fontSize: "var(--text-xs)", fontWeight: 800,
        fontFamily: "var(--font-display)", color, opacity: 0.8,
      }}>
        {Math.round(risk.score)}/100
      </div>
    </div>
  );
}



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
        background:    "var(--glass-fill)",
        borderTop:     `1px solid ${hov ? "rgba(245,158,11,0.4)" : "var(--glass-stroke)"}`,
        borderRight:   `1px solid ${hov ? "rgba(245,158,11,0.4)" : "var(--glass-stroke)"}`,
        borderBottom:  `1px solid ${hov ? "rgba(245,158,11,0.4)" : "var(--glass-stroke)"}`,
        borderLeft:    `4px solid ${progressColor}`,
        borderRadius:  "var(--radius-lg)",
        cursor:        "pointer",
        transition:    "all var(--transition-base)",
        transform:     hov ? "translateY(-1px)" : "translateY(0)",
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
        background:     hov ? "var(--saffron-glow)" : "transparent",
        transform:      hov ? "translateX(4px)" : "translateX(0)",
        transition:     "all var(--transition-base)",
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

// ── Gamification strip (mobile-first gam-strip CSS, StatPills on desktop) ──────

function GamStrip({ gamification, onNavigate }: { gamification: MySummary; onNavigate: (path: string) => void }) {
  const streakEmoji = gamification.current_streak >= 7 ? "⚡" : gamification.current_streak >= 3 ? "🔥" : "📅";
  return (
    <div className="gam-strip">
      {/* Points */}
      <div
        className="gam-card gam-card--points"
        onClick={() => onNavigate("/leaderboard")}
        role="button" tabIndex={0}
        aria-label={`${gamification.total_points} points, rank #${gamification.class_rank ?? '—'}`}
        onKeyDown={(e) => e.key === "Enter" && onNavigate("/leaderboard")}
      >
        <span className="gam-card__emoji">⭐</span>
        <div>
          <div className="gam-card__number">{gamification.total_points}</div>
          <div className="gam-card__label">Points</div>
        </div>
      </div>

      {/* Streak */}
      <div className="gam-card gam-card--streak" role="img" aria-label={`${gamification.current_streak} day streak`}>
        <span className="gam-card__emoji">{streakEmoji}</span>
        <div>
          <div className="gam-card__number">{gamification.current_streak}</div>
          <div className="gam-card__label">Day streak</div>
        </div>
      </div>

      {/* Badges */}
      {gamification.badge_count > 0 && (
        <div
          className="gam-card gam-card--badges"
          onClick={() => onNavigate("/profile")}
          role="button" tabIndex={0}
          aria-label={`${gamification.badge_count} badges`}
          onKeyDown={(e) => e.key === "Enter" && onNavigate("/profile")}
        >
          <span className="gam-card__emoji">🏅</span>
          <div>
            <div className="gam-card__number">{gamification.badge_count}</div>
            <div className="gam-card__label">Badges</div>
          </div>
        </div>
      )}

      {/* Rank */}
      <div
        className="gam-card gam-card--rank"
        onClick={() => onNavigate("/leaderboard")}
        role="button" tabIndex={0}
        aria-label={`Class rank #${gamification.class_rank ?? '—'}`}
        onKeyDown={(e) => e.key === "Enter" && onNavigate("/leaderboard")}
      >
        <span className="gam-card__emoji">🏆</span>
        <div>
          <div className="gam-card__number">#{gamification.class_rank ?? "—"}</div>
          <div className="gam-card__label">Class rank</div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const auth     = useAuth();
  const isMobile = useIsMobile();
  usePageTitle("Dashboard");

  const [subjects,      setSubjects]      = useState<StudentSubject[]>([]);
  const [assessments,   setAssessments]   = useState<AssessmentWithStatus[]>([]);
  const [gamification,  setGamification]  = useState<MySummary | null>(null);
  const [resumeMap,     setResumeMap]     = useState<ResumeMap>({});
  const [engagement,    setEngagement]    = useState<DailySummary[]>([]);
  const [risk,          setRisk]          = useState<RiskData | null>(null);
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
        // Engagement summary (non-critical — fail silently)
        getMyEngagement(7).then(r => { if (!cancelled) setEngagement(r.summary ?? []); }).catch(() => {});
        // Risk score (non-critical — fail silently)
        getMyRisk().then(r => { if (!cancelled) setRisk(r); }).catch(() => {});
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
      // Single batch request instead of N individual calls (fixes BRONZE-7)
      const batchMap = await getBatchCourseProgress(coursed.map((s) => s.course_id!));
      if (cancelled) return;
      const map: ResumeMap = {};
      for (const s of coursed) {
        const entry = batchMap[String(s.course_id!)];
        if (entry) map[s.course_id!] = entry.resume_lesson_id;
      }
      setResumeMap(map);
    }
    void loadResume().catch(() => {});
    return () => { cancelled = true; };
  }, [subjects]);

  const prioritisedAssessments = [
    ...assessments.filter((a) => !a.passed),
    ...assessments.filter((a) => a.passed),
  ].slice(0, 4);

  const pendingCount = assessments.filter((a) => !a.passed).length;

  return (
    <div style={{ width: "100%" }}>

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

        {/* ── Risk banner (only shown when MEDIUM or HIGH) ── */}
        {risk && <RiskBannerCard risk={risk} />}

        {/* ── Gamification strip ── */}
        {gamification && (
          <GamStrip gamification={gamification} onNavigate={navigate} />
        )}

        {/* ── Weekly engagement ── */}
        <WeeklyEngagementCard summary={engagement} />

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
              background: "var(--glass-fill)", border: "1px solid var(--glass-stroke)",
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
                background: "var(--glass-fill)", border: "1px solid var(--glass-stroke)",
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
          ) : isMobile ? (
            /* ── Mobile: compact horizontal list rows ── */
            <div className="subject-list-mobile">
              {subjects.map((subject, i) => {
                const progressColor =
                  subject.progress >= 80 ? "var(--success)" :
                  subject.progress >= 40 ? "var(--warning)" : "var(--saffron)";
                const resumeId = subject.course_id != null ? resumeMap[subject.course_id] : undefined;
                function handleTap() {
                  if (typeof resumeId === "number") navigate(`/lessons/${resumeId}`);
                  else navigate(`/courses?subject_id=${subject.id}`);
                }
                return (
                  <button
                    key={subject.id}
                    className="subject-row-mobile page-enter"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={handleTap}
                    aria-label={`${subject.name} — ${subject.progress}% complete`}
                  >
                    <div className="subject-row-mobile__icon">
                      {subject.name.charAt(0)}
                    </div>
                    <div className="subject-row-mobile__body">
                      <div className="subject-row-mobile__name">{subject.name}</div>
                      <div className="subject-row-mobile__meta">
                        {subject.completed_lessons}/{subject.total_lessons} lessons · {subject.progress}%
                      </div>
                      <div className="subject-row-mobile__bar">
                        <div
                          className="subject-row-mobile__bar-fill"
                          style={{ width: `${subject.progress}%`, background: progressColor }}
                        />
                      </div>
                    </div>
                    <svg className="subject-row-mobile__chevron" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                );
              })}
            </div>
          ) : (
            /* ── Desktop: grid of vertical subject cards ── */
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
