// pages.DashboardPage
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import { getMySummary, type MySummary } from "../services/gamification";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

type StudentSubject = {
  id:                number;
  name:              string;
  total_lessons:     number;
  completed_lessons: number;
  progress:          number;
};

function SubjectCardSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-line skeleton-line--title" />
      <div className="skeleton skeleton-line skeleton-line--medium" style={{ marginTop: "var(--space-4)" }} />
      <div className="skeleton skeleton-line skeleton-line--full" style={{ height: 6, marginTop: "var(--space-3)" }} />
      <div className="skeleton skeleton-line skeleton-line--short" style={{ marginTop: "var(--space-2)" }} />
    </div>
  );
}

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

export default function DashboardPage() {
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const [gamification, setGamification] = useState<MySummary | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [subjectsData, gData] = await Promise.allSettled([
          apiGet<StudentSubject[]>("/academics/subjects/"),
          getMySummary(),
        ]);

        if (cancelled) return;

        if (subjectsData.status === "fulfilled") setSubjects(subjectsData.value ?? []);
        else setError("Failed to load dashboard. Please refresh.");

        if (gData.status === "fulfilled") setGamification(gData.value);
        // Gamification failure is non-fatal — silently skip
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page-shell">
      <TopBar title="Dashboard" />
      <main className="page-content page-enter has-bottom-nav">

        {/* ── Gamification strip ─────────────────────────────────────── */}
        {gamification && (
          <div style={{
            display:       "flex",
            gap:           "var(--space-3)",
            marginBottom:  "var(--space-6)",
            flexWrap:      "wrap",
          }}>
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
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/leaderboard")}
            >
              <div style={{ fontSize: 28 }}>⭐</div>
              <div>
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize:   "var(--text-xl)",
                  color:      "var(--role-student)",
                  lineHeight: 1,
                }}>
                  {gamification.total_points}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                  Points · #{gamification.class_rank ?? "—"} in class
                </div>
              </div>
            </div>

            {/* Streak */}
            <div style={{
              flex:        "1 1 140px",
              display:     "flex",
              alignItems:  "center",
              gap:         "var(--space-3)",
              padding:     "var(--space-4)",
              background:  gamification.current_streak >= 3
                ? "rgba(245,158,11,0.06)"
                : "var(--bg-elevated)",
              border:      `1px solid ${gamification.current_streak >= 3 ? "rgba(245,158,11,0.2)" : "var(--border-subtle)"}`,
              borderRadius: "var(--radius-lg)",
            }}>
              <div style={{ fontSize: 28 }}>
                {gamification.current_streak >= 7 ? "⚡" : gamification.current_streak >= 3 ? "🔥" : "📅"}
              </div>
              <div>
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize:   "var(--text-xl)",
                  color:      gamification.current_streak >= 3 ? "var(--warning)" : "var(--text-primary)",
                  lineHeight: 1,
                }}>
                  {gamification.current_streak}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                  Day streak
                </div>
              </div>
            </div>

            {/* Badges shortcut — show count, click to profile */}
            {gamification.badge_count > 0 && (
              <div
                className="card card--clickable"
                style={{
                  flex:        "0 0 auto",
                  display:     "flex",
                  alignItems:  "center",
                  gap:         "var(--space-3)",
                  padding:     "var(--space-4)",
                }}
                onClick={() => navigate("/profile")}
                role="button"
                tabIndex={0}
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

        {/* ── Leaderboard shortcut ───────────────────────────────────── */}
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

        {/* ── Subject cards ──────────────────────────────────────────── */}
        <div className="section-header">
          <div>
            <h2 className="section-header__title">Your Subjects</h2>
            <p className="section-header__subtitle">Track your progress across all enrolled subjects</p>
          </div>
        </div>

        {error && <div className="alert alert--error" role="alert">{error}</div>}

        {loading ? (
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
              <div key={subject.id} style={{ animationDelay: `${i * 60}ms` }} className="page-enter">
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