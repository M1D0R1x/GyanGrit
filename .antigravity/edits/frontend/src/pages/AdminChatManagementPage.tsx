import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminListRooms, adminGetRoomMessages, type ChatRoom, type ChatMessage } from "../services/chat";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";

type Institution = { id: number; name: string };
type AdminRoom = ChatRoom & { message_count: number; institution_name: string | null };

const AdminChatManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<AdminRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    apiGet<Institution[]>("/academics/institutions/").then(setInstitutions);
  }, []);

  const loadRooms = useCallback(() => {
    setLoading(true);
    adminListRooms({}).then(rs => setRooms(rs as AdminRoom[])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const openRoom = async (room: AdminRoom) => {
    setSelectedRoom(room);
    const { messages } = await adminGetRoomMessages(room.id);
    setMessages(messages);
  };

  if (loading && !selectedRoom) return <div className="page-shell"><TopBar /><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="btn__spinner" /></main></div>;

  return (
    <div className="page-shell">
      <TopBar title="Chat Governance" />
      <main className="page-content page-enter has-bottom-nav" style={{ padding: 'var(--space-10) var(--space-6)', display: 'grid', gridTemplateColumns: selectedRoom ? '300px 1fr' : '1fr', gap: 'var(--space-10)' }}>
        
        {/* Overwatch Sidebar */}
        <section className="glass-card" style={{ padding: 'var(--space-6)', height: 'calc(100vh - 200px)', overflowY: 'auto' }}>
           <h2 style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-dim)', marginBottom: 'var(--space-4)', letterSpacing: '0.1em' }}>CHANNEL REGISTRY</h2>
           <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {rooms.map((r, i) => (
                <div key={i} onClick={() => openRoom(r)} style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', background: selectedRoom?.id === r.id ? 'var(--brand-primary)' : 'var(--bg-elevated)', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>
                   <div style={{ fontSize: '12px', fontWeight: 800, color: selectedRoom?.id === r.id ? '#000' : 'var(--text-primary)' }}>{r.name.toUpperCase()}</div>
                   <div style={{ fontSize: '9px', fontWeight: 700, color: selectedRoom?.id === r.id ? 'rgba(0,0,0,0.5)' : 'var(--text-dim)' }}>{r.institution_name?.toUpperCase() || "PLATFORM"} · {r.message_count} MSGS</div>
                </div>
              ))}
           </div>
        </section>

        {/* Governance Message Feed */}
        {selectedRoom ? (
          <section className="glass-card page-enter" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column' }}>
             <header style={{ marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--glass-border)', paddingBottom: 'var(--space-4)' }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 900 }}>{selectedRoom.name}</h2>
                <p style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700 }}>GOVERNANCE AUDIT IN PROGRESS · {selectedRoom.institution_name || "PLATFORM-WIDE"}</p>
             </header>

             <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {messages.map((m, i) => (
                   <div key={i} style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                         <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--brand-primary)' }}>{m.sender_name.toUpperCase()} ({m.sender_role})</span>
                         <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{new Date(m.sent_at).toLocaleTimeString()}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0 }}>{m.content}</p>
                   </div>
                ))}
             </div>
          </section>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '12px', fontWeight: 700 }}>
             SELECT A CHANNEL FROM THE REGISTRY TO START GOVERNANCE AUDIT
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  );
};

export default AdminChatManagementPage;
