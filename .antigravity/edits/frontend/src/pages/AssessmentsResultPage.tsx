import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getMySummary, type MySummary } from "../services/gamification";
import { assessmentHistoryPath } from "../utils/slugs";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { 
  Trophy, 
  Star, 
  History, 
  LayoutDashboard, 
  Trophy as LeaderboardIcon,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import './AssessmentsResultPage.css';

type ResultState = {
  score:         number;
  passed:        boolean;
  total_marks:   number;
  pass_marks:    number;
  assessment_id: number;
  attempt_id:    number;
  grade?:        number | null;
  subject_slug?: string | null;
};

const AssessmentsResultPage: React.FC = () => {
  const { state } = useLocation() as { state: ResultState | null };
  const navigate = useNavigate();

  const [summary, setSummary] = useState<MySummary | null>(null);

  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await getMySummary();
        if (!cancelled) setSummary(data);
      } catch { /* non-fatal */ }
    }
    load();
    return () => { cancelled = true; };
  }, [state]);

  if (!state) {
    return (
      <div className="page-shell">
        <TopBar title="Result" />
        <main className="page-content has-bottom-nav">
          <div className="glass-card error-dock">
             <HelpCircle size={16} /> DATA VOID: No result data detected.
          </div>
          <button className="btn--ghost sm" onClick={() => navigate("/dashboard")} style={{ marginTop: '20px' }}>
            RETURN TO COMMAND CENTER
          </button>
        </main>
        <BottomNav />
      </div>
    );
  }

  const percentage = state.total_marks
    ? Math.round((state.score / state.total_marks) * 100)
    : 0;

  const isPerfect = state.score === state.total_marks && state.total_marks > 0;

  // Logic parity: 5 (attempt) + 25 (pass) + 50 (perfect)
  let pointsEarned = 5;
  if (state.passed) pointsEarned += 25;
  if (isPerfect) pointsEarned += 50;

  const histPath = (state.grade && state.subject_slug)
    ? assessmentHistoryPath(state.grade, state.subject_slug, state.assessment_id)
    : "/assessments/history";

  return (
    <div className="page-shell">
      <TopBar title="Technical Result" />
      <main className="page-content page-enter has-bottom-nav result-layout">
        
        <section className="result-hero glass-card animate-fade-up">
           <div className="result-icon-nexus animate-bounce-subtle">
              {isPerfect ? <Trophy size={64} color="var(--role-student)" /> : state.passed ? <CheckCircle2 size={64} color="var(--role-student)" /> : <XCircle size={64} color="var(--error)" />}
           </div>

           <div className="result-score-nexus">
              <h1 className={`score-display ${state.passed ? 'pass' : 'fail'}`}>
                {percentage}%
              </h1>
              <p className="score-verdict">
                {isPerfect ? "ABSOLUTE PERFECTION" : state.passed ? "VALIDATION SUCCESSFUL" : "VALIDATION FAILED"}
              </p>
           </div>

           <div className="result-specs-grid">
              <div className="spec-unit">
                 <span className="unit-val">{state.score}</span>
                 <span className="unit-label">ACHIEVED</span>
              </div>
              <div className="spec-unit">
                 <span className="unit-val">{state.pass_marks}</span>
                 <span className="unit-label">THRESHOLD</span>
              </div>
              <div className="spec-unit">
                 <span className="unit-val">{state.total_marks}</span>
                 <span className="unit-label">MAXIMUM</span>
              </div>
           </div>
        </section>

        {/* Gamification Nexus */}
        <section className="gamification-nexus glass-card animate-fade-up" style={{ animationDelay: '100ms' }}>
           <div className="points-badge-nexus">
              <div className="star-icon"><Star size={24} fill="currentColor" /></div>
              <div className="points-info">
                 <span className="points-added">+{pointsEarned} INTELLIGENCE XP</span>
                 <p className="points-total">{summary ? `Total: ${summary.total_points} XP` : "Building your digital legacy..."}</p>
              </div>
              {isPerfect && <div className="perfect-tag">BONUS UNLOCKED</div>}
           </div>
        </section>

        {/* Action Nexus */}
        <footer className="action-nexus animate-fade-up" style={{ animationDelay: '200ms' }}>
           <div className="primary-actions">
              <button className="btn--primary lg" onClick={() => navigate("/dashboard")}>
                 <LayoutDashboard size={18} /> DASHBOARD
              </button>
              <button className="btn--secondary lg" onClick={() => navigate(histPath)}>
                 <History size={18} /> VIEW LOGS
              </button>
           </div>
           
           <button className="btn--ghost full md" onClick={() => navigate("/leaderboard")} style={{ marginTop: 'var(--space-4)' }}>
              <LeaderboardIcon size={16} /> VIEW GLOBAL RANKINGS
           </button>
        </footer>

      </main>
      <BottomNav />
    </div>
  );
};

export default AssessmentsResultPage;
