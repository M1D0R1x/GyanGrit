// pages.AdminChatManagementPage
/**
 * Admin-only chat room management.
 * Browse all rooms, filter by institution/type/search, view messages.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminListRooms, adminGetRoomMessages, type ChatRoom, type ChatMessage } from "../services/chat";
import { apiGet } from "../services/api";

type Institution = { id: number; name: string };
type AdminRoom   = ChatRoom & { message_count: number; institution_name: string | null };

const ROOM_TYPE_COLORS: Record<string, string> = {
  subject:   "var(--saffron)",
  staff:     "var(--warning)",
  officials: "var(--role-official, #8b5cf6)",
};

const ROOM_TYPE_LABELS: Record<string, string> = {
  subject:   "Subject",
  staff:     "Staff",
  officials: "Officials",
};

function RoleDot({ role }: { role: string }) {
  const colors: Record<string, string> = {
    TEACHER: "#10b981", PRINCIPAL: "#f59e0b",
    ADMIN: "#ef4444", STUDENT: "#3b82f6", OFFICIAL: "#8b5cf6",
  };
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors[role] ?? "#6b7280", display: "inline-block", flexShrink: 0 }} />;
}

export default function AdminChatManagementPage() {
  const navigate = useNavigate();

  const [institutions,  setInstitutions]  = useState<Institution[]>([]);
  const [rooms,         setRooms]         = useState<AdminRoom[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [selectedRoom,  setSelectedRoom]  = useState<AdminRoom | null>(null);
  const [roomMessages,  setRoomMessages]  = useState<ChatMessage[]>([]);
  const [loadingMsgs,   setLoadingMsgs]   = useState(false);

  // Filters
  const [instFilter,    setInstFilter]    = useState("");
  const [typeFilter,    setTypeFilter]    = useState("");
  const [search,        setSearch]        = useState("");

  useEffect(() => {
    apiGet<Institution[]>("/academics/institutions/")
      .then(setInstitutions)
      .catch(() => {});
  }, []);

  const loadRooms = useCallback(() => {
    setLoading(true);
    adminListRooms({
      institution_id: instFilter || undefined,
      room_type:      typeFilter || undefined,
      q:              search     || undefined,
    })
      .then((rs) => setRooms(rs as AdminRoom[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [instFilter, typeFilter, search]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const openRoom = async (room: AdminRoom) => {
    setSelectedRoom(room);
    setLoadingMsgs(true);
    try {
      const { messages } = await adminGetRoomMessages(room.id);
      setRoomMessages(messages);
    } catch {
      setRoomMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  };

  // Group rooms
  const grouped: Record<string, AdminRoom[]> = {};
  for (const r of rooms) {
    const key = r.institution_name ?? "Platform";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  return (
    <div style={{ display: "flex", height: "calc(100dvh - var(--topbar-height))", overflow: "hidden", margin: "calc(-1 * var(--space-8)) calc(-1 * var(--space-6))" }}>

        {/* ── Room list panel ── */}
        <div style={{ width: selectedRoom ? 320 : "100%", flexShrink: 0, borderRight: selectedRoom ? "1px solid var(--border-light)" : "none", overflowY: "auto", background: "var(--bg-surface)", display: "flex", flexDirection: "column" }}>

          <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border-light)", flexShrink: 0 }}>
            <button className="back-btn" onClick={() => navigate(-1)} style={{ marginBottom: "var(--space-3)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Back
            </button>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", color: "var(--ink-primary)", marginBottom: "var(--space-4)" }}>
              Chat Rooms <span style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", fontWeight: 500 }}>({rooms.length})</span>
            </h2>

            {/* Filters */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <input className="form-input" placeholder="Search rooms..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ fontSize: "var(--text-sm)" }} />
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <select className="form-input" value={instFilter} onChange={(e) => setInstFilter(e.target.value)} style={{ flex: 1, fontSize: "var(--text-xs)" }}>
                  <option value="">All institutions</option>
                  {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <select className="form-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ flex: 1, fontSize: "var(--text-xs)" }}>
                  <option value="">All types</option>
                  <option value="subject">Subject</option>
                  <option value="staff">Staff</option>
                  <option value="officials">Officials</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: "var(--radius-md)" }} />)}
            </div>
          ) : rooms.length === 0 ? (
            <div className="empty-state" style={{ padding: "var(--space-8)" }}>
              <div className="empty-state__icon">💬</div>
              <h3 className="empty-state__title">No rooms found</h3>
            </div>
          ) : (
            <div style={{ overflowY: "auto", flex: 1, padding: "var(--space-2)" }}>
              {Object.entries(grouped).sort().map(([instName, instRooms]) => (
                <div key={instName} style={{ marginBottom: "var(--space-3)" }}>
                  <div style={{
                    padding: "var(--space-2) var(--space-4) var(--space-1)",
                    fontSize: 10, fontWeight: 800,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    color: "var(--ink-muted)",
                    display: "flex", alignItems: "center", gap: "var(--space-2)",
                  }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--ink-muted)", flexShrink: 0 }} />
                    {instName}
                  </div>
                  {instRooms.map((r) => {
                    const color = ROOM_TYPE_COLORS[r.room_type] ?? "var(--ink-muted)";
                    const isSelected = selectedRoom?.id === r.id;
                    return (
                      <button key={r.id} onClick={() => openRoom(r)} style={{
                        width: "100%",
                        padding: "var(--space-3) var(--space-4)",
                        background: isSelected ? `${color}12` : "transparent",
                        border: "none",
                        borderLeft: isSelected ? `3px solid ${color}` : "3px solid transparent",
                        textAlign: "left", cursor: "pointer",
                        borderRadius: "var(--radius-sm)", marginBottom: 2,
                        display: "flex", alignItems: "center", gap: "var(--space-3)",
                        transition: "all 150ms ease",
                      }}
                        onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)"; }}
                        onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                      >
                        {/* Room icon */}
                        <div style={{
                          width: 28, height: 28, borderRadius: "var(--radius-sm)",
                          background: isSelected ? `${color}20` : "var(--bg-elevated)",
                          border: `1px solid ${isSelected ? `${color}40` : "var(--border-light)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, fontSize: 12,
                          color: isSelected ? color : "var(--ink-muted)",
                        }}>
                          {r.room_type === "officials" ? "\uD83C\uDFDB" : r.room_type === "staff" ? "\uD83D\uDC65" : "#"}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: "var(--text-xs)",
                            fontWeight: isSelected ? 700 : 500,
                            fontFamily: isSelected ? "var(--font-display)" : "var(--font-body)",
                            color: isSelected ? "var(--ink-primary)" : "var(--ink-secondary)",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {r.name}
                          </div>
                          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: 2, alignItems: "center" }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase" }}>{ROOM_TYPE_LABELS[r.room_type]}</span>
                            <span style={{ fontSize: 9, color: "var(--ink-muted)" }}>{r.member_count ?? 0} members</span>
                            {(r.message_count ?? 0) > 0 && <span style={{ fontSize: 9, color: "var(--ink-muted)" }}>{r.message_count} msgs</span>}
                          </div>
                        </div>

                        {!r.is_active && <span style={{ fontSize: 9, color: "var(--error)", fontWeight: 700, flexShrink: 0 }}>CLOSED</span>}
                        {isSelected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}80` }} />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Message viewer panel ── */}
        {selectedRoom && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-light)", background: "var(--bg-surface)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--ink-primary)" }}>{selectedRoom.name}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{selectedRoom.member_count} members · {selectedRoom.message_count} messages</div>
              </div>
              <button className="btn btn--ghost" style={{ fontSize: "var(--text-xs)" }} onClick={() => setSelectedRoom(null)}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4)" }}>
              {loadingMsgs ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: "var(--radius-md)" }} />)}
                </div>
              ) : roomMessages.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">💬</div>
                  <h3 className="empty-state__title">No messages yet</h3>
                </div>
              ) : (
                roomMessages.map((msg) => {
                  const roleColors: Record<string, string> = { TEACHER: "#10b981", PRINCIPAL: "#f59e0b", ADMIN: "#ef4444", STUDENT: "#3b82f6", OFFICIAL: "#8b5cf6" };
                  const color = roleColors[msg.sender_role] ?? "#6b7280";
                  const time = new Date(msg.sent_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
                  return (
                    <div key={msg.id} style={{
                      padding: "8px 10px 18px 10px",
                      background: "#FFFFFF",
                      borderRadius: "0 12px 12px 12px",
                      marginBottom: "var(--space-4)",
                      border: msg.is_pinned ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(0,0,0,0.05)",
                      position: "relative",
                      maxWidth: "85%",
                      minWidth: "120px",
                      boxShadow: "0 1px 1px rgba(0,0,0,0.05)",
                     }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-1)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          <RoleDot role={msg.sender_role} />
                          <span style={{ fontWeight: 700, fontSize: "var(--text-xs)", color: "var(--ink-primary)" }}>{msg.sender_name}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase" }}>{msg.role_label}</span>
                          {msg.is_pinned && <span style={{ fontSize: 10 }}>📌</span>}
                          {msg.parent_id && <span style={{ fontSize: 9, color: "var(--ink-muted)" }}>↩ reply</span>}
                        </div>
                      </div>
                      {msg.content && <p style={{ fontSize: "14px", color: "var(--ink-primary)", margin: 0, lineHeight: 1.5, paddingRight: 50, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{msg.content}</p>}
                      {msg.attachment_url && (
                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "var(--text-xs)", color: "var(--saffron)", marginTop: "var(--space-1)", display: "block" }}>
                          📎 {msg.attachment_name ?? "Attachment"}
                        </a>
                      )}
                      {(msg.reply_count ?? 0) > 0 && (
                        <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
                          {msg.reply_count} {msg.reply_count === 1 ? "reply" : "replies"}
                        </div>
                      )}
                      <span style={{ position: "absolute", right: 8, bottom: 4, display: "inline-block", fontSize: 10, color: "var(--ink-muted)", textAlign: "right" }}>{time}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
    </div>
  );
}
