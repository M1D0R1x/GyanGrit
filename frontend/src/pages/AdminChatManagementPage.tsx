// pages.AdminChatManagementPage
/**
 * Admin-only chat room management.
 * Browse all rooms, filter by institution/type/search, view messages.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminListRooms, adminGetRoomMessages, type ChatRoom, type ChatMessage } from "../services/chat";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";

type Institution = { id: number; name: string };
type AdminRoom   = ChatRoom & { message_count: number; institution_name: string | null };

const ROOM_TYPE_COLORS: Record<string, string> = {
  subject:   "var(--brand-primary)",
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
    <div className="page-shell">
      <TopBar title="Chat Management" />
      <main style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden" }}>

        {/* ── Room list panel ── */}
        <div style={{ width: selectedRoom ? 320 : "100%", flexShrink: 0, borderRight: selectedRoom ? "1px solid var(--border-subtle)" : "none", overflowY: "auto", background: "var(--bg-surface)", display: "flex", flexDirection: "column" }}>

          <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
            <button className="back-btn" onClick={() => navigate(-1)} style={{ marginBottom: "var(--space-3)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Back
            </button>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", color: "var(--text-primary)", marginBottom: "var(--space-4)" }}>
              Chat Rooms <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", fontWeight: 500 }}>({rooms.length})</span>
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
                <div key={instName}>
                  <div style={{ padding: "var(--space-2) var(--space-3) var(--space-1)", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                    {instName}
                  </div>
                  {instRooms.map((r) => {
                    const color = ROOM_TYPE_COLORS[r.room_type] ?? "var(--text-muted)";
                    const isSelected = selectedRoom?.id === r.id;
                    return (
                      <button key={r.id} onClick={() => openRoom(r)} style={{
                        width: "100%", padding: "var(--space-3) var(--space-3)", background: isSelected ? "rgba(59,130,246,0.08)" : "none", border: "none",
                        borderLeft: isSelected ? `3px solid var(--brand-primary)` : "3px solid transparent",
                        textAlign: "left", cursor: "pointer", borderRadius: "var(--radius-sm)", marginBottom: 2,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {r.name}
                            </div>
                            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: 2 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase" }}>{ROOM_TYPE_LABELS[r.room_type]}</span>
                              <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{r.member_count ?? 0} members</span>
                              {(r.message_count ?? 0) > 0 && <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{r.message_count} msgs</span>}
                            </div>
                          </div>
                          {!r.is_active && <span style={{ fontSize: 9, color: "var(--error)", fontWeight: 700 }}>CLOSED</span>}
                        </div>
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
            <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{selectedRoom.name}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{selectedRoom.member_count} members · {selectedRoom.message_count} messages</div>
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
                    <div key={msg.id} style={{ padding: "var(--space-3) var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-2)", border: msg.is_pinned ? "1px solid rgba(245,158,11,0.3)" : "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          <RoleDot role={msg.sender_role} />
                          <span style={{ fontWeight: 700, fontSize: "var(--text-xs)", color: "var(--text-primary)" }}>{msg.sender_name}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase" }}>{msg.role_label}</span>
                          {msg.is_pinned && <span style={{ fontSize: 10 }}>📌</span>}
                          {msg.parent_id && <span style={{ fontSize: 9, color: "var(--text-muted)" }}>↩ reply</span>}
                        </div>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{time}</span>
                      </div>
                      {msg.content && <p style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", margin: 0, lineHeight: 1.5 }}>{msg.content}</p>}
                      {msg.attachment_url && (
                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "var(--text-xs)", color: "var(--brand-primary)", marginTop: "var(--space-1)", display: "block" }}>
                          📎 {msg.attachment_name ?? "Attachment"}
                        </a>
                      )}
                      {(msg.reply_count ?? 0) > 0 && (
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                          {msg.reply_count} {msg.reply_count === 1 ? "reply" : "replies"}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
