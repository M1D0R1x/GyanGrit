import "@livekit/components-styles";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useRoomContext,
  useParticipants,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
  ShieldAlert,
  Settings
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

type PermMsg = {
  type: "permissions";
  mic: boolean;
  camera: boolean;
};

type DataMsg = HandRaiseMsg | ChatMsg | HandAckMsg | WhiteboardState | PermMsg;

type InRoomChat = {
  id: string;
  sender_name: string;
  sender_id: string;
  message: string;
  timestamp: number;
};

type SectionItem = {
  id: number;
  short_label: string;
  institution_id?: number;
  institution_name?: string;
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

// ── Room Permissions Hook ────────────────────────────────────────────────────

function useRoomPermissions(isTeacher: boolean) {
  const room = useRoomContext();
  const [permissions, setPermissions] = useState({ mic: true, camera: true });

  useEffect(() => {
    if (!room) return;
    const handleData = (payload: Uint8Array) => {
      try {
        const msg: DataMsg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "permissions") {
          setPermissions({ mic: msg.mic, camera: msg.camera });
          if (!isTeacher) {
            if (!msg.mic) room.localParticipant.setMicrophoneEnabled(false);
            if (!msg.camera) room.localParticipant.setCameraEnabled(false);
          }
        }
      } catch { /* ignore */ }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, isTeacher]);

  const updatePermissions = useCallback((mic: boolean, camera: boolean) => {
    if (!room || !isTeacher) return;
    setPermissions({ mic, camera });
    const msg: PermMsg = { type: "permissions", mic, camera };
    room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true });
  }, [room, isTeacher]);

  return { permissions, updatePermissions };
}

// ── Whiteboard Hook ──────────────────────────────────────────────────────────

function useWhiteboard(sessionId?: string) {
  const room = useRoomContext();
  const [remoteState, setRemoteState] = useState<WhiteboardState | null>(() => {
    if (!sessionId) return null;
    const saved = localStorage.getItem(`gyangrit_wb_${sessionId}`);
    if (saved) {
      try { return JSON.parse(saved) as WhiteboardState; } catch { return null; }
    }
    return null;
  });

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
    if (sessionId) localStorage.setItem(`gyangrit_wb_${sessionId}`, JSON.stringify(state));
    room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(state)), { reliable: true });
  }, [room, sessionId]);

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
    <div className="live-chat-panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="live-chat-panel__header"><MessageSquare size={14} /> Live Dialogue</div>
      <div className="live-chat-panel__messages" ref={listRef} style={{ flex: 1, overflowY: "auto" }}>
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
      <div className="live-chat-panel__input" style={{ flexShrink: 0 }}>
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

// ── Participants Panel ───────────────────────────────────────────────────────

function ParticipantsPanel({ teacherName }: { teacherName: string }) {
  const participants = useParticipants();
  const sorted = [...participants].sort((a, b) => {
    if (a.name === teacherName) return -1;
    if (b.name === teacherName) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  return (
    <div className="live-chat-panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="live-chat-panel__header"><Users size={14} /> Participants ({participants.length})</div>
      <div className="live-chat-panel__messages" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-2)", padding: "var(--space-3)" }}>
        {sorted.map(p => (
          <div key={p.identity} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--text-xs)" }}>
            <span style={{ fontWeight: p.name === teacherName ? 700 : 400, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
              {p.name || "Unknown"} {p.isLocal && <span style={{ opacity: 0.5 }}>(You)</span>}
              {p.name === teacherName && "🎓"}
            </span>
            <span style={{ display: "flex", gap: "var(--space-2)", opacity: 0.8 }}>
              {p.isMicrophoneEnabled ? "🎙️" : "🔇"}
              {p.isCameraEnabled ? "📷" : ""}
              {p.isScreenShareEnabled ? "💻" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── In-Room Controls ─────────────────────────────────────────────────────────

function InRoomControls({ 
  onToggleTab, activeTab, onToggleWhiteboard, whiteboardOpen, 
  isTeacher, permissions, updatePermissions 
}: {
  onToggleTab: (tab: "chat" | "participants") => void;
  activeTab: "chat" | "participants" | null;
  onToggleWhiteboard: () => void;
  whiteboardOpen: boolean;
  isTeacher: boolean;
  permissions: { mic: boolean; camera: boolean; };
  updatePermissions: (m: boolean, c: boolean) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="live-room-actions">
       <div className="action-group" style={{ position: "relative" }}>
          <ControlBar variation="minimal" controls={{ 
              microphone: isTeacher || permissions.mic, 
              camera: isTeacher || permissions.camera, 
              screenShare: true, leave: true 
          }} />

          {isTeacher && (
            <div style={{ position: "relative", marginLeft: 'var(--space-3)' }}>
              <button className="tool-btn" onClick={() => setShowSettings(v => !v)} title="Room Settings">
                <Settings size={18} />
              </button>
              {showSettings && (
                <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "var(--space-3)", marginBottom: "var(--space-2)", width: 220, zIndex: 50 }}>
                  <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: "var(--space-2)", color: "var(--text-muted)", fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>STUDENT PERMISSIONS</div>
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-primary)", cursor: "pointer", marginBottom: "var(--space-2)" }}>
                    <input type="checkbox" checked={permissions.mic} onChange={e => updatePermissions(e.target.checked, permissions.camera)} /> Allow unmute
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={permissions.camera} onChange={e => updatePermissions(permissions.mic, e.target.checked)} /> Allow camera
                  </label>
                </div>
              )}
            </div>
          )}
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
            className={`tool-btn ${activeTab === 'participants' ? 'tool-btn--active' : ''}`} 
            onClick={() => onToggleTab("participants")}
            title="Participants"
          >
            <Users size={18} />
          </button>

          <button 
            className={`tool-btn ${activeTab === 'chat' ? 'tool-btn--active' : ''}`} 
            onClick={() => onToggleTab("chat")}
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
  const { remoteState, broadcastWhiteboard } = useWhiteboard(activeSession?.id);
  const { permissions, updatePermissions } = useRoomPermissions(isTeacher);
  
  const [activeTab, setActiveTab] = useState<"chat" | "participants" | null>(null);
  const [manualWhiteboardOpen, setManualWhiteboardOpen] = useState(false);
  
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    if (!isTeacher && remoteState && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      const id = requestAnimationFrame(() => setManualWhiteboardOpen(true));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [isTeacher, remoteState]);

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
            onToggleTab={(t) => setActiveTab(v => v === t ? null : t)}
            activeTab={activeTab} 
            onToggleWhiteboard={() => setManualWhiteboardOpen(v => !v)}
            whiteboardOpen={whiteboardOpen}
            isTeacher={isTeacher}
            permissions={permissions}
            updatePermissions={updatePermissions}
          />
        </div>

        <aside className={`live-room__sidebar ${activeTab ? 'live-room__sidebar--open' : ''}`}>
          {isTeacher && <HandRaisePanel raisedHands={raisedHands} onAcknowledge={acknowledgeHand} />}
          {activeTab === "participants" && <ParticipantsPanel teacherName={activeSession?.teacher_name || "Teacher"} />}
          <div style={{ display: activeTab === "chat" ? "block" : "none", height: "100%" }}>
            <ChatPanel messages={messages} onSend={sendMessage} userId={userId} />
          </div>
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
  loadingAction?: boolean;
}> = ({ session, onAction, actionLabel, isActionDisabled, loadingAction }) => {
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
           {session.scheduled_at && <div className="meta-item"><Clock size={12} /> {new Date(session.scheduled_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</div>}
           <div className="meta-item"><Users size={12} /> {session.teacher_name}</div>
           {session.attendance_count !== undefined && <div className="meta-item"><Plus size={12} /> {session.attendance_count} JOINED</div>}
        </div>
      </div>
      <button 
        className={isLive ? "btn--primary" : "btn--ghost"} 
        disabled={isActionDisabled || loadingAction}
        onClick={() => onAction(session)}
        style={{ minWidth: '120px' }}
      >
        {loadingAction ? <div className="btn__spinner" style={{ width: 14, height: 14 }} /> : actionLabel.toUpperCase()}
      </button>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const LiveSessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  
  const isTeacher = ["TEACHER", "PRINCIPAL", "ADMIN"].includes(user?.role || "");
  const isAdminOrPrincipal = ["ADMIN", "PRINCIPAL"].includes(user?.role || "");
  const userName = user?.display_name || user?.username || "User";
  const userId = String(user?.id ?? "");

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveToken, setLiveToken] = useState<LiveToken | null>(null);
  const [inRoom, setInRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [newSection, setNewSection] = useState<number | "">("");
  const [newSubject, setNewSubject] = useState<number | "">("");
  const [creating, setCreating] = useState(false);

  // Management data
  const [assignments, setAssignments] = useState<{ section_id: number; section_name: string; class_name: string; subject_id: number; subject_name: string }[]>([]);
  const [allSections, setAllSections] = useState<SectionItem[]>([]);
  const [allSubjects, setAllSubjects] = useState<{ id: number; name: string }[]>([]);
  const [selectedSchool] = useState<number | "">("");

  useEffect(() => {
    const fetchFn = isTeacher ? listMySessions : getUpcomingSessions;
    fetchFn().then(setSessions).catch(() => setError("SIGNAL INTERFERENCE: Failed to synchronize sessions.")).finally(() => setLoading(false));
    
    if (isTeacher) {
      if (isAdminOrPrincipal) {
        apiGet<SectionItem[]>("/academics/sections/").then(setAllSections).catch(() => {});
        apiGet<{ id: number; name: string }[]>("/academics/subjects/").then(setAllSubjects).catch(() => {});
      } else {
        apiGet<typeof assignments>("/academics/my-assignments/").then(setAssignments).catch(() => {});
      }
    }
  }, [isTeacher, isAdminOrPrincipal]);

  useEffect(() => {
    if (sessionId && !inRoom && !authLoading) handleJoin(sessionId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, authLoading]);

  const handleJoin = useCallback(async (id: string) => {
    setError(null);
    try {
      if (!isTeacher) await joinSession(id);
      const token = await getSessionToken(id);
      setLiveToken(token);
      setInRoom(true);
      const currentSegments = location.pathname.split('/').filter(Boolean);
      if (currentSegments[currentSegments.length - 1] !== id) {
        navigate(`${location.pathname.endsWith('/') ? location.pathname.slice(0, -1) : location.pathname}/${id}`, { replace: true });
      }
    } catch (err: any) {
      let msg = "SIGNAL LOST: Channel unreachable.";
      const raw = err?.message?.toLowerCase() || "";
      if (raw.includes("ended")) msg = "SESSION TERMINATED: The orbital sync has concluded.";
      else if (raw.includes("not live")) msg = "ARENA COLD: Waiting for broadcasters to go live.";
      else if (raw.includes("forbidden") || raw.includes("403")) msg = "ACCESS DENIED: Credentials insufficient.";
      setError(msg);
      
      const fetchFn = isTeacher ? listMySessions : getUpcomingSessions;
      fetchFn().then(setSessions).catch(() => {});
    }
  }, [isTeacher, location.pathname, navigate]);

  const handleStart = useCallback(async (session: LiveSession) => {
    try {
      setStartingId(session.id);
      const updated = await startSession(session.id);
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
      await handleJoin(session.id);
    } catch { setError("SYSTEM ERROR: Sync initiation failed."); } finally { setStartingId(null); }
  }, [handleJoin]);

  const handleLeaveRoom = useCallback(() => {
    setInRoom(false); setLiveToken(null);
    const basePath = location.pathname.split('/').filter(Boolean).filter(p => p !== String(sessionId)).join('/');
    navigate(`/${basePath}`, { replace: true });
  }, [location.pathname, navigate, sessionId]);

  const handleEnd = useCallback(async (session: LiveSession) => {
    if (!window.confirm("CONFIRM TERMINATION: Conclude broadcaster sync?")) return;
    try {
      const updated = await endSession(session.id);
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
      handleLeaveRoom();
    } catch { setError("SYSTEM ERROR: Global broadcast termination failed."); }
  }, [handleLeaveRoom]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || !newSection) return;
    setCreating(true);
    try {
      const s = await createSession({ 
        title: newTitle.trim(), 
        description: newDesc.trim(), 
        section_id: Number(newSection), 
        subject_id: newSubject ? Number(newSubject) : undefined,
        scheduled_at: newScheduledAt || undefined
      });
      setSessions(prev => [s, ...prev]);
      setShowCreate(false);
      setNewTitle(""); setNewDesc(""); setNewSection(""); setNewSubject(""); setNewScheduledAt("");
    } catch {
       setError("ENCRYPTION ERROR: Provisioning failed.");
    } finally { setCreating(false); }
  }, [newTitle, newDesc, newSection, newSubject, newScheduledAt]);

  const uniqueSections = isAdminOrPrincipal
    ? allSections.filter(s => !selectedSchool || s.institution_id === Number(selectedSchool)).map(s => ({ id: s.id, name: s.short_label }))
    : [...new Map(assignments.map(a => [a.section_id, { id: a.section_id, name: `Class ${a.class_name} - ${a.section_name}` }])).values()];
  
  // Sort sections by class number descending (e.g. 12, 11, 10...)
  uniqueSections.sort((a, b) => {
    const numA = parseInt((a.name.match(/\d+/) || ["0"])[0], 10);
    const numB = parseInt((b.name.match(/\d+/) || ["0"])[0], 10);
    if (numA !== numB) return numB - numA;
    return a.name.localeCompare(b.name);
  });

  // View Calculation
  if (inRoom && liveToken) {
    const activeSession = sessions.find(s => s.status === "live") || sessions.find(s => s.id === sessionId);
    return (
      <LiveKitRoom 
        token={liveToken.token} 
        serverUrl={liveToken.livekit_url} 
        connect={true} 
        video={false} 
        audio={isTeacher}
        onDisconnected={handleLeaveRoom}
      >
        <RoomAudioRenderer />
        <InRoomView 
          isTeacher={isTeacher} 
          activeSession={activeSession} 
          onEnd={handleEnd}
          onLeave={handleLeaveRoom} 
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
            <div className="modal-header-nexus" style={{ marginBottom: 'var(--space-6)' }}>
              <div className="inst-label">SESSION ARCHITECT</div>
              <h3 className="modal-title" style={{ fontSize: '20px' }}>PROVISION NEW ARENA</h3>
            </div>
            <div className="joincode-form-grid">
               <div className="obsidian-form-group">
                  <label className="obsidian-label">TITLE VECTOR *</label>
                  <input className="obsidian-input" placeholder="e.g. Module 4 Synthesis" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
               </div>
               <div className="obsidian-form-group">
                  <label className="obsidian-label">MISSION OVERVIEW</label>
                  <input className="obsidian-input" placeholder="Optional description..." value={newDesc} onChange={e => setNewDesc(e.target.value)} />
               </div>
               <div className="obsidian-form-group">
                  <label className="obsidian-label">SCHEDULED IGNITION (LOCAL) *</label>
                  <input type="datetime-local" className="obsidian-input" value={newScheduledAt} onChange={e => setNewScheduledAt(e.target.value)} style={{ colorScheme: 'dark' }} />
               </div>
               <div className="obsidian-form-group">
                  <label className="obsidian-label">COHORT SECTION *</label>
                  <select className="obsidian-select" value={newSection} onChange={e => setNewSection(Number(e.target.value))}>
                    <option value="">Select section...</option>
                    {uniqueSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
               </div>
               <div className="obsidian-form-group">
                  <label className="obsidian-label">SUBJECT NODAL</label>
                  <select className="obsidian-select" value={newSubject} onChange={e => setNewSubject(Number(e.target.value))}>
                    <option value="">Optional link...</option>
                    {allSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
               </div>
            </div>
            <div className="mgmt-actions" style={{ gap: '12px', marginTop: 'var(--space-6)' }}>
              <button className="btn--primary" style={{ flex: 1 }} onClick={handleCreate} disabled={creating || !newTitle.trim() || !newSection}>
                 {creating ? "ENCRYPTING..." : "INITIALIZE BROADCAST"}
              </button>
              <button className="btn--secondary" onClick={() => setShowCreate(false)} disabled={creating}>CANCEL</button>
            </div>
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
                
                if (isTeacher) {
                  label = s.status === "scheduled" ? "INITIATE BROADCAST" : s.status === "live" ? "REJOIN ARENA" : "ARCHIVED";
                  const isStarting = startingId === s.id;
                  return (
                    <SessionCard 
                      key={s.id} session={s} actionLabel={isStarting ? "CONNECTING..." : label}
                      isActionDisabled={s.status === "ended" || isStarting} loadingAction={isStarting}
                      onAction={s.status === "ended" || isStarting ? () => {} : s.status === "scheduled" ? handleStart : (sess) => handleJoin(sess.id)}
                    />
                  );
                } else {
                  const isJoining = startingId === s.id;
                  const btnLabel = isJoining ? "JOINING..." : s.status === "live" ? "JOIN BROADCAST" : "SCHEDULED";
                  return (
                    <SessionCard 
                      key={s.id} session={s} actionLabel={btnLabel}
                      isActionDisabled={s.status !== "live" || isJoining} loadingAction={isJoining}
                      onAction={s.status === "live" && !isJoining ? async (sess) => { setStartingId(sess.id); try { await handleJoin(sess.id); } finally { setStartingId(null); } } : () => {}}
                    />
                  );
                }
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
