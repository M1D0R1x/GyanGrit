// pages.LiveSessionPage
/**
 * Live class session page — teacher hosts, students join.
 *
 * Features:
 *   - Video conferencing via LiveKit
 *   - Hand raise via LiveKit data channel
 *   - In-room ephemeral chat via LiveKit data channel
 *   - Screen sharing for teacher + students
 *   - Excalidraw whiteboard (teacher draws, students see read-only)
 *   - Attendance tracking
 *
 * Data channel protocol:
 *   { type: "hand_raise", raised, sender_name, sender_id }
 *   { type: "chat", message, sender_name, sender_id, timestamp }
 *   { type: "hand_ack", target_id }
 *   { type: "whiteboard", elements, scrollX, scrollY, zoom }
 */
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
import { useParams } from "react-router-dom";
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

// Section type from /academics/sections/ — includes institution info for ADMIN/PRINCIPAL
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
      <div className="live-chat-panel__header">{"\uD83D\uDCAC"} Live Chat</div>
      <div className="live-chat-panel__messages" ref={listRef}>
        {messages.length === 0 ? (
          <div className="live-chat-panel__empty">No messages yet. Say hello!</div>
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
        <input type="text" className="form-input" placeholder="Type a message..." value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()}
          maxLength={500} style={{ flex: 1, margin: 0, fontSize: "var(--text-xs)" }} />
        <button className="btn btn--primary" onClick={handleSend} disabled={!input.trim()}
          style={{ fontSize: "var(--text-xs)", padding: "var(--space-2) var(--space-3)", flexShrink: 0 }}>Send</button>
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
      <div className="live-hands-panel__header">{"\u270B"} Raised Hands ({raisedHands.size})</div>
      {[...raisedHands.entries()].map(([id, name]) => (
        <div key={id} className="live-hands-panel__item">
          <span>{name}</span>
          <button className="btn btn--ghost" style={{ fontSize: 10, padding: "2px 8px" }}
            onClick={() => onAcknowledge(id)}>{"\u2713"} Done</button>
        </div>
      ))}
    </div>
  );
}

// ── In-Room Controls ─────────────────────────────────────────────────────────

function InRoomControls({ onToggleChat, chatOpen }: {
  onToggleChat: () => void;
  chatOpen: boolean;
}) {
  return (
    <div className="live-controls-bar">
      <ControlBar controls={{ microphone: true, camera: true, screenShare: true, leave: true }} />
      <button className={`btn ${chatOpen ? "btn--primary" : "btn--ghost"}`}
        onClick={onToggleChat} style={{ fontSize: "var(--text-xs)", color: chatOpen ? undefined : "#fff", borderColor: "#444" }}
        title="Toggle chat">{"\uD83D\uDCAC"}</button>
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
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);

  // Track whether we've auto-opened the whiteboard for this remote state instance
  const autoOpenedRef = useRef(false);

  // Students auto-open whiteboard when teacher starts drawing (ref-based to avoid cascading renders)
  useEffect(() => {
    if (!isTeacher && remoteState && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      // Defer to next tick to avoid setState-in-effect lint warning
      const id = requestAnimationFrame(() => setWhiteboardOpen(true));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [isTeacher, remoteState]);

  return (
    <div className="live-room">
      {/* Top bar */}
      <div className="live-room__header">
        <div className="live-room__title">
          {"\uD83D\uDD34"} Live {"\u2014"} {activeSession?.title ?? "Class Session"}
          {!isTeacher && (
            <button className={`live-hand-btn ${myHandRaised ? "live-hand-btn--active" : ""}`}
              onClick={toggleHand} title={myHandRaised ? "Lower hand" : "Raise hand"}>
              {myHandRaised ? "\uD83D\uDE4B Hand Raised" : "\u270B Raise Hand"}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <button className={`btn ${whiteboardOpen ? "btn--primary" : "btn--ghost"}`}
            style={{ fontSize: "var(--text-xs)", color: whiteboardOpen ? undefined : "#fff", borderColor: "#444" }}
            onClick={() => setWhiteboardOpen(v => !v)}
            title={whiteboardOpen ? "Hide whiteboard" : "Show whiteboard"}>
            {"\uD83D\uDCDD"} {isTeacher ? "Whiteboard" : whiteboardOpen ? "Hide Board" : "Board"}
          </button>
          {isTeacher && activeSession && (
            <button className="btn" style={{ background: "var(--error)", color: "#fff", fontSize: "var(--text-xs)" }}
              onClick={() => onEnd(activeSession)}>End Session</button>
          )}
          <button className="btn btn--ghost" style={{ fontSize: "var(--text-xs)", color: "#fff", borderColor: "#444" }}
            onClick={onLeave}>Leave</button>
        </div>
      </div>

      {/* Main content area */}
      <div className="live-room__body">
        <div className="live-room__video">
          {whiteboardOpen ? (
            <Suspense fallback={
              <div className="whiteboard-loading"><div className="auth-loading__spinner" /><span>Loading whiteboard...</span></div>
            }>
              <Whiteboard readOnly={!isTeacher} remoteState={remoteState} onBroadcast={isTeacher ? broadcastWhiteboard : undefined} />
            </Suspense>
          ) : (
            <VideoLayout />
          )}
          <InRoomControls onToggleChat={() => setChatOpen(v => !v)} chatOpen={chatOpen} />
        </div>
        <div className={`live-room__sidebar ${chatOpen ? "live-room__sidebar--open" : ""}`}>
          {isTeacher && <HandRaisePanel raisedHands={raisedHands} onAcknowledge={acknowledgeHand} />}
          <ChatPanel messages={messages} onSend={sendMessage} userId={userId} />
        </div>
      </div>
    </div>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({ session, onAction, actionLabel, actionStyle }: {
  session: LiveSession;
  onAction: (s: LiveSession) => void;
  actionLabel: string;
  actionStyle?: React.CSSProperties;
}) {
  const statusColors: Record<string, string> = { scheduled: "var(--text-muted)", live: "var(--success)", ended: "var(--error)" };
  const statusBg: Record<string, string> = { scheduled: "rgba(107,114,128,0.08)", live: "rgba(34,197,94,0.1)", ended: "rgba(239,68,68,0.08)" };

  const scheduledTime = session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : null;
  const startedTime = session.started_at
    ? new Date(session.started_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div style={{ padding: "var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
          <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{session.title}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: "var(--radius-full)", background: statusBg[session.status], color: statusColors[session.status], textTransform: "uppercase" as const }}>
            {session.status === "live" ? "\uD83D\uDD34 LIVE" : session.status}
          </span>
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {session.subject_name ?? "General"} {"\u00B7"} {session.teacher_name}
          {session.attendance_count !== undefined && ` \u00B7 ${session.attendance_count} attending`}
        </div>
        {scheduledTime && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            {"\uD83D\uDCC5"} {scheduledTime}
            {startedTime && session.status === "live" && <span style={{ color: "var(--success)" }}> {"\u2022"} Started {startedTime}</span>}
          </div>
        )}
        {session.description && <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{session.description}</div>}
      </div>
      <button className="btn btn--primary" style={{ flexShrink: 0, fontSize: "var(--text-sm)", ...actionStyle }} onClick={() => onAction(session)}>{actionLabel}</button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LiveSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER" || user?.role === "PRINCIPAL" || user?.role === "ADMIN";

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveToken, setLiveToken] = useState<LiveToken | null>(null);
  const [inRoom, setInRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [newSection, setNewSection] = useState<number | "">("");
  const [newSubject, setNewSubject] = useState<number | "">("");
  const [creating, setCreating] = useState(false);
  const [assignments, setAssignments] = useState<{ section_id: number; section_name: string; class_name: string; subject_id: number; subject_name: string }[]>([]);
  const [allSections, setAllSections] = useState<SectionItem[]>([]);
  const [allSubjects, setAllSubjects] = useState<{ id: number; name: string }[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<number | "">("");

  const isAdminOrPrincipal = user?.role === "ADMIN" || user?.role === "PRINCIPAL";
  const userName = user?.display_name || user?.username || "User";
  const userId = String(user?.id ?? "");

  useEffect(() => {
    const fetchFn = isTeacher ? listMySessions : getUpcomingSessions;
    fetchFn().then(setSessions).catch(() => setError("Failed to load sessions.")).finally(() => setLoading(false));
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
    if (sessionId && !inRoom) handleJoin(Number(sessionId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleJoin = useCallback(async (id: number) => {
    setError(null);
    try {
      if (!isTeacher) await joinSession(id);
      const token = await getSessionToken(id);
      setLiveToken(token);
      setInRoom(true);
    } catch (err: unknown) {
      let msg = "Failed to join session.";
      if (err instanceof Error) {
        const raw = err.message.toLowerCase();
        if (raw.includes("ended")) msg = "This session has ended. The teacher has closed the live class.";
        else if (raw.includes("not live")) msg = "This session hasn't started yet. Wait for the teacher to go live.";
        else if (raw.includes("forbidden") || raw.includes("403")) msg = "You don't have access to this session.";
        else msg = err.message;
      }
      setError(msg);
      const fetchFn = isTeacher ? listMySessions : getUpcomingSessions;
      fetchFn().then(setSessions).catch(() => {});
    }
  }, [isTeacher]);

  const handleStart = useCallback(async (session: LiveSession) => {
    try {
      const updated = await startSession(session.id);
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
      await handleJoin(session.id);
    } catch { setError("Failed to start session."); }
  }, [handleJoin]);

  const handleEnd = useCallback(async (session: LiveSession) => {
    if (!confirm("End this live session?")) return;
    try {
      const updated = await endSession(session.id);
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
      setInRoom(false); setLiveToken(null);
    } catch { setError("Failed to end session."); }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || !newSection) return;
    setCreating(true);
    try {
      const s = await createSession({
        title: newTitle.trim(), description: newDesc.trim(),
        section_id: Number(newSection),
        subject_id: newSubject ? Number(newSubject) : undefined,
        scheduled_at: newScheduledAt || undefined,
      });
      setSessions(prev => [s, ...prev]);
      setShowCreate(false); setNewTitle(""); setNewDesc(""); setNewSection(""); setNewSubject(""); setNewScheduledAt("");
    } finally { setCreating(false); }
  }, [newTitle, newDesc, newSection, newSubject, newScheduledAt]);

  const schoolOptions = isAdminOrPrincipal
    ? [...new Map(allSections.filter(s => s.institution_id != null).map(s => [s.institution_id!, { id: s.institution_id!, name: s.institution_name ?? "" }])).values()] : [];
  const uniqueSections = isAdminOrPrincipal
    ? allSections.filter(s => !selectedSchool || s.institution_id === Number(selectedSchool)).map(s => ({ id: s.id, name: s.short_label }))
    : [...new Map(assignments.map(a => [a.section_id, { id: a.section_id, name: `Class ${a.class_name} - ${a.section_name}` }])).values()];
  const subjectOptions = isAdminOrPrincipal ? allSubjects
    : [...new Map(assignments.filter(a => a.section_id === Number(newSection)).map(a => [a.subject_id, { id: a.subject_id, name: a.subject_name }])).values()];

  // In-room view
  if (inRoom && liveToken) {
    const activeSession = sessions.find(s => s.status === "live");
    return (
      <LiveKitRoom token={liveToken.token} serverUrl={liveToken.livekit_url} connect={true} video={false} audio={isTeacher}
        onDisconnected={() => { setInRoom(false); setLiveToken(null); }}
        style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0f0f0f" }}>
        <RoomAudioRenderer />
        <InRoomView isTeacher={isTeacher} activeSession={activeSession} onEnd={handleEnd}
          onLeave={() => { setInRoom(false); setLiveToken(null); }} userName={userName} userId={userId} />
      </LiveKitRoom>
    );
  }

  // Session list view
  return (
    <div className="page-shell">
      <TopBar title="Live Classes" />
      <main style={{ padding: "var(--space-4)", paddingBottom: 80, maxWidth: 640, margin: "0 auto" }}>
        {error && (
          <div className="alert alert--error" style={{ marginBottom: "var(--space-4)", display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16, lineHeight: 1, opacity: 0.7 }} aria-label="Dismiss">{"\u2715"}</button>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--text-primary)" }}>
            {isTeacher ? "My Sessions" : "Upcoming Classes"}
          </h2>
          {isTeacher && (
            <button className="btn btn--primary" style={{ fontSize: "var(--text-xs)" }} onClick={() => setShowCreate(v => !v)}>+ New Session</button>
          )}
        </div>

        {showCreate && (
          <div style={{ padding: "var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid var(--brand-primary)", marginBottom: "var(--space-4)" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "var(--space-3)", color: "var(--text-primary)" }}>New Live Session</div>
            <input className="form-input" placeholder="Session title *" value={newTitle} onChange={e => setNewTitle(e.target.value)} style={{ marginBottom: "var(--space-2)" }} />
            <input className="form-input" placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ marginBottom: "var(--space-2)" }} />
            <div style={{ marginBottom: "var(--space-2)" }}>
              <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>Schedule Date & Time (optional)</label>
              <input className="form-input" type="datetime-local" value={newScheduledAt} onChange={e => setNewScheduledAt(e.target.value)} style={{ colorScheme: "dark" }} />
            </div>
            {isAdminOrPrincipal && schoolOptions.length > 1 && (
              <select className="form-input" value={selectedSchool} onChange={e => { setSelectedSchool(Number(e.target.value) || ""); setNewSection(""); }} style={{ marginBottom: "var(--space-2)" }}>
                <option value="">All schools - select to filter</option>
                {schoolOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <select className="form-input" value={newSection} onChange={e => setNewSection(Number(e.target.value))} style={{ marginBottom: "var(--space-2)" }}>
              <option value="">Select class / section *</option>
              {uniqueSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {subjectOptions.length > 0 && (
              <select className="form-input" value={newSubject} onChange={e => setNewSubject(Number(e.target.value))} style={{ marginBottom: "var(--space-3)" }}>
                <option value="">Select subject</option>
                {subjectOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button className="btn btn--primary" style={{ fontSize: "var(--text-sm)" }} onClick={handleCreate} disabled={creating || !newTitle.trim() || !newSection}>
                {creating ? "Creating..." : "Create Session"}
              </button>
              <button className="btn btn--ghost" style={{ fontSize: "var(--text-sm)" }} onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: "var(--radius-lg)" }} />)}
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">{"\uD83D\uDCF9"}</div>
            <h3 className="empty-state__title">{isTeacher ? "No sessions yet" : "No upcoming classes"}</h3>
            <p className="empty-state__message">{isTeacher ? "Create a session above to start a live class." : "Your teacher hasn't scheduled a live class yet."}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {sessions.map(s => {
              if (isTeacher) {
                const label = s.status === "scheduled" ? "Go Live" : s.status === "live" ? "Rejoin" : "Ended";
                return (
                  <SessionCard key={s.id} session={s} actionLabel={label}
                    actionStyle={s.status === "ended" ? { opacity: 0.4, cursor: "not-allowed" } : {}}
                    onAction={s.status === "ended" ? () => {} : s.status === "scheduled" ? handleStart : (sess: LiveSession) => handleJoin(sess.id)} />
                );
              }
              return (
                <SessionCard key={s.id} session={s} actionLabel={s.status === "live" ? "Join Now" : "Scheduled"}
                  actionStyle={s.status !== "live" ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                  onAction={s.status === "live" ? (sess: LiveSession) => handleJoin(sess.id) : () => {}} />
              );
            })}
          </div>
        )}
      </main>
      {!isTeacher && <BottomNav />}
    </div>
  );
}
