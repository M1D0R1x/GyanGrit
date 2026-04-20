// pages.ChatRoomPage
/**
 * Class Chat Room — school-scoped messaging.
 *
 * Room types: subject | staff | officials
 * Monitoring banner shown in all rooms.
 * Push notifications via Ably notifications:{user_id} channel.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { uploadFile } from "../services/media";
import * as Ably from "ably";
import {
  getChatHistory,
  getChatThread,
  listChatRooms,
  adminListRooms,
  pinMessage,
  saveChatMessage,
  type ChatMessage,
  type ChatRoom,
} from "../services/chat";
import { getAblyToken } from "../services/competitions";
import { useAuth } from "../auth/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────
type ThreadMessage = ChatMessage & { replies?: ChatMessage[] };

// ── Constants ─────────────────────────────────────────────────────────────
const ROOM_TYPE_LABELS: Record<string, string> = {
  subject:   "Subject",
  staff:     "Staff",
  officials: "Officials",
};

const ROOM_TYPE_COLORS: Record<string, string> = {
  subject:   "var(--saffron)",
  staff:     "var(--warning)",
  officials: "var(--role-official, #8b5cf6)",
};

// ── Helpers ───────────────────────────────────────────────────────────────
function RoomTypeBadge({ type }: { type: string }) {
  const color = ROOM_TYPE_COLORS[type] ?? "var(--ink-muted)";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "1px 8px",
      borderRadius: "var(--radius-full)",
      background: `${color}18`, color,
      border: `1px solid ${color}40`,
      textTransform: "uppercase" as const, letterSpacing: "0.05em",
    }}>
      {ROOM_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function SenderLabel({ msg, isMe }: { msg: ChatMessage; isMe: boolean }) {
  if (isMe) return null;
  const roleColors: Record<string, string> = {
    teacher:   "var(--role-teacher,   #10b981)",
    principal: "var(--role-principal, #f59e0b)",
    official:  "var(--role-official,  #8b5cf6)",
    moderator: "var(--role-admin,     #ef4444)",
    student:   "var(--role-student,   #3b82f6)",
  };
  const color = roleColors[msg.role_label] ?? "var(--ink-muted)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)", paddingLeft: 2 }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-xs)", color: "var(--ink-secondary)" }}>
        {msg.sender_name}
      </span>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "1px 6px",
        borderRadius: "var(--radius-full)",
        background: `${color}18`, color,
        border: `1px solid ${color}40`,
        textTransform: "uppercase" as const, letterSpacing: "0.04em",
      }}>
        {msg.role_label}
      </span>
    </div>
  );
}

function AttachmentPreview({ msg }: { msg: ChatMessage }) {
  if (!msg.attachment_url) return null;
  if (msg.attachment_type === "image") {
    return (
      <div style={{ marginTop: "var(--space-2)", maxWidth: 260 }}>
        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
          <img src={msg.attachment_url} alt={msg.attachment_name ?? "image"}
            style={{ width: "100%", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.2)", display: "block" }} />
        </a>
      </div>
    );
  }
  return (
    <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer"
      style={{
        display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
        marginTop: "var(--space-2)", padding: "var(--space-2) var(--space-3)",
        background: "rgba(0,0,0,0.12)", borderRadius: "var(--radius-md)",
        fontSize: "var(--text-xs)", fontWeight: 600, color: "inherit", textDecoration: "none",
      }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      {msg.attachment_name ?? "File"}
    </a>
  );
}

// ── Monitoring Banner ─────────────────────────────────────────────────────
function MonitoringBanner() {
  return (
    <div style={{
      padding: "var(--space-2) var(--space-4)",
      background: "rgba(245,158,11,0.08)",
      borderBottom: "1px solid rgba(245,158,11,0.2)",
      display: "flex", alignItems: "center", gap: "var(--space-2)",
      fontSize: "var(--text-xs)", color: "rgba(180,120,0,0.9)",
      flexShrink: 0,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      This chat is monitored by school administration. Be respectful and responsible.
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────
function MessageBubble({ msg, isMe, canPin, canReply, replyCount, onPin, onReplyClick, isReply = false }: {
  msg: ChatMessage; isMe: boolean; canPin: boolean; canReply: boolean;
  replyCount: number; onPin: (id: number) => void;
  onReplyClick: (msg: ChatMessage) => void; isReply?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const time = new Date(msg.sent_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", marginBottom: isReply ? "var(--space-2)" : "var(--space-4)", paddingLeft: isReply ? "var(--space-6)" : 0 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      <SenderLabel msg={msg} isMe={isMe} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", maxWidth: "85%", flexDirection: isMe ? "row-reverse" : "row" }}>
        <div style={{
          padding: "8px 10px 18px 10px", // space for absolute time at bottom
          borderRadius: isMe ? "12px 0 12px 12px" : "0 12px 12px 12px",
          background: isMe ? "var(--saffron)" : "var(--glass-fill)",
          color: isMe ? "#FFF" : "var(--ink-primary)",
          border: isMe ? "1px solid var(--saffron-dark)" : "1px solid var(--glass-stroke)",
          position: "relative" as const, maxWidth: "100%", minWidth: "80px",
          boxShadow: "0 1px 1px rgba(0,0,0,0.05)",
        }}>
          {msg.is_pinned && <span style={{ position: "absolute", top: -8, right: -6, fontSize: 12 }}>📌</span>}
          {msg.content && <p style={{ fontSize: "14px", lineHeight: 1.5, margin: 0, wordBreak: "break-word", whiteSpace: "pre-wrap", color: "inherit", paddingRight: "40px" }}>{msg.content}</p>}
          <AttachmentPreview msg={msg} />
          <span style={{ position: "absolute", right: 8, bottom: 4, fontSize: 10, color: isMe ? "rgba(255,255,255,0.8)" : "var(--ink-muted)", textAlign: "right" }}>{time}</span>
        </div>
        {hovered && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
            {canReply && !isReply && (
              <button onClick={() => onReplyClick(msg)} style={{ background: "var(--glass-fill)", border: "1px solid var(--glass-stroke)", borderRadius: "var(--radius-sm)", cursor: "pointer", padding: "2px 6px", fontSize: 11, color: "var(--ink-muted)", display: "flex", alignItems: "center", gap: 3 }}>↩ Reply</button>
            )}
            {canPin && (
              <button onClick={() => onPin(msg.id)} style={{ background: "var(--glass-fill)", border: "1px solid var(--glass-stroke)", borderRadius: "var(--radius-sm)", cursor: "pointer", padding: "2px 6px", fontSize: 11, color: "var(--ink-muted)" }}>
                {msg.is_pinned ? "📌 Unpin" : "📌 Pin"}
              </button>
            )}
          </div>
        )}
      </div>
      {!isReply && replyCount > 0 && (
        <button onClick={() => onReplyClick(msg)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--saffron)", fontWeight: 600, padding: "var(--space-1) 0", alignSelf: isMe ? "flex-end" : "flex-start" }}>
          {replyCount} {replyCount === 1 ? "reply" : "replies"} →
        </button>
      )}
    </div>
  );
}

// ── Thread panel ──────────────────────────────────────────────────────────
function ThreadPanel({ parentMsg, replies, onClose, onSendReply, myId, canPin, canReply, onPin }: {
  parentMsg: ChatMessage; replies: ChatMessage[]; onClose: () => void;
  onSendReply: (content: string) => Promise<void>;
  myId: number; canPin: boolean; canReply: boolean; onPin: (id: number) => void;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [replies.length]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    await onSendReply(content);
    setSending(false);
  };

  return (
    <div style={{ width: 320, flexShrink: 0, borderLeft: "1px solid var(--border-light)", display: "flex", flexDirection: "column", background: "var(--bg-surface)", height: "100%" }}>
      <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--glass-stroke)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--ink-primary)" }}>Thread</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--glass-stroke)", background: "var(--glass-fill)" }}>
        <MessageBubble msg={parentMsg} isMe={parentMsg.sender_id === myId} canPin={false} canReply={false} replyCount={0} onPin={() => {}} onReplyClick={() => {}} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4)" }}>
        {replies.length === 0
          ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)", fontStyle: "italic" }}>No replies yet.</p>
          : replies.map((r) => <MessageBubble key={r.id} msg={r} isMe={r.sender_id === myId} canPin={canPin} canReply={false} replyCount={0} onPin={onPin} onReplyClick={() => {}} isReply />)}
        <div ref={bottomRef} />
      </div>
      {canReply && (
        <div style={{ padding: "var(--space-3) var(--space-4)", borderTop: "1px solid var(--border-light)", display: "flex", gap: "var(--space-2)" }}>
          <input className="form-input" placeholder="Reply..." value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void handleSend())}
            disabled={sending} style={{ flex: 1, fontSize: "var(--text-sm)" }} />
          <button className="btn btn--primary" style={{ padding: "var(--space-2) var(--space-3)", flexShrink: 0 }}
            onClick={() => void handleSend()} disabled={sending || !input.trim()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Push notification toast ───────────────────────────────────────────────
type PushToast = { id: number; room_name: string; sender_name: string; preview: string; room_id: number };

function NotificationToast({ toast, onDismiss, onOpen }: { toast: PushToast; onDismiss: (id: number) => void; onOpen: (roomId: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <div style={{
      position: "fixed", bottom: "var(--space-6)", right: "var(--space-4)", zIndex: 999,
      background: "var(--glass-fill)", border: "1px solid var(--glass-stroke)", backdropFilter: "blur(12px)",
      borderRadius: "var(--radius-lg)", padding: "var(--space-3) var(--space-4)",
      boxShadow: "var(--shadow-lg)", maxWidth: 320,
      display: "flex", gap: "var(--space-3)", alignItems: "flex-start",
      animation: "fadeInUp 0.2s ease",
    }}>
      <div style={{ fontSize: 20, flexShrink: 0 }}>💬</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "var(--text-xs)", color: "var(--ink-primary)", marginBottom: 2 }}>{toast.room_name}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)", fontWeight: 600 }}>{toast.sender_name}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{toast.preview}</div>
      </div>
      <button onClick={() => { onOpen(toast.room_id); onDismiss(toast.id); }}
        style={{ background: "var(--saffron)", border: "none", borderRadius: "var(--radius-sm)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", cursor: "pointer", flexShrink: 0 }}>
        Open
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function ChatRoomPage() {
  const { roomId }  = useParams<{ roomId: string }>();
  const location    = useLocation();
  const { user }    = useAuth();

  const isTeacher     = user?.role === "TEACHER" || user?.role === "PRINCIPAL" || user?.role === "ADMIN";
  const isStudent     = user?.role === "STUDENT";
  const canShareFiles = user?.role === "TEACHER" || user?.role === "ADMIN" || user?.role === "PRINCIPAL";

  const [rooms,          setRooms]          = useState<(ChatRoom & { institution_name?: string | null })[]>([]);
  const [activeRoom,     setActiveRoom]     = useState<ChatRoom | null>(null);
  const [loadingRooms,   setLoadingRooms]   = useState(true);
  const [messages,       setMessages]       = useState<ThreadMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [threadParent,   setThreadParent]   = useState<ChatMessage | null>(null);
  const [threadReplies,  setThreadReplies]  = useState<ChatMessage[]>([]);
  const [loadingThread,  setLoadingThread]  = useState(false);
  const [input,          setInput]          = useState("");
  const [sending,        setSending]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [onlineCount,    setOnlineCount]    = useState(0);
  const [toasts,         setToasts]         = useState<PushToast[]>([]);

  const ablyRef      = useRef<Ably.Realtime | null>(null);
  const channelRef   = useRef<Ably.RealtimeChannel | null>(null);
  const notifRef     = useRef<Ably.RealtimeChannel | null>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const numRoomId = roomId ? Number(roomId) : null;
  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  // Dismiss toast
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Open room from notification
  const openRoomFromNotif = useCallback((rid: number) => {
    const found = rooms.find((r) => r.id === rid);
    if (found) setActiveRoom(found);
  }, [rooms]);

  // ── Load rooms ────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isAdmin = user?.role === "ADMIN";
    const loadRooms = isAdmin
      ? adminListRooms({ institution_id: params.get("institution_id") ?? undefined })
          .then(rs => {
            let filtered = rs.filter(r => r.room_type === "subject");
            // If admin has a specific registered section, only show those (like a student)
            if (user?.section_id) {
              filtered = filtered.filter(r => r.section_id === user.section_id);
            } else if (user?.institution_id) {
              // Otherwise at least filter by school if they have one
              filtered = filtered.filter(r => r.institution_id === user.institution_id);
            }
            return filtered;
          })
      : listChatRooms(params.get("institution_id") ?? undefined);
    loadRooms
      .then((rs) => {
        // Sort alphabetically by institution_name then by room name
        const sorted = [...rs].sort((a, b) => {
          const instA = ("institution_name" in a ? (a as { institution_name?: string | null }).institution_name : "") ?? "";
          const instB = ("institution_name" in b ? (b as { institution_name?: string | null }).institution_name : "") ?? "";
          if (instA !== instB) return instA.localeCompare(instB);
          return a.name.localeCompare(b.name);
        });
        setRooms(sorted);
        if (numRoomId) {
          const found = sorted.find((r) => r.id === numRoomId);
          if (found) setActiveRoom(found);
        } else if (sorted.length === 1) {
          setActiveRoom(sorted[0]);
        }
      })
      .catch(() => setError("Failed to load chat rooms."))
      .finally(() => setLoadingRooms(false));
  }, [numRoomId, location.search, user?.role, user?.section_id, user?.institution_id]);

  // ── Load history ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeRoom) return;
    setLoadingHistory(true);
    setMessages([]);
    setThreadParent(null);
    getChatHistory(activeRoom.id)
      .then((msgs) => {
        setMessages(msgs.map((m) => ({ ...m, replies: [] })));
        setTimeout(scrollToBottom, 100);
      })
      .catch(() => setError("Failed to load messages."))
      .finally(() => setLoadingHistory(false));
  }, [activeRoom]);

  // ── Ably: chat subscription + push notification channel ───────────────
  useEffect(() => {
    if (!activeRoom || !user) return;
    let mounted = true;

    const connect = async () => {
      try {
        const tokenData = await getAblyToken(undefined, "chat");
        if (!mounted) return;

        const client = new Ably.Realtime({ token: tokenData.token, clientId: tokenData.client_id });
        ablyRef.current = client;

        // Chat channel for active room
        const channel = client.channels.get(`chat:${activeRoom.id}`);
        channelRef.current = channel;

        channel.subscribe("message", (ablyMsg) => {
          if (!mounted) return;
          const data = ablyMsg.data as ThreadMessage | undefined;
          if (!data) return;
          if (!data.parent_id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev;
              return [...prev, { ...data, replies: [] }];
            });
            setTimeout(scrollToBottom, 50);
          } else {
            setMessages((prev) =>
              prev.map((m) => m.id === data.parent_id ? { ...m, reply_count: (m.reply_count ?? 0) + 1 } : m)
            );
            setThreadReplies((prev) => {
              if (prev.some((r) => r.id === data.id)) return prev;
              if (threadParent?.id === data.parent_id) return [...prev, data];
              return prev;
            });
          }
        });

        channel.subscribe("pin", (ablyMsg) => {
          if (!mounted) return;
          const data = ablyMsg.data as { id: number; is_pinned: boolean } | undefined;
          if (!data) return;
          setMessages((prev) => prev.map((m) => m.id === data.id ? { ...m, is_pinned: data.is_pinned } : m));
        });

        channel.presence.subscribe(() => {
          channel.presence.get()
            .then((members) => { if (mounted) setOnlineCount(members.length); })
            .catch(() => {});
        });
        channel.presence.enter().catch(() => {});

        // Push notification channel for this user
        const notifChannel = client.channels.get(`notifications:${user.id}`);
        notifRef.current = notifChannel;
        notifChannel.subscribe("chat_message", (msg) => {
          if (!mounted) return;
          const data = msg.data as { room_id: number; room_name: string; sender_name: string; preview: string } | undefined;
          if (!data || data.room_id === activeRoom.id) return; // don't toast for current room
          setToasts((prev) => [...prev.slice(-2), { id: Date.now(), ...data }]);
        });

      } catch {
        // Ably not available — silent fallback
      }
    };

    void connect();

    const poll = setInterval(() => {
      if (!mounted || !activeRoom || !navigator.onLine) return;
      getChatHistory(activeRoom.id)
        .then((msgs) => setMessages(msgs.map((m) => ({ ...m, replies: [] }))))
        .catch(() => {});
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(poll);
      channelRef.current?.presence.leave().catch(() => {});
      channelRef.current?.unsubscribe();
      notifRef.current?.unsubscribe();
      ablyRef.current?.close();
      ablyRef.current = null;
      channelRef.current = null;
      notifRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom, user?.id]);

  // ── Open thread ───────────────────────────────────────────────────────
  const openThread = useCallback(async (msg: ChatMessage) => {
    if (!activeRoom) return;
    setThreadParent(msg);
    setLoadingThread(true);
    try {
      const { replies } = await getChatThread(activeRoom.id, msg.id);
      setThreadReplies(replies);
    } catch {
      setError("Failed to load thread.");
    } finally {
      setLoadingThread(false);
    }
  }, [activeRoom]);

  // ── Send message ──────────────────────────────────────────────────────
  const handleSend = useCallback(async (content: string, parentId?: number, attachmentUrl?: string, attachmentType?: "image" | "file", attachmentName?: string) => {
    if ((!content.trim() && !attachmentUrl) || !activeRoom || sending) return;
    setSending(true);

    const optimisticId = -Date.now();
    const optimistic: ThreadMessage = {
      id:              optimisticId,
      sender_id:       user?.id ?? 0,
      sender_name:     user?.role === "ADMIN" ? "Chat Moderator"
        : `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || user?.username || "You",
      sender_role:     user?.role ?? "",
      role_label:      user?.role === "ADMIN" ? "moderator" : (user?.role?.toLowerCase() ?? ""),
      content: content.trim(),
      attachment_url: attachmentUrl ?? null, attachment_type: attachmentType ?? null, attachment_name: attachmentName ?? null,
      parent_id:  parentId ?? null,
      reply_count: 0, is_pinned: false,
      sent_at: new Date().toISOString(),
    };

    if (!parentId) {
      setMessages((prev) => [...prev, { ...optimistic, replies: [] }]);
      setTimeout(scrollToBottom, 50);
    } else {
      setThreadReplies((prev) => [...prev, optimistic]);
    }

    try {
      const saved = await saveChatMessage(activeRoom.id, content.trim(), parentId, attachmentUrl, attachmentType, attachmentName);
      if (!parentId) {
        setMessages((prev) => prev.map((m) => m.id === optimisticId ? { ...saved, replies: [] } : m));
        channelRef.current?.publish("message", saved);
      } else {
        setThreadReplies((prev) => prev.map((r) => r.id === optimisticId ? saved : r));
        setMessages((prev) => prev.map((m) => m.id === parentId ? { ...m, reply_count: (m.reply_count ?? 0) + 1 } : m));
        channelRef.current?.publish("message", { ...saved, parent_id: parentId });
      }
    } catch {
      if (!parentId) setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      else setThreadReplies((prev) => prev.filter((r) => r.id !== optimisticId));
      setError("Failed to send message.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [activeRoom, sending, user]);

  // ── Submit from input bar ─────────────────────────────────────────────
  const handleInputSend = useCallback(async () => {
    const content = input.trim();
    if (!content) return;
    setInput("");
    await handleSend(content);
  }, [input, handleSend]);

  // ── Pin message ───────────────────────────────────────────────────────
  const handlePin = useCallback(async (messageId: number) => {
    if (!activeRoom) return;
    try {
      const res = await pinMessage(activeRoom.id, messageId);
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, is_pinned: res.is_pinned } : m));
      channelRef.current?.publish("pin", { id: messageId, is_pinned: res.is_pinned });
    } catch {
      setError("Could not pin message.");
    }
  }, [activeRoom]);

  // ── Permissions ───────────────────────────────────────────────────────
  const canPostTopLevel = (() => {
    if (!activeRoom || !user) return false;
    if (user.role === "ADMIN") return true;
    const rt = activeRoom.room_type;
    if (rt === "staff")     return user.role === "TEACHER" || user.role === "PRINCIPAL";
    if (rt === "officials") return user.role === "OFFICIAL" || user.role === "PRINCIPAL";
    return user.role === "TEACHER" || user.role === "PRINCIPAL";
  })();

  const canReply = (() => {
    if (!activeRoom || !user) return false;
    if (user.role === "ADMIN") return true;
    if (user.role === "STUDENT") return activeRoom.room_type === "subject";
    return true;
  })();

  const canPin = isTeacher;
  // Show sidebar whenever there are multiple rooms — all roles need it
  const showSidebar = rooms.length > 1;

  // ─────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Push notification toasts */}
      {toasts.map((t) => (
        <NotificationToast key={t.id} toast={t} onDismiss={dismissToast} onOpen={openRoomFromNotif} />
      ))}

      <div style={{ display: "flex", height: "calc(100dvh - var(--topbar-height))", overflow: "hidden", margin: "calc(-1 * var(--space-8)) calc(-1 * var(--space-6))" }}>

        {/* ── Room sidebar ── */}
        {showSidebar && (
          <div style={{
            width: 280, flexShrink: 0,
            borderRight: "1px solid var(--glass-stroke)",
            overflowY: "auto",
            background: "var(--glass-fill)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "flex", flexDirection: "column",
          }}>
            {/* Sidebar header */}
            <div style={{
              padding: "var(--space-4) var(--space-5)",
              borderBottom: "1px solid var(--glass-stroke)",
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: "var(--space-3)",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, var(--brand-primary), var(--saffron))",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-sm)", color: "var(--ink-primary)", letterSpacing: "-0.02em" }}>
                  Chat Rooms
                </div>
                <div style={{ fontSize: 10, color: "var(--ink-muted)", fontWeight: 500 }}>
                  {rooms.length} room{rooms.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            {/* Room groups */}
            {(["officials", "staff", "subject"] as const).map((type) => {
              const group = rooms.filter((r) => r.room_type === type);
              if (!group.length) return null;
              const groupColor = ROOM_TYPE_COLORS[type] ?? "var(--ink-muted)";
              return (
                <div key={type} style={{ marginTop: "var(--space-3)" }}>
                  {/* Group label */}
                  <div style={{
                    padding: "var(--space-1) var(--space-5) var(--space-2)",
                    fontSize: 10, fontWeight: 800,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    color: groupColor,
                    display: "flex", alignItems: "center", gap: "var(--space-2)",
                  }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: groupColor, flexShrink: 0 }} />
                    {type === "subject" && user?.role === "ADMIN" ? "Class Chats" : ROOM_TYPE_LABELS[type]}
                  </div>

                  {/* Room items */}
                  {group.map((r) => {
                    const isActive = activeRoom?.id === r.id;
                    const accentColor = ROOM_TYPE_COLORS[r.room_type] ?? "var(--saffron)";
                    return (
                      <button key={r.id} onClick={() => setActiveRoom(r)} style={{
                        width: "100%",
                        padding: "var(--space-3) var(--space-5)",
                        background: isActive ? `${accentColor}12` : "transparent",
                        border: "none",
                        borderLeft: isActive ? `3px solid ${accentColor}` : "3px solid transparent",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "all 150ms ease",
                        display: "flex", alignItems: "center", gap: "var(--space-3)",
                      }}
                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)"; }}
                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                      >
                        {/* Room icon */}
                        <div style={{
                          width: 28, height: 28, borderRadius: "var(--radius-sm)",
                          background: isActive ? `${accentColor}20` : "var(--bg-elevated)",
                          border: `1px solid ${isActive ? `${accentColor}40` : "var(--border-light)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, transition: "all 150ms ease",
                          color: isActive ? accentColor : "var(--ink-muted)",
                          fontSize: 12,
                        }}>
                          {r.room_type === "officials" ? "🏛" : r.room_type === "staff" ? "👥" : "#"}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontSize: "var(--text-xs)",
                            fontWeight: isActive ? 700 : 500,
                            fontFamily: isActive ? "var(--font-display)" : "var(--font-body)",
                            color: isActive ? "var(--ink-primary)" : "var(--ink-secondary)",
                            display: "block",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            transition: "color 150ms ease",
                          }}>
                            {r.name}
                          </span>
                        </div>

                        {/* Active indicator dot */}
                        {isActive && (
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: accentColor, flexShrink: 0,
                            boxShadow: `0 0 6px ${accentColor}80`,
                          }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Main area ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!activeRoom ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--space-8)" }}>
              {loadingRooms ? (
                <div className="skeleton" style={{ width: 200, height: 24, borderRadius: "var(--radius-sm)" }} />
              ) : rooms.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">💬</div>
                  <h3 className="empty-state__title">No chat rooms yet</h3>
                  <p className="empty-state__message">Rooms are created when teachers are assigned to your section.</p>
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 48, marginBottom: "var(--space-4)" }}>💬</div>
                  <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Select a room to start chatting.</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

                {/* Room header */}
                <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--glass-stroke)", background: "var(--glass-fill)", display: "flex", alignItems: "center", gap: "var(--space-3)", flexShrink: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: 2 }}>
                      <RoomTypeBadge type={activeRoom.room_type} />
                      {onlineCount > 0 && (
                        <span style={{ fontSize: 10, color: "var(--success)", display: "flex", alignItems: "center", gap: 3 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
                          {onlineCount}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--ink-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {activeRoom.name}
                    </div>
                  </div>
                </div>

                {/* Monitoring banner */}
                <MonitoringBanner />

                {error && (
                  <div className="alert alert--error" style={{ margin: "var(--space-2) var(--space-4)", cursor: "pointer", flexShrink: 0 }} onClick={() => setError(null)}>
                    {error}
                  </div>
                )}

                {/* Student reply-only notice */}
                {isStudent && activeRoom.room_type === "subject" && (
                  <div style={{ padding: "var(--space-2) var(--space-4)", background: "rgba(59,130,246,0.06)", borderBottom: "1px solid var(--border-light)", fontSize: "var(--text-xs)", color: "var(--saffron)", flexShrink: 0 }}>
                    💬 You can reply to messages. Only teachers can start new threads.
                  </div>
                )}

                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4) var(--space-4) var(--space-2)" }}>
                  {loadingHistory ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="skeleton" style={{ height: 52, width: i % 2 === 0 ? "55%" : "45%", borderRadius: "var(--radius-lg)", alignSelf: i % 2 === 0 ? "flex-start" : "flex-end" }} />
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: "var(--space-16)", opacity: 0.5 }}>
                      <div style={{ fontSize: 36, marginBottom: "var(--space-3)" }}>👋</div>
                      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
                        {canPostTopLevel ? "Start the conversation." : "Waiting for a teacher to post."}
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <MessageBubble key={msg.id} msg={msg} isMe={msg.sender_id === user?.id}
                        canPin={canPin} canReply={canReply} replyCount={msg.reply_count ?? 0}
                        onPin={handlePin} onReplyClick={openThread} />
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input bar */}
                {(canPostTopLevel || canReply) && (
                  <div style={{ padding: "var(--space-3) var(--space-4)", borderTop: "1px solid var(--glass-stroke)", background: "var(--glass-fill)", flexShrink: 0 }}>
                    {!canPostTopLevel && canReply && (
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: "var(--space-2)" }}>
                        Tap "Reply" on a message to respond in a thread.
                      </div>
                    )}
                    {canPostTopLevel && (
                      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end" }}>
                        {canShareFiles && (
                          <>
                            <button className="btn btn--ghost" style={{ padding: "var(--space-2) var(--space-3)", flexShrink: 0 }}
                              onClick={() => fileInputRef.current?.click()} title="Attach file or image">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                              </svg>
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" style={{ display: "none" }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (!file) return;
                                if (file.size > 10 * 1024 * 1024) { setError("File too large (max 10MB)"); return; }
                                setError(null);
                                try {
                                  const result = await uploadFile(file, "uploads");
                                  const attachType = result.content_type.startsWith("image/") ? "image" : "file";
                                  await handleSend("", undefined, result.url, attachType, result.display_name);
                                } catch {
                                  setError("Upload failed. Please try again.");
                                }
                              }} />
                          </>
                        )}
                        <input ref={inputRef} className="form-input" type="text" placeholder="Type a message... (Enter to send)"
                          value={input} onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleInputSend(); } }}
                          disabled={sending || !activeRoom.is_active} style={{ flex: 1 }} maxLength={2000} />
                        <button className="btn btn--primary" style={{ padding: "var(--space-3) var(--space-4)", flexShrink: 0 }}
                          onClick={() => void handleInputSend()} disabled={sending || !input.trim() || !activeRoom.is_active}>
                          {sending ? <span className="btn__spinner" aria-hidden="true" /> : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Thread panel */}
              {threadParent && (
                <ThreadPanel
                  parentMsg={threadParent}
                  replies={loadingThread ? [] : threadReplies}
                  onClose={() => { setThreadParent(null); setThreadReplies([]); }}
                  onSendReply={(content) => handleSend(content, threadParent.id)}
                  myId={user?.id ?? 0} canPin={canPin} canReply={canReply} onPin={handlePin}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
