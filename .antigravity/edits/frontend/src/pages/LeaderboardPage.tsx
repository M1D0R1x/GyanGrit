import React, { useEffect, useState } from "react";
import {
  getClassLeaderboard,
  getSchoolLeaderboard,
  type LeaderboardEntry,
  type ClassLeaderboard,
  type SchoolLeaderboard,
} from "../services/gamification.ts";
import TopBar from "../components/TopBar.tsx";
import BottomNav from "../components/BottomNav.tsx";

const RankingCard: React.FC<{ entry: LeaderboardEntry; rank: number }> = ({ entry, rank }) => {
  const isTop3 = rank <= 3;
  const colors = ["#ff6b6b", "#fab005", "#3dd68c", "#4dabf7"]; // Priority ranks
  const accent = isTop3 ? colors[rank - 1] : "var(--text-muted)";

  return (
    <div className="glass-card page-enter" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-6)', border: entry.is_me ? `1px solid var(--role-student)` : '1px solid var(--glass-border)', background: entry.is_me ? 'rgba(61, 214, 140, 0.05)' : 'var(--bg-glass)' }}>
       <div style={{ width: 40, height: 40, borderRadius: '50%', background: isTop3 ? `${accent}22` : 'var(--bg-elevated)', border: `1px solid ${accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 900, color: accent }}>
          {rank}
       </div>
       <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: entry.is_me ? 'var(--role-student)' : 'var(--text-primary)' }}>{entry.is_me ? "YOU (SCHOLAR)" : entry.display_name.toUpperCase()}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700 }}>{entry.total_points} KNOWLEDGE POINTS</div>
       </div>
       {isTop3 && <div style={{ fontSize: '20px' }}>{["🥇", "🥈", "🥉"][rank - 1]}</div>}
    </div>
  );
};

const LeaderboardPage: React.FC = () => {
  const [tab, setTab] = useState<"class" | "school">("class");
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetch = tab === "class" ? getClassLeaderboard() : getSchoolLeaderboard();
    fetch.then(res => setData(res.entries)).finally(() => setLoading(false));
  }, [tab]);

  if (loading) return <div className="page-shell"><TopBar /><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="btn__spinner" /></main></div>;

  return (
    <div className="page-shell">
      <TopBar title="The Scholar Hall" />
      <main className="page-content page-enter has-bottom-nav" style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--space-10) var(--space-6)' }}>
        
        <header style={{ marginBottom: 'var(--space-10)', textAlign: 'center' }}>
           <div className="role-tag role-tag--student" style={{ marginBottom: 'var(--space-4)' }}>PRESTIGE LEDGER</div>
           <h1 className="text-gradient" style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>Scholar Hall.</h1>
           <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '4px', maxWidth: '300px', margin: '0 auto' }}>
              <button onClick={() => setTab("class")} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: tab === "class" ? 'var(--brand-primary)' : 'transparent', color: tab === "class" ? '#000' : 'var(--text-muted)', fontSize: '10px', fontWeight: 900, border: 'none' }}>MY CLASS</button>
              <button onClick={() => setTab("school")} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: tab === "school" ? 'var(--brand-primary)' : 'transparent', color: tab === "school" ? '#000' : 'var(--text-muted)', fontSize: '10px', fontWeight: 900, border: 'none' }}>MY SCHOOL</button>
           </div>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
           {data.map((entry, i) => (
             <RankingCard key={i} entry={entry} rank={i + 1} />
           ))}
        </div>

      </main>
      <BottomNav />
    </div>
  );
};

export default LeaderboardPage;
