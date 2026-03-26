import React, { useEffect, useState, useCallback } from "react";
import { adminListRooms, adminGetRoomMessages, type ChatMessage, type ChatRoom } from "../services/chat";
import TopBar from "../components/TopBar";
import { 
  ShieldAlert, 
  History, 
  Search, 
  Trash2,
  Building2,
  Monitor,
  Activity
} from 'lucide-react';

type AdminRoom = ChatRoom & { message_count: number; institution_name: string | null };

const AdminChatManagementPage: React.FC = () => {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<AdminRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState("");

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

  const filteredRooms = rooms.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    (r.institution_name && r.institution_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page-shell">
      <TopBar title="Communication Governance" />
      <main className="page-content page-enter">
        
        <section className="editorial-header animate-fade-up">
           <div className="role-tag" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--role-teacher)', marginBottom: 'var(--space-4)' }}>
             ⚖️ Audit Mode
           </div>
           <h1 className="text-gradient" style={{ fontSize: 'clamp(32px, 8vw, 48px)', lineHeight: 1.1, marginBottom: 'var(--space-2)' }}>
             Communication<br/>
             Governance Audit.
           </h1>
           <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)', maxWidth: '500px' }}>
             Active monitoring of peer-to-peer data exchanges and institutional discourse.
           </p>

           <div style={{ display: 'flex', gap: 'var(--space-10)', marginTop: 'var(--space-10)' }}>
              <div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--role-teacher)', marginBottom: '4px' }}>
                    <Monitor size={14} />
                    <span style={{ fontSize: '10px', fontWeight: 800 }}>ACTIVE NODES</span>
                 </div>
                 <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900 }}>{rooms.length}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: 'var(--space-10)' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <Activity size={14} />
                    <span style={{ fontSize: '10px', fontWeight: 800 }}>AUDIT VELOCITY</span>
                 </div>
                 <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900 }}>{loading ? 'SYNCING...' : 'STABLE'}</div>
              </div>
           </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: selectedRoom ? '350px 1fr' : '1fr', gap: 'var(--space-6)', minHeight: '600px' }}>
          
          {/* Room Registry */}
          <div className="glass-card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column' }}>
            <div className="search-bar obsidian-search" style={{ marginBottom: 'var(--space-4)' }}>
              <Search size={16} />
              <input 
                placeholder="Search audit trail..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {filteredRooms.map(room => (
                <div 
                  key={room.id}
                  onClick={() => openRoom(room)}
                  className={`audit-room-item ${selectedRoom?.id === room.id ? 'active' : ''}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 800, fontSize: '13px' }}>{room.name}</div>
                    {room.message_count > 0 && (
                      <div className="msg-count">{room.message_count}</div>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building2 size={10} /> {room.institution_name || 'Global'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Viewer */}
          {selectedRoom ? (
            <div className="glass-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
               <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--role-teacher)' }}>SESSION AUDIT: {selectedRoom.id}</div>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>{selectedRoom.name}</div>
                  </div>
                  <button className="btn--ghost sm" onClick={() => setSelectedRoom(null)}>Close Audit</button>
               </div>
               
               <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', background: 'rgba(0,0,0,0.2)' }}>
                  {messages.map((m, i) => (
                    <div key={i} className="audit-msg">
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 900, fontSize: '10px', color: 'var(--brand-primary)' }}>
                            {m.sender_name.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{new Date(m.sent_at).toLocaleTimeString()}</span>
                       </div>
                       <div style={{ fontSize: '13px', lineHeight: 1.5 }}>{m.content}</div>
                    </div>
                  ))}
               </div>

               <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 'var(--space-4)' }}>
                  <button className="btn--ghost sm" style={{ color: 'var(--error)' }} onClick={() => { if(window.confirm("Archive this session?")) alert("Archived."); }}>
                    <Trash2 size={14} style={{ marginRight: '8px' }} /> Archive Session
                  </button>
                  <button className="btn--ghost sm" style={{ marginLeft: 'auto' }}>
                    <History size={14} style={{ marginRight: '8px' }} /> Full Log
                  </button>
               </div>
            </div>
          ) : (
            <div className="glass-card empty-audit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', flex: 1 }}>
               <div style={{ textAlign: 'center' }}>
                  <ShieldAlert size={48} style={{ opacity: 0.2, marginBottom: 'var(--space-4)' }} />
                  <p style={{ fontWeight: 800, fontSize: 'var(--text-sm)' }}>SELECT A SESSION TO BEGIN AUDIT</p>
               </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        .audit-room-item {
          padding: var(--space-4);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        .audit-room-item:hover {
          background: var(--glass-bg-hover);
        }
        .audit-room-item.active {
          background: var(--bg-elevated);
          border-color: var(--glass-border);
        }
        .msg-count {
          background: var(--role-teacher);
          color: white;
          font-size: 9px;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .audit-msg {
          background: var(--bg-surface);
          padding: var(--space-4);
          border-radius: 12px;
          border: 1px solid var(--glass-border);
          max-width: 80%;
          align-self: flex-start;
        }
        .obsidian-search input {
          background: transparent;
          border: none;
          color: white;
          width: 100%;
          padding: 8px;
          font-size: 13px;
        }
        .obsidian-search input:focus { outline: none; }
      `}</style>
    </div>
  );
};

export default AdminChatManagementPage;
