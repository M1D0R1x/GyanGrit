import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import * as Ably from "ably";
import {
  listRooms,
  getRoomDetail,
  createRoom,
  joinRoom,
  startRoom,
  finishRoom,
  submitAnswer,
  getAblyToken,
  type CompetitionRoom,
  type Question,
  type LeaderboardEntry,
} from "../services/competitions";
import { useAuth } from "../auth/AuthContext";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; color: string; pulse?: boolean }> = {
    draft: { label: "WAITING", color: "var(--text-muted)" },
    active: { label: "LIVE ARENA", color: "var(--role-teacher)", pulse: true },
    finished: { label: "ARCHIVED", color: "var(--brand-primary)" },
  };
  const s = map[status] ?? map.draft;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {s.pulse && <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, animation: 'pulse 1.5s infinite' }} />}
      <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', color: s.color }}>{s.label}</span>
    </div>
  );
};

const CompetitionRoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTeacher = ["TEACHER", "PRINCIPAL", "ADMIN"].includes(user?.role || "");

  const [rooms, setRooms] = useState<CompetitionRoom[]>([]);
  const [room, setRoom] = useState<CompetitionRoom | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      listRooms().then(setRooms).finally(() => setLoading(false));
    } else {
      getRoomDetail(Number(roomId)).then(r => {
        setRoom(r);
        setLeaderboard(r.participants?.map((p, i) => ({ ...p, rank: p.rank ?? i + 1 })) || []);
      }).finally(() => setLoading(false));
    }
  }, [roomId]);

  if (loading) return <div className="page-shell"><TopBar /><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="btn__spinner" /></main></div>;

  if (!roomId) {
    return (
      <div className="page-shell">
        <TopBar title="The Arena" />
        <main className="page-content page-enter" style={{ padding: 'var(--space-10) var(--space-6)' }}>
           <header className="editorial-header" style={{ marginBottom: 'var(--space-10)' }}>
              <div className="role-tag role-tag--student" style={{ marginBottom: 'var(--space-4)' }}>🏆 Real-time Mastery</div>
              <h1 className="text-gradient" style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>Competitions.</h1>
              <p style={{ color: 'var(--text-muted)' }}>Enter the live arena and challenge your peers in real-time knowledge battles.</p>
           </header>

           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              {rooms.map(r => (
                <div key={r.id} className="glass-card card--clickable" onClick={() => navigate(`${r.id}`)} style={{ padding: 'var(--space-6)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                      <StatusBadge status={r.status} />
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{r.participant_count} ENTERED</div>
                   </div>
                   <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: '4px' }}>{r.title}</h3>
                   <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.section} · {r.assessment}</div>
                </div>
              ))}
           </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page-shell" style={{ background: 'var(--bg-primary)' }}>
      <TopBar title={room?.title || "Arena Room"} />
      <main style={{ height: 'calc(100vh - 64px)', display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
         
         {/* Live Arena */}
         <section style={{ padding: 'var(--space-10)', overflowY: 'auto', borderRight: '1px solid var(--glass-border)' }}>
            <div className="page-enter" style={{ maxWidth: '700px', margin: '0 auto' }}>
               <StatusBadge status={room?.status || "draft"} />
               <h1 style={{ fontSize: 'var(--text-4xl)', fontWeight: 900, marginTop: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>{room?.title}</h1>
               
               {room?.status === "draft" && (
                 <div className="glass-card" style={{ padding: 'var(--space-10)', textAlign: 'center', border: '2px dashed var(--glass-border)' }}>
                    <div style={{ fontSize: '40px', marginBottom: 'var(--space-4)' }}>⚔️</div>
                    <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>Awaiting Activation</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-8)' }}>The master sequencer has not yet initiated this arena.</p>
                    {isTeacher && <button className="btn--primary" onClick={() => startRoom(room.id)}>INITIALIZE ARENA</button>}
                 </div>
               )}

               {room?.status === "active" && (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    {room.questions?.map((q, i) => (
                      <div key={q.id} className="glass-card" style={{ padding: 'var(--space-8)' }}>
                         <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-primary)', marginBottom: 'var(--space-2)' }}>SEQUENCE 0{i+1}</div>
                         <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-6)' }}>{q.text}</p>
                         <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                            {q.options.map(opt => (
                              <button key={opt.id} className="btn--ghost" style={{ textAlign: 'left', padding: 'var(--space-4)', justifyContent: 'flex-start', border: '1px solid var(--glass-border)' }}>{opt.text}</button>
                            ))}
                         </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>
         </section>

         {/* Live Scoreboard */}
         <aside style={{ background: 'var(--bg-surface)', padding: 'var(--space-6)', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 'var(--space-6)' }}>LIVE SCOREBOARD</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
               {leaderboard.map((e, i) => (
                 <div key={e.student_id} className="glass-card page-enter" style={{ 
                   padding: 'var(--space-3) var(--space-4)', 
                   display: 'flex', 
                   alignItems: 'center', 
                   gap: 'var(--space-4)',
                   borderLeft: i === 0 ? '4px solid var(--role-teacher)' : '1px solid var(--glass-border)',
                   animationDelay: `${i * 50}ms`
                 }}>
                   <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900 }}>{e.rank}</div>
                   <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', fontWeight: 700 }}>{e.display_name || e.username}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{e.score} PTS</div>
                   </div>
                   {i === 0 && <span style={{ fontSize: '12px' }}>👑</span>}
                 </div>
               ))}
            </div>
         </aside>

      </main>
      <BottomNav />
    </div>
  );
};

export default CompetitionRoomPage;
