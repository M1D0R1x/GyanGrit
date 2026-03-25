import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "@livekit/components-styles";
import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  listMySessions, createSession, startSession, endSession,
  getUpcomingSessions, joinSession, getSessionToken,
  type LiveSession, type LiveToken,
} from "../services/livesessions";
import { apiGet } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

const StudentVideoLayout: React.FC = () => {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  return (
    <div className="glass-card" style={{ height: 'calc(100vh - 200px)', overflow: 'hidden', padding: 0 }}>
      <GridLayout tracks={tracks}>
        <ParticipantTile />
      </GridLayout>
    </div>
  );
};

const SessionCard: React.FC<{ 
  s: LiveSession; 
  onAction: (s: LiveSession) => void;
  isTeacher: boolean;
}> = ({ s, onAction, isTeacher }) => {
  const isLive = s.status === "live";
  const actionLabel = isTeacher ? (s.status === "scheduled" ? "INITIATE" : "REJOIN") : (isLive ? "JOIN ARENA" : "SCHEDULED");

  return (
    <div className="glass-card page-enter" style={{ padding: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: isLive ? '4px solid var(--role-teacher)' : '1px solid var(--glass-border)' }}>
       <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
             {isLive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--role-teacher)', animation: 'pulse 1.5s infinite' }} />}
             <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', color: isLive ? 'var(--role-teacher)' : 'var(--text-dim)' }}>{s.status.toUpperCase()}</span>
          </div>
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: '4px' }}>{s.title}</h3>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.subject_name || "General"} · {s.teacher_name}</div>
       </div>
       <button 
         className={isLive || (isTeacher && s.status === "scheduled") ? "btn--primary" : "btn--ghost"} 
         disabled={!isLive && !isTeacher}
         onClick={() => onAction(s)}
         style={{ padding: 'var(--space-2) var(--space-6)', fontSize: '11px' }}
       >
         {actionLabel}
       </button>
    </div>
  );
};

const LiveSessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const isTeacher = ["TEACHER", "PRINCIPAL", "ADMIN"].includes(user?.role || "");

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [liveToken, setLiveToken] = useState<LiveToken | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = isTeacher ? listMySessions : getUpcomingSessions;
    fetch().then(setSessions).finally(() => setLoading(false));
  }, [isTeacher]);

  const handleJoin = async (s: LiveSession) => {
    if (!isTeacher) await joinSession(s.id);
    const token = await getSessionToken(s.id);
    setLiveToken(token);
  };

  const handleStart = async (s: LiveSession) => {
    const updated = await startSession(s.id);
    setSessions(prev => prev.map(item => item.id === s.id ? updated : item));
    handleJoin(updated);
  };

  if (liveToken) {
    const active = sessions.find(s => s.status === "live");
    return (
      <div style={{ height: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: 'var(--space-4) var(--space-6)', background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--role-teacher)', animation: 'pulse 1.5s infinite' }} />
              <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.1em' }}>LIVE STREAM: {active?.title || "CLASS SESSION"}</div>
           </div>
           <button className="btn--ghost" onClick={() => setLiveToken(null)} style={{ padding: '4px 12px', fontSize: '10px' }}>DISCONNECT</button>
        </header>
        
        <main style={{ flex: 1, padding: 'var(--space-6)' }}>
           <LiveKitRoom
             token={liveToken.token}
             serverUrl={liveToken.livekit_url}
             connect={true}
             video={isTeacher}
             audio={isTeacher}
             onDisconnected={() => setLiveToken(null)}
           >
             {isTeacher ? <VideoConference /> : (
               <>
                 <RoomAudioRenderer />
                 <StudentVideoLayout />
                 <ControlBar variation="minimal" />
               </>
             )}
           </LiveKitRoom>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title="Live Sessions" />
      <main className="page-content page-enter" style={{ padding: 'var(--space-10) var(--space-6)' }}>
         <header className="editorial-header" style={{ marginBottom: 'var(--space-10)' }}>
            <div className="role-tag role-tag--teacher" style={{ marginBottom: 'var(--space-4)' }}>📡 Global Broadcast</div>
            <h1 className="text-gradient" style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>Live Learning.</h1>
            <p style={{ color: 'var(--text-muted)' }}>Synchronous intelligence exchange. Select an active session to begin participation.</p>
         </header>

         {loading ? (
           <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />)}
           </div>
         ) : sessions.length === 0 ? (
           <div className="glass-card" style={{ padding: 'var(--space-20)', textAlign: 'center', border: '2px dashed var(--glass-border)' }}>
              <div style={{ fontSize: '40px', marginBottom: 'var(--space-4)' }}>📹</div>
              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>Silence in the Air.</h3>
              <p style={{ color: 'var(--text-muted)' }}>No live sessions are currently scheduled in your quadrant.</p>
           </div>
         ) : (
           <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {sessions.map(s => (
                <SessionCard 
                  key={s.id} 
                  s={s} 
                  isTeacher={isTeacher}
                  onAction={isTeacher && s.status === "scheduled" ? handleStart : handleJoin} 
                />
              ))}
           </div>
         )}
      </main>
      <BottomNav />
    </div>
  );
};

export default LiveSessionPage;
