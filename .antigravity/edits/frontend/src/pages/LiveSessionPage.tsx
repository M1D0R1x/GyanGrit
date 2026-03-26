import "@livekit/components-styles";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useRoomContext,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  listMySessions, createSession, startSession, endSession,
  getUpcomingSessions, joinSession, getSessionToken,
  type LiveSession, type LiveToken,
} from "../services/livesessions";
import { apiGet } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import type { WhiteboardState } from "../components/Whiteboard";
import { 
  Hand, 
  MessageSquare, 
  Monitor, 
  X, 
  Clock, 
  Users, 
  Plus,
  Radio,
  ShieldAlert
} from 'lucide-react';
import './LiveSessionPage.css';

// Lazy-load the heavy Excalidraw whiteboard (~1.5MB)
const Whiteboard = lazy(() => import("../components/Whiteboard"));

// ── Types for data channel messages ──────────────────────────────────────────

type HandRaiseMsg = {
  type: "hand_raise";
  raised: boolean;
  sender_name: string;
  sender_id: string;
};

type ChatMsg = {
  type: "chat";
  message: string;
  sender_name: string;
  sender_id: string;
  timestamp: number;
};

type HandAckMsg = {
  type: "hand_ack";
  target_id: string;
};

type DataMsg = HandRaiseMsg | ChatMsg | HandAckMsg | WhiteboardState;

type InRoomChat = {
  id: string;
  sender_name: string;
  sender_id: string;
  message: string;
  timestamp: number;
};

// ── Video layout ─────────────────────────────────────────────────────────────

function VideoLayout() {
  const tracks = useTracks([
    { source: Track.Source.Camera,      withPlaceholder: true  },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  return (
    <GridLayout tracks={tracks} style={{ height: "100%" }}>
      <ParticipantTile />
    </GridLayout>
  );
}

// ── Hand Raise Hook ──────────────────────────────────────────────────────────

function useHandRaise(userName: string, userId: string) {
  const room = useRoomContext();
  const [raisedHands, setRaisedHands] = useState<Map<string, string>>(new Map());
  const [myHandRaised, setMyHandRaised] = useState(false);

  useEffect(() => {
    if (!room) return;
    const handleData = (payload: Uint8Array) => {
      try {
        const msg: DataMsg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "hand_raise") {
          setRaisedHands(prev => {
            const next = new Map(prev);
            if (msg.raised) next.set(msg.sender_id, msg.sender_name);
            else next.delete(msg.sender_id);
            return next;
          });
        }
        if (msg.type === "hand_ack" && "target_id" in msg && msg.target_id === userId) {
          setMyHandRaised(false);
        }
      } catch { /* ignore */ }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, userId]);

  const toggleHand = useCallback(() => {
    if (!room) return;
    const newState = !myHandRaised;
    setMyHandRaised(newState);
    const msg: HandRaiseMsg = { type: "hand_raise", raised: newState, sender_name: userName, sender_id: userId };
    room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true });
  }, [room, myHandRaised, userName, userId]);

  const acknowledgeHand = useCallback((targetId: string) => {
    if (!room) return;
    setRaisedHands(prev => { const next = new Map(prev); next.delete(targetId); return next; });
    const msg: HandAckMsg = { type: "hand_ack", target_id: targetId };
    room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true });
  }, [room]);

  return { raisedHands, myHandRaised, toggleHand, acknowledgeHand };
}

// ── In-Room Chat Hook ────────────────────────────────────────────────────────

function useInRoomChat(userName: string, userId: string) {
  const room = useRoomContext();
  const [messages, setMessages] = useState<InRoomChat[]>([]);

  useEffect(() => {
    if (!room) return;
    const handleData = (payload: Uint8Array) => {
      try {
        const msg: DataMsg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "chat") {
          setMessages(prev => [...prev.slice(-99), {
            id: `${msg.sender_id}-${msg.timestamp}`,
            sender_name: msg.sender_name,
            sender_id: msg.sender_id,
            message: msg.message,
            timestamp: msg.timestamp,
          }]);
        }
      } catch { /* ignore */ }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  const sendMessage = useCallback((text: string) => {
    if (!room || !text.trim()) return;
    const msg: ChatMsg = { type: "chat", message: text.trim(), sender_name: userName, sender_id: userId, timestamp: Date.now() };
    room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true });
    setMessages(prev => [...prev.slice(-99), {
      id: `${userId}-${msg.timestamp}`, sender_name: userName, sender_id: userId, message: msg.message, timestamp: msg.timestamp,
    }]);
  }, [room, userName, userId]);

  return { messages, sendMessage };
}

// ── Whiteboard Hook ──────────────────────────────────────────────────────────

function useWhiteboard() {
  const room = useRoomContext();
  const [remoteState, setRemoteState] = useState<WhiteboardState | null>(null);

  useEffect(() => {
    if (!room) return;
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "whiteboard") setRemoteState(msg as WhiteboardState);
      } catch { /* ignore */ }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  const broadcastWhiteboard = useCallback((state: WhiteboardState) => {
    if (!room) return;
    room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(state)), { reliable: true });
  }, [room]);

  return { remoteState, broadcastWhiteboard };
}

// ── Chat Panel Component ─────────────────────────────────────────────────────

function ChatPanel({ messages, onSend, userId }: {
  messages: InRoomChat[];
  onSend: (text: string) => void;
  userId: string;
}) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => { if (!input.trim()) return; onSend(input); setInput(""); };

  return (
    <div className="live-chat-panel">
      <div className="live-chat-panel__header"><MessageSquare size={14} /> Live Dialogue</div>
      <div className="live-chat-panel__messages" ref={listRef}>
        {messages.length === 0 ? (
          <div className="live-chat-panel__empty">Channel quiet. Awaiting transmission.</div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`live-chat-msg ${m.sender_id === userId ? "live-chat-msg--mine" : ""}`}>
              <span className="live-chat-msg__name">{m.sender_name}</span>
              <span className="live-chat-msg__text">{m.message}</span>
            </div>
          ))
        )}
      </div>
      <div className="live-chat-panel__input">
        <input 
          type="text" 
          className="form-input" 
          placeholder="Type a message…" 
          value={input}
          onChange={e => setInput(e.target.value)} 
          onKeyDown={e => e.key === "Enter" && handleSend()}
          maxLength={500} 
        />
        <button className="btn--primary sm" onClick={handleSend} disabled={!input.trim()}>SEND</button>
      </div>
    </div>
  );
}

// ── Hand Raise Panel (Teacher View) ──────────────────────────────────────────

function HandRaisePanel({ raisedHands, onAcknowledge }: {
  raisedHands: Map<string, string>;
  onAcknowledge: (id: string) => void;
}) {
  if (raisedHands.size === 0) return null;
  return (
    <div className="live-hands-panel">
      <div className="live-hands-panel__header"><Hand size={14} /> Raised Notifications ({raisedHands.size})</div>
      <div className="live-hands-list">
        {[...raisedHands.entries()].map(([id, name]) => (
          <div key={id} className="live-hands-item glass-card sm">
            <span>{name}</span>
            <button className="btn--ghost btn--xs" onClick={() => onAcknowledge(id)}>ACKNOWLEDGE</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── In-Room Controls ─────────────────────────────────────────────────────────

function InRoomControls({ onToggleChat, chatOpen, onToggleWhiteboard, whiteboardOpen, isTeacher }: {
  onToggleChat: () => void;
  chatOpen: boolean;
  onToggleWhiteboard: () => void;
  whiteboardOpen: boolean;
  isTeacher: boolean;
}) {
  return (
    <div className="live-room-actions">
       <div className="action-group">
          <ControlBar variation="minimal" controls={{ microphone: true, camera: true, screenShare: true, leave: true }} />
       </div>
       <div className="action-spacer" />
       <div className="action-group">
          <button 
            className={`tool-btn ${whiteboardOpen ? 'tool-btn--active' : ''}`} 
            onClick={onToggleWhiteboard}
            title="Whiteboard"
          >
            <Monitor size={18} />
            <span>{isTeacher ? "WHITEBOARD" : (whiteboardOpen ? "HIDE BOARD" : "VIEW BOARD")}</span>
          </button>
          <button 
            className={`tool-btn ${chatOpen ? 'tool-btn--active' : ''}`} 
            onClick={onToggleChat}
            title="Chat"
          >
            <MessageSquare size={18} />
          </button>
       </div>
    </div>
  );
}

// ── In-Room View ─────────────────────────────────────────────────────────────

function InRoomView({ isTeacher, activeSession, onEnd, onLeave, userName, userId }: {
  isTeacher: boolean;
  activeSession: LiveSession | undefined;
  onEnd: (s: LiveSession) => void;
  onLeave: () => void;
  userName: string;
  userId: string;
}) {
  const { raisedHands, myHandRaised, toggleHand, acknowledgeHand } = useHandRaise(userName, userId);
  const { messages, sendMessage } = useInRoomChat(userName, userId);
  const { remoteState, broadcastWhiteboard } = useWhiteboard();
  
  const [chatOpen, setChatOpen] = useState(false);
  const [manualWhiteboardOpen, setManualWhiteboardOpen] = useState(false);
  
  // Students auto-open if broadcast detected
  const whiteboardOpen = isTeacher ? manualWhiteboardOpen : (manualWhiteboardOpen || remoteState !== null);

  return (
    <div className="live-room animate-fade-in">
      {/* Top bar */}
      <header className="live-room__header">
        <div className="live-room__identity">
          <div className="live-pulse" />
          <div className="live-room__meta">
            <span className="live-room__label">BROADCAST ACTIVE</span>
            <h2 className="live-room__session-title">{activeSession?.title || "CLASS SESSION"}</h2>
          </div>
        </div>

        <div className="live-room__nav">
          {!isTeacher && (
            <button 
              className={`hand-btn ${myHandRaised ? 'hand-btn--active' : ''}`}
              onClick={toggleHand}
            >
              <Hand size={16} />
              {myHandRaised ? "HAND RAISED" : "RAISE HAND"}
            </button>
          )}
          
          <div className="nav-divider" />
          
          {isTeacher && activeSession && (
            <button className="btn--error sm" onClick={() => onEnd(activeSession)}>TERMINATE</button>
          )}
          <button className="btn--ghost sm" onClick={onLeave}>EXIT</button>
        </div>
      </header>

      {/* Main content area */}
      <main className="live-room__layout">
        <div className="live-room__primary">
          <div className="live-content-container">
            {whiteboardOpen ? (
              <Suspense fallback={
                <div className="whiteboard-placeholder">
                  <div className="btn__spinner" />
                  <span>SYNCHRONIZING WHITEBOARD...</span>
                </div>
              }>
                <Whiteboard readOnly={!isTeacher} remoteState={remoteState} onBroadcast={isTeacher ? broadcastWhiteboard : undefined} />
              </Suspense>
            ) : (
              <div className="video-grid-wrapper glass-card">
                 <VideoLayout />
              </div>
            )}
          </div>
          <InRoomControls 
            onToggleChat={() => setChatOpen(v => !v)} 
            chatOpen={chatOpen} 
            onToggleWhiteboard={() => setManualWhiteboardOpen(v => !v)}
            whiteboardOpen={whiteboardOpen}
            isTeacher={isTeacher}
          />
        </div>

        <aside className={`live-room__sidebar ${chatOpen ? 'live-room__sidebar--open' : ''}`}>
          {isTeacher && <HandRaisePanel raisedHands={raisedHands} onAcknowledge={acknowledgeHand} />}
          <ChatPanel messages={messages} onSend={sendMessage} userId={userId} />
        </aside>
      </main>
    </div>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

const SessionCard: React.FC<{
  session: LiveSession;
  onAction: (s: LiveSession) => void;
  actionLabel: string;
  isActionDisabled?: boolean;
}> = ({ session, onAction, actionLabel, isActionDisabled }) => {
  const isLive = session.status === "live";

  return (
    <div className="glass-card page-enter session-card">
      <div className="session-card__info">
        <div className="session-card__tags">
           <span className={`status-pill ${isLive ? 'status-pill--live' : ''}`}>
             {isLive && <div className="live-indicator" />}
             {session.status.toUpperCase()}
           </span>
           <span className="session-subject">{session.subject_name || "GENERAL"}</span>
        </div>
        <h3 className="session-title">{session.title}</h3>
        <div className="session-meta">
           <div className="meta-item"><Clock size={12} /> SESSION</div>
           <div className="meta-item"><Users size={12} /> {session.teacher_name}</div>
           {session.attendance_count !== undefined && <div className="meta-item"><Plus size={12} /> {session.attendance_count} JOINED</div>}
        </div>
      </div>
      <button 
        className={isLive ? "btn--primary" : "btn--ghost"} 
        disabled={isActionDisabled}
        onClick={() => onAction(session)}
        style={{ minWidth: '120px' }}
      >
        {actionLabel.toUpperCase()}
      </button>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const LiveSessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const isTeacher = ["TEACHER", "PRINCIPAL", "ADMIN"].includes(user?.role || "");
  const isAdminOrPrincipal = ["ADMIN", "PRINCIPAL"].includes(user?.role || "");
  const userName = user?.display_name || user?.username || "User";
  const userId = String(user?.id ?? "");

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveToken, setLiveToken] = useState<LiveToken | null>(null);
  const [inRoom, setInRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSection, setNewSection] = useState<number | "">("");
  const [newSubject, setNewSubject] = useState<number | "">("");
  const [creating, setCreating] = useState(false);

  // Management data
  const [assignments, setAssignments] = useState<{ section_id: number; section_name: string; class_name: string; subject_id: number; subject_name: string }[]>([]);
  const [allSections, setAllSections] = useState<{ id: number; short_label: string; institution_id: number; institution_name: string }[]>([]);
  const [allSubjects, setAllSubjects] = useState<{ id: number; name: string }[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<number | "">("");

  useEffect(() => {
    const fetchFn = isTeacher ? listMySessions : getUpcomingSessions;
    fetchFn().then(setSessions).catch(() => setError("SIGNAL INTERFERENCE: Failed to synchronize sessions.")).finally(() => setLoading(false));
    
    if (isTeacher) {
      if (isAdminOrPrincipal) {
        apiGet<any[]>("/academics/sections/").then(setAllSections).catch(() => {});
        apiGet<any[]>("/academics/subjects/").then(setAllSubjects).catch(() => {});
      } else {
        apiGet<any[]>("/academics/my-assignments/").then(setAssignments).catch(() => {});
      }
    }
  }, [isTeacher, isAdminOrPrincipal]);

  useEffect(() => {
    if (sessionId && !inRoom) handleJoin(Number(sessionId));
  }, [sessionId, inRoom]);

  const handleJoin = useCallback(async (id: number) => {
    setError(null);
    setLoading(true);
    try {
      if (!isTeacher) await joinSession(id);
      const token = await getSessionToken(id);
      setLiveToken(token);
      setInRoom(true);
    } catch (err: any) {
      let msg = "SIGNAL LOST: Channel unreachable.";
      const raw = err.message?.toLowerCase() || "";
      if (raw.includes("ended")) msg = "SESSION TERMINATED: The orbital sync has concluded.";
      else if (raw.includes("not live")) msg = "ARENA COLD: Waiting for broadcasters to go live.";
      else if (raw.includes("forbidden")) msg = "ACCESS DENIED: Credentials insufficient.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isTeacher]);

  const handleStart = useCallback(async (session: LiveSession) => {
    try {
      const updated = await startSession(session.id);
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
      await handleJoin(session.id);
    } catch { setError("SYSTEM ERROR: Sync initiation failed."); }
  }, [handleJoin]);

  const handleEnd = useCallback(async (session: LiveSession) => {
    if (!window.confirm("CONFIRM TERMINATION: Conclude broadcaster sync?")) return;
    try {
      const updated = await endSession(session.id);
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
      setInRoom(false);
      setLiveToken(null);
    } catch { setError("SYSTEM ERROR: Global broadcast termination failed."); }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || !newSection) return;
    setCreating(true);
    try {
      const s = await createSession({ 
        title: newTitle.trim(), 
        description: newDesc.trim(), 
        section_id: Number(newSection), 
        subject_id: newSubject ? Number(newSubject) : undefined 
      });
      setSessions(prev => [s, ...prev]);
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
      setNewSection("");
      setNewSubject("");
    } catch {
       setError("ENCRYPTION ERROR: Provisioning failed.");
    } finally { setCreating(false); }
  }, [newTitle, newDesc, newSection, newSubject]);

  // View Calculation
  if (inRoom && liveToken) {
    const activeSession = sessions.find(s => s.status === "live") || sessions.find(s => s.id === Number(sessionId));
    return (
      <LiveKitRoom 
        token={liveToken.token} 
        serverUrl={liveToken.livekit_url} 
        connect={true} 
        video={false} 
        audio={isTeacher}
        onDisconnected={() => { setInRoom(false); setLiveToken(null); navigate('/live'); }}
      >
        <RoomAudioRenderer />
        <InRoomView 
          isTeacher={isTeacher} 
          activeSession={activeSession} 
          onEnd={handleEnd}
          onLeave={() => { setInRoom(true); setLiveToken(null); navigate('/live'); }} 
          userName={userName} 
          userId={userId} 
        />
      </LiveKitRoom>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title="Live Portal" />
      
      <main className="page-content page-enter has-bottom-nav">
        {/* Editorial Header */}
        <header className="editorial-header animate-fade-up">
           <div className="role-tag role-tag--teacher" style={{ marginBottom: 'var(--space-4)' }}>
             <Radio size={14} /> LIVE SPECTRUM
           </div>
           <h1 className="text-gradient md-display">
             Synchronous<br/>Intelligence.
           </h1>
           <p className="hero-subtitle">
             Real-time pedagogical transmission. Access active session vectors below.
           </p>
        </header>

        {/* Action Row */}
        {isTeacher && (
          <section className="action-row animate-fade-up" style={{ animationDelay: '100ms' }}>
             <button className="btn--primary" onClick={() => setShowCreate(!showCreate)}>
               <Plus size={18} /> {showCreate ? "CANCEL PROVISIONING" : "PROVISION NEW ARENA"}
             </button>
          </section>
        )}

        {/* Create Form */}
        {showCreate && (
          <div className="glass-card create-session-card animate-fade-up">
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, marginBottom: 'var(--space-6)' }}>SESSION PARAMETERS</h3>
            <div className="form-group">
               <input className="form-input" placeholder="Title Vector *" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
               <input className="form-input" placeholder="Mission Description (Optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
               
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <select className="form-input" value={newSection} onChange={e => setNewSection(Number(e.target.value))}>
                    <option value="">COHORT SECTION *</option>
                    {isAdminOrPrincipal ? 
                      allSections.map(s => <option key={s.id} value={s.id}>{s.short_label}</option>) :
                      assignments.map(a => <option key={a.section_id} value={a.section_id}>{a.section_name} ({a.class_name})</option>)
                    }
                  </select>
                  <select className="form-input" value={newSubject} onChange={e => setNewSubject(Number(e.target.value))}>
                    <option value="">SUBJECT NODAL</option>
                    {allSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
               </div>
            </div>
            <button className="btn--primary" onClick={handleCreate} disabled={creating || !newTitle.trim() || !newSection}>
               {creating ? "ENCRYPTING..." : "INITIALIZE BROADCAST"}
            </button>
          </div>
        )}

        {/* Sessions Stack */}
        <section className="dashboard-section animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="section-header">
            <h2 className="section-title">Nodal Availability</h2>
          </div>

          <div className="session-stack">
            {loading ? (
              [1,2].map(_ => <div key={_} className="glass-card skeleton" style={{ height: '100px', marginBottom: 'var(--space-4)' }} />)
            ) : sessions.length === 0 ? (
              <div className="glass-card empty-well">
                 <Radio size={40} style={{ opacity: 0.2, marginBottom: '20px' }} />
                 <p style={{ fontWeight: 800, fontSize: '10px' }}>NO ACTIVE TRANSMISSIONS DETECTED</p>
                 <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Awaiting synchronization commands.</span>
              </div>
            ) : (
              sessions.map(s => {
                let label = "SCHEDULED";
                let disabled = !isTeacher;
                
                if (s.status === "live") {
                   label = isTeacher ? "REJOIN ARENA" : "JOIN BROADCAST";
                   disabled = false;
                } else if (s.status === "scheduled" && isTeacher) {
                   label = "INITIATE BROADCAST";
                   disabled = false;
                } else if (s.status === "ended") {
                   label = "ARCHIVED";
                   disabled = true;
                }

                return (
                  <SessionCard 
                    key={s.id} 
                    session={s} 
                    actionLabel={label}
                    isActionDisabled={disabled}
                    onAction={s.status === "scheduled" ? handleStart : (sess) => handleJoin(sess.id)}
                  />
                );
              })
            )}
          </div>
        </section>

        {error && (
          <div className="glass-card error-dock animate-fade-up">
             <ShieldAlert size={16} /> {error}
             <button onClick={() => setError(null)}><X size={14} /></button>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  );
};

export default LiveSessionPage;
