// pages.LiveSessionPage
/**
 * Live class session page — teacher hosts, students join.
 *
 * Fixes applied 2026-04-04:
 *   FIX1: Camera mirror — remote participants (teacher) no longer appear flipped for students.
 *         LiveKit CSS mirrors ALL tiles; we inject a style to un-mirror remote-only tiles.
 *   FIX2: Student auto-kick — InRoomView listens for RoomEvent.Disconnected (fired when
 *         teacher deletes the room via session_end) and calls onLeave automatically.
 *   FIX3: Whiteboard persistence — students no longer write to localStorage.
 *         Only the teacher persists whiteboard state. Students always receive from data channel.
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
  useParticipants,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  listMySessions, createSession, startSession, endSession,
  getUpcomingSessions, joinSession, getSessionToken,
  type LiveSession, type LiveToken,
} from "../services/livesessions";
import { apiGet } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import type { WhiteboardState } from "../components/Whiteboard";

const Whiteboard = lazy(() => import("../components/Whiteboard"));

// ── FIX 1: Inject CSS once to un-mirror remote participant cameras ────────────
// LiveKit applies `transform: scaleX(-1)` to ALL participant tiles via its
// default stylesheet. This is correct for your own local preview (mirrors like
// a selfie camera) but wrong for remote participants — the teacher appears
// flipped for students. We override remote-only tiles to not mirror.
if (typeof document !== "undefined" && !document.getElementById("gyangrit-unmirror")) {
  const s = document.createElement("style");
  s.id = "gyangrit-unmirror";
  // .lk-participant-tile contains a video element. LiveKit adds data-lk-local-participant
  // attribute only to the local tile. We target tiles WITHOUT that attribute (remote).
  s.textContent = `
    .lk-participant-tile:not([data-lk-local-participant="true"]) video {
      transform: none !important;
    }
  `;
  document.head.appendChild(s);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type HandRaiseMsg = { type: "hand_raise"; raised: boolean; sender_name: string; sender_id: string; };
type ChatMsg      = { type: "chat"; message: string; sender_name: string; sender_id: string; timestamp: number; };
type HandAckMsg   = { type: "hand_ack"; target_id: string; };
type PermMsg      = { type: "permissions"; mic: boolean; camera: boolean; };
type DataMsg      = HandRaiseMsg | ChatMsg | HandAckMsg | WhiteboardState | PermMsg;

type InRoomChat = { id: string; sender_name: string; sender_id: string; message: string; timestamp: number; };

type SectionItem = { id: number; short_label: string; institution_id?: number; institution_name?: string; };

// ── Video layout ──────────────────────────────────────────────────────────────

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

// ── Hand Raise Hook ───────────────────────────────────────────────────────────

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

// ── In-Room Chat Hook ─────────────────────────────────────────────────────────

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
            sender_id:   msg.sender_id,
            message:     msg.message,
            timestamp:   msg.timestamp,
          }]);
        }
      } catch { /* ignore */ }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  const sendMessage = useCallback((text: string) => {
    if (!room || !text.trim()) return;
    const msg: ChatMsg = {
      type: "chat", message: text.trim(),
      sender_name: userName, sender_id: userId, timestamp: Date.now(),
    };
    room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true });
    setMessages(prev => [...prev.slice(-99), {
      id: `${userId}-${msg.timestamp}`, sender_name: userName,
      sender_id: userId, message: msg.message, timestamp: msg.timestamp,
    }]);
  }, [room, userName, userId]);

  return { messages, sendMessage };
}

// ── Room Permissions Hook ─────────────────────────────────────────────────────

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
            if (!msg.mic)    room.localParticipant.setMicrophoneEnabled(false);
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

// ── Whiteboard Hook ───────────────────────────────────────────────────────────

function useWhiteboard(isTeacher: boolean, sessionId?: string) {
  const room = useRoomContext();

  // FIX 3: Only the teacher loads/saves whiteboard state from localStorage.
  // Students always receive fresh state from the data channel.
  const [remoteState, setRemoteState] = useState<WhiteboardState | null>(() => {
    if (!isTeacher || !sessionId) return null;
    const saved = localStorage.getItem(`gyangrit_wb_${sessionId}`);
    if (saved) {
      try { return JSON.parse(saved) as WhiteboardState; } catch { return null; }
    }
    return null;
  });

  // Track the most recent state in a ref so we can re-broadcast to late joiners
  const latestStateRef = useRef<WhiteboardState | null>(remoteState);

  useEffect(() => {
    if (!room) return;
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "whiteboard") {
          setRemoteState(msg as WhiteboardState);
          latestStateRef.current = msg as WhiteboardState;
        }
      } catch { /* ignore */ }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  // NEW: Teacher re-broadcasts current state when a new participant joins.
  // This ensures students who join mid-session immediately see the whiteboard.
  useEffect(() => {
    if (!room || !isTeacher) return;
    const handleParticipantConnected = () => {
      const current = latestStateRef.current;
      if (current) {
        // Small delay so the new participant's data channel subscription is ready
        setTimeout(() => {
          if (latestStateRef.current && room.localParticipant) {
            room.localParticipant.publishData(
              new TextEncoder().encode(JSON.stringify(latestStateRef.current)),
              { reliable: true }
            );
          }
        }, 800);
      }
    };
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    return () => { room.off(RoomEvent.ParticipantConnected, handleParticipantConnected); };
  }, [room, isTeacher]);

  const broadcastWhiteboard = useCallback((state: WhiteboardState) => {
    if (!room) return;
    // Only teacher persists to localStorage
    if (isTeacher && sessionId) {
      localStorage.setItem(`gyangrit_wb_${sessionId}`, JSON.stringify(state));
    }
    latestStateRef.current = state;
    setRemoteState(state);
    room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(state)), { reliable: true }
    );
  }, [room, isTeacher, sessionId]);

  return { remoteState, broadcastWhiteboard, latestStateRef };
}

// ── Chat Panel ────────────────────────────────────────────────────────────────

function ChatPanel({ messages, onSend, userId }: {
  messages: InRoomChat[]; onSend: (text: string) => void; userId: string;
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
        {messages.length === 0
          ? <div className="live-chat-panel__empty">No messages yet. Say hello!</div>
          : messages.map(m => (
            <div key={m.id} className={`live-chat-msg ${m.sender_id === userId ? "live-chat-msg--mine" : ""}`}>
              <span className="live-chat-msg__name">{m.sender_name}</span>
              <span className="live-chat-msg__text">{m.message}</span>
            </div>
          ))}
      </div>
      <div className="live-chat-panel__input">
        <input type="text" className="form-input" placeholder="Type a message..." value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()}
          maxLength={500} style={{ flex: 1, margin: 0, fontSize: "var(--text-xs)", color: "var(--text-primary)" }} />
        <button className="btn btn--primary" onClick={handleSend} disabled={!input.trim()}
          style={{ fontSize: "var(--text-xs)", padding: "var(--space-2) var(--space-3)", flexShrink: 0, color: "#fff" }}>
          Send
        </button>
      </div>
    </div>
  );
}

// ── Hand Raise Panel (Teacher) ────────────────────────────────────────────────

function HandRaisePanel({ raisedHands, onAcknowledge }: {
  raisedHands: Map<string, string>; onAcknowledge: (id: string) => void;
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

// ── Participants Panel ────────────────────────────────────────────────────────

function ParticipantsPanel({ teacherName }: { teacherName: string }) {
  const participants = useParticipants();
  const sorted = [...participants].sort((a, b) => {
    if (a.name === teacherName) return -1;
    if (b.name === teacherName) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });
  return (
    <div className="live-chat-panel">
      <div className="live-chat-panel__header">{"\uD83D\uDC65"} Participants ({participants.length})</div>
      <div className="live-chat-panel__messages" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", padding: "var(--space-3)" }}>
        {sorted.map(p => (
          <div key={p.identity} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--text-xs)" }}>
            <span style={{ fontWeight: p.name === teacherName ? 700 : 400, color: "var(--ink-primary)", display: "flex", alignItems: "center", gap: 6 }}>
              {p.name || "Unknown"} {p.isLocal && <span style={{ opacity: 0.5 }}>(You)</span>}
              {p.name === teacherName && "\uD83C\uDF93"}
            </span>
            <span style={{ display: "flex", gap: "var(--space-2)", opacity: 0.8 }}>
              {p.isMicrophoneEnabled ? "\uD83C\uDFA4" : "\uD83D\uDD07"}
              {p.isCameraEnabled ? "\uD83D\uDCF7" : ""}
              {p.isScreenShareEnabled ? "\uD83D\uDCBB" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Draggable PiP Camera Box (Zoom-style) ──────────────────────────────────────────
// Shows a draggable floating camera tile when the whiteboard is fullscreen.
// Teacher: shows their own camera. Students: shows the teacher's camera.

function PiPCamera() {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  // Local camera for teacher, or first available track (teacher's feed) for students
  const pipTrack = tracks.find(t => t.participant.isLocal) ?? tracks[0];

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging   = useRef(false);
  const dragOffset   = useRef({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 240, h: 135 }); // 16:9
  const [minimized, setMinimized] = useState(false);
  // track actual CSS left/top for dragging
  const posRef = useRef<{ left: number; top: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // switch to left/top for free dragging
    posRef.current = { left: rect.left, top: rect.top };
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.style.left = `${rect.left}px`;
    el.style.top  = `${rect.top}px`;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    isDragging.current = true;
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const el = containerRef.current;
      const newLeft = e.clientX - dragOffset.current.x;
      const newTop  = e.clientY - dragOffset.current.y;
      // Clamp within viewport
      const maxLeft = window.innerWidth  - el.offsetWidth;
      const maxTop  = window.innerHeight - el.offsetHeight;
      const left = Math.max(0, Math.min(newLeft, maxLeft));
      const top  = Math.max(0, Math.min(newTop,  maxTop));
      el.style.left = `${left}px`;
      el.style.top  = `${top}px`;
      posRef.current = { left, top };
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  // Corner resize
  const onResizeDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startW = size.w, startH = size.h;
    const onMove = (ev: MouseEvent) => {
      const dw = ev.clientX - startX;
      const dh = ev.clientY - startY;
      setSize({ w: Math.max(160, startW + dw), h: Math.max(90, startH + dh) });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [size]);

  if (!pipTrack) return null;

  return (
    <div
      ref={containerRef}
      className="wb-pip-container"
      style={{
        position: "fixed",
        right: 16, bottom: 80,
        width:  minimized ? 48 : size.w,
        height: minimized ? 48 : size.h,
        zIndex: 10001,
        borderRadius: minimized ? "50%" : "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
        border: "2px solid rgba(255,255,255,0.18)",
        cursor: "grab",
        transition: "width 0.18s ease, height 0.18s ease, border-radius 0.18s ease",
        userSelect: "none",
      }}
      onMouseDown={onMouseDown}
    >
      {/* Camera tile */}
      <div style={{ width: "100%", height: "100%", background: "#111" }}>
        {!minimized && (
          <ParticipantTile
            trackRef={pipTrack}
            style={{ width: "100%", height: "100%" }}
          />
        )}
        {minimized && (
          <div style={{ width: "100%", height: "100%", background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📹</div>
        )}
      </div>

      {/* Top control bar — appears on hover */}
      <div
        className="wb-pip-controls"
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "4px 6px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
          opacity: 0, transition: "opacity 0.15s",
          zIndex: 2,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}
      >
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>📹 Camera</span>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={() => setMinimized(v => !v)}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 4, color: "#fff", fontSize: 11, padding: "2px 6px", cursor: "pointer" }}
        >
          {minimized ? "⬜" : "➖"}
        </button>
      </div>

      {/* Resize handle (bottom-right corner) */}
      {!minimized && (
        <div
          onMouseDown={onResizeDown}
          style={{
            position: "absolute", bottom: 4, right: 4,
            width: 14, height: 14, cursor: "se-resize",
            background: "rgba(255,255,255,0.35)",
            borderRadius: "3px 0 3px 0",
            zIndex: 3,
          }}
        />
      )}
    </div>
  );
}

// ── In-Room Controls ──────────────────────────────────────────────────────────

function InRoomControls({ onToggleTab, activeTab, isTeacher, permissions, updatePermissions }: {
  onToggleTab: (tab: "chat" | "participants") => void;
  activeTab: "chat" | "participants" | null;
  isTeacher: boolean;
  permissions: { mic: boolean; camera: boolean };
  updatePermissions: (m: boolean, c: boolean) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  return (
    <div className="live-controls-bar">
      <ControlBar controls={{ microphone: isTeacher || permissions.mic, camera: isTeacher || permissions.camera, screenShare: true, leave: true }} />
      <div style={{ display: "flex", gap: "var(--space-2)", marginLeft: "var(--space-4)" }}>
        {isTeacher && (
          <div style={{ position: "relative" }}>
            <button className="btn btn--ghost" onClick={() => setShowSettings(v => !v)}
              style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)", borderColor: "var(--border-strong)" }}
              title="Room Settings">⚙️</button>
            {showSettings && (
              <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", background: "var(--bg-elevated)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)", padding: "var(--space-3)", marginBottom: "var(--space-2)", width: 220, zIndex: 50 }}>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: "var(--space-2)", color: "var(--ink-muted)" }}>Student Permissions</div>
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
        <button className={`btn ${activeTab === "participants" ? "btn--primary" : "btn--ghost"}`}
          onClick={() => onToggleTab("participants")}
          style={{ fontSize: "var(--text-xs)", color: activeTab === "participants" ? "#fff" : "var(--text-primary)", borderColor: "var(--border-strong)" }}
          title="Participants">{"\uD83D\uDC65"}</button>
        <button className={`btn ${activeTab === "chat" ? "btn--primary" : "btn--ghost"}`}
          onClick={() => onToggleTab("chat")}
          style={{ fontSize: "var(--text-xs)", color: activeTab === "chat" ? "#fff" : "var(--text-primary)", borderColor: "var(--border-strong)" }}
          title="Toggle chat">{"\uD83D\uDCAC"}</button>
      </div>
    </div>
  );
}

// ── In-Room View ──────────────────────────────────────────────────────────────

function InRoomView({ isTeacher, activeSession, onEnd, onLeave, userName, userId }: {
  isTeacher: boolean;
  activeSession: LiveSession | undefined;
  onEnd: (s: LiveSession) => void;
  onLeave: () => void;
  userName: string;
  userId: string;
}) {
  const room = useRoomContext();
  const { raisedHands, myHandRaised, toggleHand, acknowledgeHand } = useHandRaise(userName, userId);
  const { messages, sendMessage } = useInRoomChat(userName, userId);
  // FIX 3: pass isTeacher so students don't save to localStorage
  const { remoteState, broadcastWhiteboard } = useWhiteboard(isTeacher, activeSession?.id);
  const { permissions, updatePermissions } = useRoomPermissions(isTeacher);
  const [activeTab, setActiveTab]       = useState<"chat" | "participants" | null>(null);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  // ── Canvas screen-share for recording ─────────────────────────────────────
  // When teacher opens the whiteboard, capture the Excalidraw <canvas> as a
  // MediaStream and publish it to LiveKit as a screenshare track. This makes
  // Egress record the whiteboard content alongside the camera.
  const canvasStreamRef  = useRef<MediaStream | null>(null);
  const canvasTrackRef   = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    if (!isTeacher || !room) return;

    if (whiteboardOpen) {
      // Small delay to let Excalidraw render its canvas
      const timer = setTimeout(() => {
        try {
          // Find Excalidraw's canvas element inside the whiteboard container
          const canvas = document.querySelector<HTMLCanvasElement>(
            ".whiteboard-container canvas.excalidraw__canvas"
          ) ?? document.querySelector<HTMLCanvasElement>(".whiteboard-container canvas");
          if (!canvas) return;

          // captureStream is available on HTMLCanvasElement and needs no user prompt
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stream: MediaStream = (canvas as any).captureStream(15); // 15 fps
          const [videoTrack] = stream.getVideoTracks();
          if (!videoTrack) return;

          canvasStreamRef.current  = stream;
          canvasTrackRef.current   = videoTrack;

          room.localParticipant.publishTrack(videoTrack, {
            source: Track.Source.ScreenShare,
            name:   "whiteboard-canvas",
            simulcast: false,
          }).then(() => {
            console.info("[GyanGrit] Whiteboard canvas published as screenshare");
          }).catch((err: unknown) => {
            console.warn("[GyanGrit] Failed to publish canvas track:", err);
          });
        } catch (err) {
          console.warn("[GyanGrit] captureStream error:", err);
        }
      }, 1200); // wait for Excalidraw's canvas to mount
      return () => clearTimeout(timer);
    } else {
      // Whiteboard closed — unpublish the canvas track
      if (canvasTrackRef.current) {
        room.localParticipant.unpublishTrack(canvasTrackRef.current).catch(() => {});
        canvasTrackRef.current.stop();
        canvasTrackRef.current  = null;
        canvasStreamRef.current = null;
        console.info("[GyanGrit] Whiteboard canvas screenshare stopped");
      }
    }
    return undefined;
  }, [isTeacher, whiteboardOpen, room]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (canvasTrackRef.current) {
        canvasTrackRef.current.stop();
        canvasTrackRef.current  = null;
        canvasStreamRef.current = null;
      }
    };
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  // FIX 2: Listen for RoomEvent.Disconnected — fired when the LiveKit room is
  // deleted by the teacher (session_end calls _delete_livekit_room).
  // Without this, students stay frozen in the room UI after the teacher ends.
  useEffect(() => {
    if (!room) return;
    const handleDisconnected = () => { onLeave(); };
    room.on(RoomEvent.Disconnected, handleDisconnected);
    return () => { room.off(RoomEvent.Disconnected, handleDisconnected); };
  }, [room, onLeave]);

  // Students auto-open whiteboard when teacher starts drawing
  useEffect(() => {
    if (!isTeacher && remoteState && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      const id = requestAnimationFrame(() => setWhiteboardOpen(true));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [isTeacher, remoteState]);

  return (
    <div className="live-room">
      <div className="live-room__header">
        <div className="live-room__title">
          {"\uD83D\uDD34"} Live {"\u2014"} {activeSession?.title ?? "Class Session"}
          {activeSession?.id && (
            <span style={{ marginLeft: 8, fontSize: "0.75em", opacity: 0.7, fontFamily: "monospace", background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 4 }}>
              #{activeSession.id}
            </span>
          )}
          {!isTeacher && (
            <button className={`live-hand-btn ${myHandRaised ? "live-hand-btn--active" : ""}`}
              onClick={toggleHand} title={myHandRaised ? "Lower hand" : "Raise hand"}>
              {myHandRaised ? "\uD83D\uDE4B Hand Raised" : "\u270B Raise Hand"}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <button className={`btn ${whiteboardOpen ? "btn--primary" : "btn--ghost"}`}
            style={{ fontSize: "var(--text-xs)", color: whiteboardOpen ? "#fff" : "var(--text-primary)", borderColor: "var(--border-strong)" }}
            onClick={() => setWhiteboardOpen(v => !v)}>
            {"\uD83D\uDCDD"} {isTeacher ? "Whiteboard" : whiteboardOpen ? "Hide Board" : "Board"}
          </button>
          {isTeacher && whiteboardOpen && (
            <button className="btn btn--ghost"
              style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)", borderColor: "var(--border-strong)" }}
              onClick={() => broadcastWhiteboard({ type: "whiteboard", elements: [], clearAction: true, scrollX: 0, scrollY: 0, zoom: 1 })}>
              {"\uD83D\uDDD1\uFE0F"} Clear Board
            </button>
          )}
          {isTeacher && activeSession && (
            <button className="btn" style={{ background: "var(--error)", color: "#fff", fontSize: "var(--text-xs)" }}
              onClick={() => onEnd(activeSession)}>End Session</button>
          )}
          <button className="btn btn--ghost"
            style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)", borderColor: "var(--border-strong)" }}
            onClick={onLeave}>Leave</button>
        </div>
      </div>

      <div className="live-room__body">
        <div className="live-room__video" style={{ position: "relative" }}>
          {whiteboardOpen ? (
            <>
              {/* Whiteboard fills entire area */}
              <Suspense fallback={
                <div className="whiteboard-loading">
                  <div className="auth-loading__spinner" />
                  <span>Loading whiteboard...</span>
                </div>
              }>
                <Whiteboard
                  readOnly={!isTeacher}
                  remoteState={remoteState}
                  onBroadcast={isTeacher ? broadcastWhiteboard : undefined}
                />
              </Suspense>
              {/* PiP floating camera — Zoom-style */}
              <PiPCamera />
            </>
          ) : (
            <VideoLayout />
          )}
          <InRoomControls
            onToggleTab={(t) => setActiveTab(v => v === t ? null : t)}
            activeTab={activeTab}
            isTeacher={isTeacher}
            permissions={permissions}
            updatePermissions={updatePermissions}
          />
        </div>
        <div className={`live-room__sidebar ${activeTab ? "live-room__sidebar--open" : ""}`}>
          {isTeacher && <HandRaisePanel raisedHands={raisedHands} onAcknowledge={acknowledgeHand} />}
          {activeTab === "participants" && <ParticipantsPanel teacherName={activeSession?.teacher_name || "Teacher"} />}
          <div style={{ display: activeTab === "chat" ? "flex" : "none", flex: 1, minHeight: 0 }}>
            <ChatPanel messages={messages} onSend={sendMessage} userId={userId} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({ session, onAction, actionLabel, actionStyle, loadingAction }: {
  session: LiveSession;
  onAction: (s: LiveSession) => void;
  actionLabel: string;
  actionStyle?: React.CSSProperties;
  loadingAction?: boolean;
}) {
  const statusColors: Record<string, string> = { scheduled: "var(--ink-muted)", live: "var(--success)", ended: "var(--error)" };
  const statusBg: Record<string, string> = { scheduled: "rgba(107,114,128,0.08)", live: "rgba(34,197,94,0.1)", ended: "rgba(239,68,68,0.08)" };

  const scheduledTime = session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : null;
  const startedTime = session.started_at
    ? new Date(session.started_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div style={{ padding: "var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
          <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--ink-primary)" }}>{session.title}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: "var(--radius-full)", background: statusBg[session.status], color: statusColors[session.status], textTransform: "uppercase" as const }}>
            {session.status === "live" ? "\uD83D\uDD34 LIVE" : session.status}
          </span>
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
          {session.subject_name ?? "General"} {"\u00B7"} {session.teacher_name}
          {session.attendance_count !== undefined && ` \u00B7 ${session.attendance_count} attending`}
        </div>
        {scheduledTime && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>
            {"\uD83D\uDCC5"} {scheduledTime}
            {startedTime && session.status === "live" && <span style={{ color: "var(--success)" }}> {"\u2022"} Started {startedTime}</span>}
          </div>
        )}
        {session.description && <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>{session.description}</div>}
      </div>
      <button className="btn btn--primary"
        style={{ flexShrink: 0, fontSize: "var(--text-sm)", ...actionStyle }}
        onClick={() => onAction(session)}
        disabled={loadingAction}>
        {loadingAction
          ? <div className="auth-loading__spinner" style={{ width: 16, height: 16, borderTopColor: "#fff", borderRightColor: "rgba(255,255,255,0.2)", borderBottomColor: "rgba(255,255,255,0.2)", borderLeftColor: "rgba(255,255,255,0.2)" }} />
          : actionLabel}
      </button>
    </div>
  );
}

// ── Glassmorphic DateTime Picker ──────────────────────────────────────────────

function GlassDateTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen]    = useState(false);
  const [viewYear, setVY]  = useState(() => value ? new Date(value).getFullYear() : new Date().getFullYear());
  const [viewMonth, setVM] = useState(() => value ? new Date(value).getMonth() : new Date().getMonth());
  const [hour, setHour]    = useState(() => value ? String(new Date(value).getHours()).padStart(2, "0") : "09");
  const [minute, setMin]   = useState(() => value ? String(new Date(value).getMinutes()).padStart(2, "0") : "00");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const selectedDate = value ? new Date(value) : null;
  const isSelected = (d: number) => selectedDate?.getFullYear() === viewYear && selectedDate?.getMonth() === viewMonth && selectedDate?.getDate() === d;
  const isToday    = (d: number) => { const t = new Date(); return t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === d; };
  const isPastDay  = (d: number) => { const t = new Date(); t.setHours(0,0,0,0); return new Date(viewYear, viewMonth, d).getTime() < t.getTime(); };
  const commit = (d: number, h: string, m: string) => {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}T${h}:${m}`);
  };
  const pickDay  = (d: number) => { commit(d, hour, minute); };
  const applyTime = () => {
    if (!selectedDate) return;
    const chosen = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), parseInt(hour), parseInt(minute));
    // eslint-disable-next-line react-hooks/purity
    if (chosen.getTime() < Date.now()) { setOpen(false); return; } // past time — ignore silently
    commit(selectedDate.getDate(), hour, minute);
    setOpen(false);
  };
  const prevMonth = () => { if (viewMonth === 0) { setVM(11); setVY(y => y - 1); } else setVM(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setVM(0); setVY(y => y + 1); } else setVM(m => m + 1); };
  const displayValue = value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";
  const HOUR_OPTS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const MIN_OPTS  = ["00","05","10","15","20","25","30","35","40","45","50","55"];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ width: "100%", padding: "10px var(--space-4)", background: "var(--bg-sunken)", border: `1.5px solid ${open || value ? "var(--saffron)" : "var(--border-medium)"}`, borderRadius: "var(--radius-md)", color: value ? "var(--ink-primary)" : "var(--ink-muted)", fontSize: "var(--text-sm)", fontFamily: "var(--font-body)", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: open ? "0 0 0 3px rgba(245,158,11,0.15)" : "none", transition: "all var(--duration-press) var(--ease-out-strong)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--saffron)", flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {displayValue || "Pick date & time"}
        </span>
        {value
          ? <span onClick={e => { e.stopPropagation(); onChange(""); }} style={{ color: "var(--ink-muted)", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}>✕</span>
          : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}><polyline points="6 9 12 15 18 9"/></svg>
        }
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 300, background: "#FFFDF7", border: "1.5px solid rgba(245,158,11,0.35)", borderRadius: "var(--radius-xl)", boxShadow: "0 24px 64px rgba(26,18,8,0.22), 0 8px 24px rgba(26,18,8,0.1)", padding: "var(--space-5)", width: 300, animation: "scaleIn 0.16s var(--ease-out-strong) both", transformOrigin: "top left" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
            <button type="button" onClick={prevMonth} style={{ background: "rgba(245,158,11,0.12)", border: "none", borderRadius: "var(--radius-md)", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#92400e" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-sm)", color: "#1A1208" }}>{MONTHS[viewMonth]} {viewYear}</div>
            <button type="button" onClick={nextMonth} style={{ background: "rgba(245,158,11,0.12)", border: "none", borderRadius: "var(--radius-md)", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#92400e" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "var(--space-2)" }}>
            {DAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9B8E7E", textTransform: "uppercase", letterSpacing: "0.06em", padding: "var(--space-1) 0" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: "var(--space-4)" }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1; const sel = isSelected(d); const tod = isToday(d); const pst = isPastDay(d);
              return (
                <button key={d} type="button" onClick={() => !pst && pickDay(d)} style={{ width: "100%", aspectRatio: "1", border: "none", borderRadius: "var(--radius-md)", background: sel ? "#F59E0B" : tod ? "rgba(245,158,11,0.15)" : "transparent", color: sel ? "#fff" : tod ? "#92400e" : "#1A1208", fontFamily: "var(--font-display)", fontWeight: sel ? 800 : tod ? 700 : 500, fontSize: "var(--text-xs)", cursor: pst ? "not-allowed" : "pointer", opacity: pst ? 0.3 : 1, transition: "all var(--duration-press) var(--ease-out-strong)", boxShadow: sel ? "0 2px 8px rgba(245,158,11,0.4)" : "none" }}
                  onMouseEnter={e => { if (!sel && !pst) { e.currentTarget.style.background = "rgba(245,158,11,0.15)"; e.currentTarget.style.color = "#92400e"; } }}
                  onMouseLeave={e => { if (!sel && !pst) { e.currentTarget.style.background = tod ? "rgba(245,158,11,0.15)" : "transparent"; e.currentTarget.style.color = tod ? "#92400e" : "#1A1208"; } }}
                >{d}</button>
              );
            })}
          </div>
          <div style={{ borderTop: "1px solid rgba(245,158,11,0.2)", paddingTop: "var(--space-4)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-xs)", color: "#9B8E7E", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "var(--space-3)" }}>\uD83D\uDD50 Time</div>
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", marginBottom: "var(--space-4)" }}>
              <select value={hour} onChange={e => setHour(e.target.value)} style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", padding: "8px var(--space-2)", background: "#fff", color: "#1A1208", border: "1.5px solid rgba(245,158,11,0.4)", borderRadius: "var(--radius-md)", appearance: "none", cursor: "pointer" }}>
                {HOUR_OPTS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "#F59E0B", flexShrink: 0 }}>:</span>
              <select value={minute} onChange={e => setMin(e.target.value)} style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", padding: "8px var(--space-2)", background: "#fff", color: "#1A1208", border: "1.5px solid rgba(245,158,11,0.4)", borderRadius: "var(--radius-md)", appearance: "none", cursor: "pointer" }}>
                {MIN_OPTS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button type="button" onClick={() => { onChange(""); setOpen(false); }} style={{ flex: 1, padding: "var(--space-2) var(--space-3)", background: "transparent", border: "1.5px solid #D4C5B0", borderRadius: "var(--radius-md)", color: "#9B8E7E", fontSize: "var(--text-xs)", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 600 }}>Clear</button>
              <button type="button" onClick={applyTime} disabled={!selectedDate} style={{ flex: 2, padding: "var(--space-2) var(--space-3)", background: selectedDate ? "#F59E0B" : "#E8E0D5", border: "none", borderRadius: "var(--radius-md)", color: selectedDate ? "#fff" : "#9B8E7E", fontSize: "var(--text-xs)", cursor: selectedDate ? "pointer" : "not-allowed", fontFamily: "var(--font-display)", fontWeight: 700, boxShadow: selectedDate ? "0 2px 8px rgba(245,158,11,0.35)" : "none" }}>
                {selectedDate ? "\u2713 Confirm Time" : "Pick a date first"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LiveSessionPage() {
  const { sessionId }  = useParams<{ sessionId: string }>();
  const navigate       = useNavigate();
  const location       = useLocation();
  const { user, loading: authLoading } = useAuth();
  const isTeacher      = user?.role === "TEACHER" || user?.role === "PRINCIPAL" || user?.role === "ADMIN";

  const [sessions,    setSessions]    = useState<LiveSession[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [liveToken,   setLiveToken]   = useState<LiveToken | null>(null);
  const [inRoom,      setInRoom]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [startingId,  setStartingId]  = useState<string | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [newTitle,    setNewTitle]    = useState("");
  const [newDesc,     setNewDesc]     = useState("");
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [newSection,  setNewSection]  = useState<number | "">("");
  const [newSubject,  setNewSubject]  = useState<number | "">("");
  const [creating,    setCreating]    = useState(false);
  const [assignments, setAssignments] = useState<{ section_id: number; section_name: string; class_name: string; subject_id: number; subject_name: string }[]>([]);
  const [allSections, setAllSections] = useState<SectionItem[]>([]);
  const [allSubjects, setAllSubjects] = useState<{ id: number; name: string }[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<number | "">("");

  const isAdminOrPrincipal = user?.role === "ADMIN" || user?.role === "PRINCIPAL";
  const userName = user?.display_name || user?.username || "User";
  const userId   = String(user?.id ?? "");

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
      const segs = location.pathname.split("/").filter(Boolean);
      if (segs[segs.length - 1] !== id) {
        navigate(`${location.pathname.endsWith("/") ? location.pathname.slice(0, -1) : location.pathname}/${id}`, { replace: true });
      }
    } catch (err: unknown) {
      let msg = "Failed to join session.";
      if (err instanceof Error) {
        const raw = err.message.toLowerCase();
        if (raw.includes("ended"))                              msg = "This session has ended.";
        else if (raw.includes("not live"))                      msg = "This session hasn't started yet.";
        else if (raw.includes("forbidden") || raw.includes("403")) msg = "You don't have access to this session.";
        else msg = err.message;
      }
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
    } catch { setError("Failed to start session."); }
    finally   { setStartingId(null); }
  }, [handleJoin]);

  const handleLeaveRoom = useCallback(() => {
    setInRoom(false);
    setLiveToken(null);
    const basePath = location.pathname.split("/").filter(Boolean).filter(p => p !== String(sessionId)).join("/");
    navigate(`/${basePath}`, { replace: true });
  }, [location.pathname, navigate, sessionId]);

  const handleEnd = useCallback(async (session: LiveSession) => {
    if (!confirm("End this live session?")) return;
    try {
      const updated = await endSession(session.id);
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
      handleLeaveRoom();
    } catch { setError("Failed to end session."); }
  }, [handleLeaveRoom]);

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
      setShowCreate(false); setNewTitle(""); setNewDesc("");
      setNewSection(""); setNewSubject(""); setNewScheduledAt("");
    } finally { setCreating(false); }
  }, [newTitle, newDesc, newSection, newSubject, newScheduledAt]);

  const schoolOptions = isAdminOrPrincipal
    ? [...new Map(allSections.filter(s => s.institution_id != null).map(s => [s.institution_id!, { id: s.institution_id!, name: s.institution_name ?? "" }])).values()]
    : [];

  const uniqueSections = (isAdminOrPrincipal
    ? allSections.filter(s => !selectedSchool || s.institution_id === Number(selectedSchool)).map(s => ({ id: s.id, name: s.short_label }))
    : [...new Map(assignments.map(a => [a.section_id, { id: a.section_id, name: `Class ${a.class_name} - ${a.section_name}` }])).values()]
  ).sort((a, b) => {
    const numA = parseInt((a.name.match(/\d+/) || ["0"])[0], 10);
    const numB = parseInt((b.name.match(/\d+/) || ["0"])[0], 10);
    return numA !== numB ? numB - numA : a.name.localeCompare(b.name);
  });

  const subjectOptions = isAdminOrPrincipal
    ? allSubjects
    : [...new Map(assignments.filter(a => a.section_id === Number(newSection)).map(a => [a.subject_id, { id: a.subject_id, name: a.subject_name }])).values()];

  // In-room view
  if (inRoom && liveToken) {
    const activeSession = sessions.find(s => s.status === "live");
    const roomNode = (
      <LiveKitRoom
        token={liveToken.token}
        serverUrl={liveToken.livekit_url}
        connect={true}
        video={false}
        audio={isTeacher}
        onDisconnected={handleLeaveRoom}
        style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-canvas)", position: "fixed", top: 0, left: 0, zIndex: 99999 }}
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
    return createPortal(roomNode, document.body);
  }

  // Session list view
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
      {error && (
        <div className="alert alert--error" style={{ marginBottom: "var(--space-4)", display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16, lineHeight: 1, opacity: 0.7 }} aria-label="Dismiss">{"\u2715"}</button>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "var(--space-6)" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "var(--text-2xl)", color: "var(--ink-primary)", letterSpacing: "-0.03em", margin: 0 }}>
            {isTeacher ? "Live Classes" : "Upcoming Classes"}
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
            {isTeacher ? "Schedule, start, and manage your live sessions." : "Join your teacher's live class when it goes live."}
          </p>
        </div>
        {isTeacher && (
          <button className="btn btn--primary" style={{ flexShrink: 0 }} onClick={() => setShowCreate(v => !v)}>
            {showCreate ? "Cancel" : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Session
              </>
            )}
          </button>
        )}
      </div>

      {showCreate && (
        <div style={{ padding: "var(--space-6)", background: "var(--bg-surface)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-medium)", marginBottom: "var(--space-5)", boxShadow: "var(--shadow-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-5)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-base)", color: "var(--ink-primary)" }}>New Live Session</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>Fill in the details to schedule or start a class</div>
            </div>
            <button onClick={() => setShowCreate(false)} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "var(--radius-full)", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink-muted)", fontSize: 14 }}>✕</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Session title <span style={{ color: "var(--error)" }}>*</span></label>
              <input className="form-input" placeholder="e.g. Chapter 5 — Photosynthesis" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Description <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontWeight: 400 }}>(optional)</span></label>
              <input className="form-input" placeholder="What will you cover today?" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Schedule date & time <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontWeight: 400 }}>(optional)</span></label>
              <GlassDateTimePicker value={newScheduledAt} onChange={setNewScheduledAt} />
              {newScheduledAt && (
                <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--saffron)", fontWeight: 600, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span>\uD83D\uDCC5</span>
                  <span>{new Date(newScheduledAt).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}</span>
                </div>
              )}
            </div>
            {isAdminOrPrincipal && schoolOptions.length > 1 && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Filter by school</label>
                <select className="form-input" value={selectedSchool} onChange={e => { setSelectedSchool(Number(e.target.value) || ""); setNewSection(""); }}>
                  <option value="">All schools</option>
                  {schoolOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Class / section <span style={{ color: "var(--error)" }}>*</span></label>
              <select className="form-input" value={newSection} onChange={e => setNewSection(Number(e.target.value))}>
                <option value="">Select class / section</option>
                {uniqueSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {subjectOptions.length > 0 && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Subject</label>
                <select className="form-input" value={newSubject} onChange={e => setNewSubject(Number(e.target.value))}>
                  <option value="">Select subject</option>
                  {subjectOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-5)" }}>
            <button className="btn btn--primary" onClick={handleCreate} disabled={creating || !newTitle.trim() || !newSection}>
              {creating ? <><span className="btn__spinner" /> Creating…</> : "Create Session"}
            </button>
            <button className="btn btn--secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: "var(--radius-lg)" }} />)}
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
              const label      = s.status === "scheduled" ? "Go Live" : s.status === "live" ? "Rejoin" : "Ended";
              const isStarting = startingId === s.id;
              return (
                <SessionCard key={s.id} session={s} actionLabel={label}
                  actionStyle={s.status === "ended" || isStarting ? { opacity: 0.4, cursor: "not-allowed" } : {}}
                  loadingAction={isStarting}
                  onAction={s.status === "ended" || isStarting ? () => {} : s.status === "scheduled" ? handleStart : (sess: LiveSession) => handleJoin(sess.id)} />
              );
            }
            const isJoining = startingId === s.id;
            return (
              <SessionCard key={s.id} session={s}
                actionLabel={isJoining ? "Joining" : s.status === "live" ? "Join Now" : "Scheduled"}
                loadingAction={isJoining}
                actionStyle={s.status !== "live" || isJoining ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                onAction={s.status === "live" && !isJoining
                  ? async (sess: LiveSession) => { setStartingId(sess.id); try { await handleJoin(sess.id); } finally { setStartingId(null); } }
                  : () => {}} />
            );
          })}
        </div>
      )}
    </div>
  );
}
