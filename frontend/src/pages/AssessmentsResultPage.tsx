// pages.AssessmentResultPage
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getMySummary, type MySummary } from "../services/gamification";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

type ResultState = {
  score:         number;
  passed:        boolean;
  total_marks:   number;
  pass_marks:    number;
  assessment_id: number;
  attempt_id:    number;
};

export default function AssessmentResultPage() {
  const { state } = useLocation() as { state: ResultState | null };
  const navigate  = useNavigate();

  const [summary, setSummary] = useState<MySummary | null>(null);

  // Fetch gamification summary to show points earned
  useEffect(() => {
    if (!state) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await getMySummary();
        if (!cancelled) setSummary(data);
      } catch { /* gamification failure is non-fatal */ }
    }

    void load();
    return () => { cancelled = true; };
  }, [state]);

  if (!state) {
    return (
      <div className="page-shell">
        <TopBar title="Result" />
        <main className="page-content has-bottom-nav">
          <div className="empty-state">
            <div className="empty-state__icon">❓</div>
            <h3 className="empty-state__title">No result data</h3>
            <p className="empty-state__message">
              This page must be reached by submitting an assessment.
            </p>
            <button className="btn btn--secondary" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const percentage = state.total_marks
    ? Math.round((state.score / state.total_marks) * 100)
    : 0;

  const isPerfect = state.score === state.total_marks && state.total_marks > 0;

  // Estimate points earned this attempt
  let pointsEarned = 5; // attempt bonus always
  if (state.passed)  pointsEarned += 25;
  if (isPerfect)     pointsEarned += 50;

  return (
    <div className="page-shell">
      <TopBar title="Result" />
      <main
        className="page-content page-enter has-bottom-nav"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "var(--space-10)" }}
      >
        <div className="result-card">

          {/* Emoji */}
          <div className="result-card__icon">
            {isPerfect ? "💯" : state.passed ? "🎉" : "📖"}
          </div>

          {/* Score */}
          <div className={`result-card__score ${state.passed ? "result-card__score--pass" : "result-card__score--fail"}`}>
            {percentage}%
          </div>

          <div className="result-card__label">
            {isPerfect ? "Perfect Score!" : state.passed ? "Assessment Passed" : "Assessment Failed"}
          </div>

          {/* Raw scores */}
          <div style={{
            display:         "flex",
            gap:             "var(--space-8)",
            justifyContent:  "center",
            marginBottom:    "var(--space-6)",
            padding:         "var(--space-5)",
            background:      "var(--bg-elevated)",
            borderRadius:    "var(--radius-md)",
          }}>
            {[
              { label: "Your Score",  value: state.score },
              { label: "Pass Mark",   value: state.pass_marks },
              { label: "Total Marks", value: state.total_marks },
            ].map(({ label, value }, idx, arr) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)" }}>
                    {value}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {label}
                  </div>
                </div>
                {idx < arr.length - 1 && (
                  <div style={{ width: 1, height: 36, background: "var(--border-subtle)" }} />
                )}
              </div>
            ))}
          </div>

          {/* Points earned banner */}
          <div style={{
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            gap:          "var(--space-3)",
            padding:      "var(--space-4)",
            background:   "rgba(59,130,246,0.06)",
            border:       "1px solid rgba(59,130,246,0.15)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-6)",
          }}>
            <span style={{ fontSize: 24 }}>⭐</span>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", color: "var(--role-student)" }}>
                +{pointsEarned} points earned
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                {summary ? `Total: ${summary.total_points} pts` : "Keep going to earn more!"}
              </div>
            </div>
            {isPerfect && (
              <div style={{
                marginLeft:   "auto",
                padding:      "2px 10px",
                background:   "rgba(245,158,11,0.15)",
                border:       "1px solid rgba(245,158,11,0.3)",
                borderRadius: "var(--radius-full)",
                fontSize:     "var(--text-xs)",
                fontWeight:   700,
                color:        "var(--warning)",
              }}>
                💯 Perfect bonus!
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="result-card__actions">
            <button
              className="btn btn--secondary"
              onClick={() => navigate(`/assessments/${state.assessment_id}/history`)}
            >
              View History
            </button>
            <button
              className="btn btn--primary"
              onClick={() => navigate("/dashboard")}
            >
              Dashboard
            </button>
          </div>

          {/* Leaderboard shortcut */}
          <button
            className="btn btn--ghost"
            style={{ width: "100%", marginTop: "var(--space-3)", color: "var(--role-student)" }}
            onClick={() => navigate("/leaderboard")}
          >
            🏆 View leaderboard
          </button>

        </div>
      </main>
      <BottomNav />
    </div>
  );
}