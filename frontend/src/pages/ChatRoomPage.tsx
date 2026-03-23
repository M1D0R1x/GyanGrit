// pages.ChatRoomPage
/**
 * Class Chat Room — real-time messaging via Ably Chat SDK.
 *
 * Student  → sees their section's room, can send messages
 * Teacher  → sees all their section rooms, can pin messages
 * Principal/Admin → sees all institution rooms
 *
 * Real-time: Ably Chat SDK subscribes to chat:{section_id} channel.
 * Persistence: each message is saved to DB via POST /chat/rooms/<id>/message/
 * History: last 50 messages loaded from DB on mount.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import * as Ably from "ably";
import {
  listChatRooms,
  getChatHistory,
  saveChatMessage,
  pinMessage,
  type ChatRoom,
  type ChatMessage,
} from "../services/chat";
import { getAblyToken } from "../services/competitions";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

// ── Role colour helper ────────────────────────────────────────────────────

function roleBadgeStyle(role: string): React.CSSProperties {
  const map: Record<string, string> = {
    TEACHER:   "var(--role-teacher, #10b981)",
    PRINCIPAL: "var(--role-principal, #f59e0b)",
    OFFICIAL:  "var(--role-official, #8b5cf6)",
    ADMIN:     "var(--role-admin, #ef4444)",
    STUDENT:   "var(--role-student, #3b82f6)",
  };
  return {
    fontSize: 10, fontWeight: 700, padding: "1px 6px",
    borderRadius: "var(--radius-full)",
    background: `${map[role] ?? "#6b7280"}22`,
    color: map[role] ?? "#6b7280",
    border: `1px solid ${map[role] ?? "#6b7280"}44`,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  };
}

// ── Message bubble ────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isMe,
  canPin,
  onPin,
}: {
  msg:    ChatMessage;
  isMe:   boolean;
  canPin: boolean;
  onPin:  (id: number) => void;
}) {
  const [showActions, setShowActions] = useState(false);

  const time = new Date(msg.sent_at).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMe ? "flex-end" : "flex-start",
        marginBottom: "var(--space-3)",
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Sender name + role */}
      {!isMe && (
        <div style={{
          display: "flex", alignItems: "center", gap: "var(--space-2)",
          marginBottom: "var(--space-1)", paddingLeft: "var(--space-1)",
        }}>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>
            {msg.sender}
          </span>
          <span style={roleBadgeStyle(msg.sender_role)}>{msg.sender_role}</span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-2)", maxWidth: "75%" }}>
        {/* Pin action — shown on hover for teacher */}
        {canPin && showActions && (
          <button
            onClick={() => onPin(msg.id)}
            title={msg.is_pinned ? "Unpin" : "Pin message"}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 14, opacity: 0.6, padding: "var(--space-1)",
              order: isMe ? -1 : 1,
            }}
          >
            📌
          </button>
        )}

        {/* Bubble */}
        <div style={{
          padding: "var(--space-3) var(--space-4)",
          borderRadius: isMe
            ? "var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)"
            : "var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)",
          background: isMe ? "var(--brand-primary)" : "var(--bg-elevated)",
          color: isMe ? "#fff" : "var(--text-primary)",
          border: isMe ? "none" : "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-sm)",
          position: "relative" as const,
        }}>
          {msg.is_pinned && (
            <span style={{
              position: "absolute", top: -8, right: -8,
              fontSize: 12,
            }}>📌</span>
          )}
          <p style={{
            fontSize: "var(--text-sm)", lineHeight: 1.5,
            margin: 0, wordBreak: "break-word",
          }}>
            {msg.content}
          </p>
          <span style={{
            display: "block", fontSize: 10, marginTop: "var(--space-1)",
            color: isMe ? "rgba(255,255,255,0.65)" : "var(--text-muted)",
            textAlign: "right",
          }}>
            {time}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function ChatRoomPage() {
  const { roomId }  = useParams<{ roomId: string }>();
  const navigate    = useNavigate();
  const location    = useLocation();
  const { user }    = useAuth();

  const isTeacher   = user?.role === "TEACHER" || user?.role === "PRINCIPAL" || user?.role === "ADMIN";
  const prefix      = location.pathname.startsWith("/teacher") ? "/teacher"
    : location.pathname.startsWith("/principal") ? "/principal"
    : "/admin";

  // ── State ─────────────────────────────────────────────────────────────
  const [rooms,         setRooms]         = useState<ChatRoom[]>([]);
  const [activeRoom,    setActiveRoom]     = useState<ChatRoom | null>(null);
  const [messages,      setMessages]       = useState<ChatMessage[]>([]);
  const [loadingRooms,  setLoadingRooms]   = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [input,         setInput]          = useState("");
  const [sending,       setSending]        = useState(false);
  const [error,         setError]          = useState<string | null>(null);
  const [onlineCount,   setOnlineCount]    = useState<number>(0);

  // ── Refs ──────────────────────────────────────────────────────────────
  const ablyRef    = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const bottomRef  = useRef<HTMLDivElement | null>(null);
  const inputRef   = useRef<HTMLInputElement | null>(null);

  const numRoomId = roomId ? Number(roomId) : null;

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ── Load rooms list ───────────────────────────────────────────────────
  useEffect(() => {
    listChatRooms()
      .then((rs) => {
        setRooms(rs);
        // If roomId in URL, find matching room
        if (numRoomId) {
          const found = rs.find((r) => r.id === numRoomId);
          if (found) setActiveRoom(found);
        } else if (rs.length === 1) {
          // Auto-select single room (student has only one)
          setActiveRoom(rs[0]);
        }
      })
      .catch(() => setError("Failed to load chat rooms."))
      .finally(() => setLoadingRooms(false));
  }, [numRoomId]);

  // ── Load history when room selected ──────────────────────────────────
  useEffect(() => {
    if (!activeRoom) return;
    setLoadingHistory(true);
    setMessages([]);
    getChatHistory(activeRoom.id)
      .then((msgs) => {
        setMessages(msgs);
        setTimeout(scrollToBottom, 100);
      })
      .catch(() => setError("Failed to load message history."))
      .finally(() => setLoadingHistory(false));
  }, [activeRoom]);

  // ── Ably Chat subscription ────────────────────────────────────────────
  useEffect(() => {
    if (!activeRoom) return;

    let mounted = true;

    const connect = async () => {
      try {
        const tokenData = await getAblyToken(undefined);  // chat token (no room_id needed for teacher)
        if (!mounted) return;

        const client = new Ably.Realtime({
          token:    tokenData.token,
          clientId: tokenData.client_id,
        });
        ablyRef.current = client;

        const channelName = `[chat]${activeRoom.section_id}`;
        const channel     = client.channels.get(channelName);
        channelRef.current = channel;

        // Subscribe to new messages from other users
        channel.subscribe("message", (ablyMsg) => {
          if (!mounted) return;
          const data = ablyMsg.data as ChatMessage | undefined;
          if (!data) return;
          // Avoid duplicates — don't add if we already have this id (we add optimistically)
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [...prev, data];
          });
          setTimeout(scrollToBottom, 50);
        });

        // Subscribe to pin events
        channel.subscribe("pin", (ablyMsg) => {
          if (!mounted) return;
          const data = ablyMsg.data as { id: number; is_pinned: boolean } | undefined;
          if (!data) return;
          setMessages((prev) =>
            prev.map((m) => m.id === data.id ? { ...m, is_pinned: data.is_pinned } : m)
          );
        });

        // Presence — count online users
        channel.presence.subscribe(() => {
          channel.presence.get((_err, members) => {
            if (mounted) setOnlineCount(members?.length ?? 0);
          });
        });
        channel.presence.enter();

      } catch (err) {
        console.warn("[Chat] Ably not available — real-time disabled", err);
      }
    };

    void connect();

    return () => {
      mounted = false;
      channelRef.current?.presence.leave();
      channelRef.current?.unsubscribe();
      ablyRef.current?.close();
      ablyRef.current    = null;
      channelRef.current = null;
    };
  }, [activeRoom]);

  // ── Send message ──────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || !activeRoom || sending) return;

    setInput("");
    setSending(true);

    // Optimistic add
    const optimistic: ChatMessage = {
      id:          Date.now(),  // temporary id
      sender_id:   user?.id ?? 0,
      sender:      user?.display_name || user?.username || "You",
      sender_role: user?.role ?? "STUDENT",
      content,
      is_pinned:   false,
      sent_at:     new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollToBottom, 50);

    try {
      const saved = await saveChatMessage(activeRoom.id, content);

      // Replace optimistic with real
      setMessages((prev) =>
        prev.map((m) => m.id === optimistic.id ? saved : m)
      );

      // Publish via Ably so other users see it in real-time
      channelRef.current?.publish("message", saved);

    } catch {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError("Failed to send message. Try again.");
      setInput(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, activeRoom, sending, user]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // ── Pin message ───────────────────────────────────────────────────────
  const handlePin = async (messageId: number) => {
    if (!activeRoom) return;
    try {
      const res = await pinMessage(activeRoom.id, messageId);
      setMessages((prev) =>
        prev.map((m) => m.id === messageId ? { ...m, is_pinned: res.is_pinned } : m)
      );
      // Broadcast pin event via Ably
      channelRef.current?.publish("pin", { id: messageId, is_pinned: res.is_pinned });
    } catch {
      setError("Could not pin message.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────

  return (
    <div className="page-shell">
      <TopBar title="Class Chat" />

      <main style={{
        display: "flex",
        height: "calc(100vh - 56px)",  // subtract TopBar
        overflow: "hidden",
      }}>

        {/* ── Sidebar: room list (only shown for teacher with multiple rooms) ── */}
        {isTeacher && rooms.length > 1 && (
          <div style={{
            width: 200, flexShrink: 0,
            borderRight: "1px solid var(--border-subtle)",
            overflowY: "auto",
            background: "var(--bg-surface)",
          }}>
            <div style={{
              padding: "var(--space-4) var(--space-3)",
              fontSize: "var(--text-xs)", fontWeight: 700,
              color: "var(--text-muted)", textTransform: "uppercase",
              letterSpacing: "0.06em",
              borderBottom: "1px solid var(--border-subtle)",
            }}>
              Sections
            </div>
            {loadingRooms ? (
              <div style={{ padding: "var(--space-4)" }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 40, borderRadius: "var(--radius-md)", marginBottom: "var(--space-2)" }} />
                ))}
              </div>
            ) : (
              rooms.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActiveRoom(r)}
                  style={{
                    width: "100%", padding: "var(--space-3) var(--space-4)",
                    background: activeRoom?.id === r.id ? "rgba(59,130,246,0.1)" : "none",
                    border: "none",
                    borderLeft: activeRoom?.id === r.id ? "3px solid var(--brand-primary)" : "3px solid transparent",
                    textAlign: "left", cursor: "pointer",
                    display: "flex", flexDirection: "column", gap: 2,
                  }}
                >
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>
                    {r.section}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    Class {r.class_name}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Main chat area ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {!activeRoom ? (
            /* No room selected */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--space-8)" }}>
              {loadingRooms ? (
                <div className="skeleton" style={{ width: 200, height: 24, borderRadius: "var(--radius-sm)" }} />
              ) : rooms.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">💬</div>
                  <h3 className="empty-state__title">No chat rooms yet</h3>
                  <p className="empty-state__message">Chat rooms are created automatically for each section.</p>
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 48, marginBottom: "var(--space-4)" }}>💬</div>
                  <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Select a section to start chatting.</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Room header */}
              <div style={{
                padding: "var(--space-3) var(--space-4)",
                borderBottom: "1px solid var(--border-subtle)",
                background: "var(--bg-surface)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>
                    {activeRoom.section} {activeRoom.class_name ? `· Class ${activeRoom.class_name}` : ""}
                  </div>
                  {onlineCount > 0 && (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--success)", display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
                      {onlineCount} online
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="alert alert--error" style={{ margin: "var(--space-2) var(--space-4)", cursor: "pointer" }}
                  onClick={() => setError(null)}>
                  {error}
                </div>
              )}

              {/* Messages area */}
              <div style={{
                flex: 1, overflowY: "auto",
                padding: "var(--space-4)",
                display: "flex", flexDirection: "column",
              }}>
                {loadingHistory ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingTop: "var(--space-4)" }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="skeleton" style={{
                        height: 48, width: i % 2 === 0 ? "60%" : "45%",
                        borderRadius: "var(--radius-lg)",
                        alignSelf: i % 2 === 0 ? "flex-start" : "flex-end",
                      }} />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
                    <div style={{ fontSize: 40, marginBottom: "var(--space-3)" }}>👋</div>
                    <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>No messages yet. Say hello!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isMe={msg.sender_id === user?.id}
                      canPin={isTeacher}
                      onPin={handlePin}
                    />
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input area */}
              <div style={{
                padding: "var(--space-3) var(--space-4)",
                borderTop: "1px solid var(--border-subtle)",
                background: "var(--bg-surface)",
                display: "flex", gap: "var(--space-3)", alignItems: "flex-end",
              }}>
                <input
                  ref={inputRef}
                  className="form-input"
                  type="text"
                  placeholder="Type a message... (Enter to send)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending || !activeRoom.is_active}
                  style={{ flex: 1 }}
                  maxLength={2000}
                />
                <button
                  className="btn btn--primary"
                  onClick={() => void handleSend()}
                  disabled={sending || !input.trim() || !activeRoom.is_active}
                  style={{ flexShrink: 0, padding: "var(--space-3) var(--space-4)" }}
                >
                  {sending ? (
                    <span className="btn__spinner" aria-hidden="true" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* BottomNav only for students */}
      {user?.role === "STUDENT" && <BottomNav />}
    </div>
  );
}
