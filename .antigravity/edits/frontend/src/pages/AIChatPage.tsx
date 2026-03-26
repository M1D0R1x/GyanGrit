import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  listConversations, getConversation, sendMessage, deleteConversation,
  type Conversation, type AIMessage, type ConversationDetail,
} from "../services/aiAssistant";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { 
  Send, 
  Plus, 
  Trash2, 
  Bot, 
  User, 
  Sparkles, 
  History, 
  MessageSquare,
  ChevronRight,
  Menu,
  X,
  Clock
} from 'lucide-react';

type Subject = { id: number; name: string };

const MsgBubble: React.FC<{ msg: AIMessage }> = ({ msg }) => {
  const isUser = msg.role === "user";
  return (
    <div className="message-container animate-fade-up" style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 'var(--space-6)', width: '100%' }}>
      {!isUser && (
        <div className="ai-avatar pulse-soft" style={{ 
          width: 32, height: 32, borderRadius: '10px', 
          background: 'linear-gradient(135deg, var(--brand-primary), #a855f7)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          marginRight: 'var(--space-3)', flexShrink: 0, boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
        }}>
          <Sparkles size={16} color="white" />
        </div>
      )}
      <div className={`glass-card chat-bubble ${isUser ? 'user' : 'ai'}`} style={{ 
        maxWidth: '80%', 
        padding: 'var(--space-4) var(--space-5)', 
        background: isUser ? 'var(--brand-primary)' : 'var(--bg-elevated)',
        border: isUser ? 'none' : '1px solid var(--glass-border)',
        borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
        color: isUser ? 'white' : 'var(--text-primary)',
        boxShadow: isUser ? '0 8px 16px rgba(59,130,246,0.15)' : 'none'
      }}>
        <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
        <div style={{ fontSize: '9px', opacity: 0.6, marginTop: '8px', textAlign: isUser ? 'right' : 'left', fontWeight: 600 }}>
          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      {isUser && (
        <div className="user-avatar" style={{ 
          width: 32, height: 32, borderRadius: '10px', 
          background: 'var(--bg-elevated)', 
          border: '1px solid var(--glass-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          marginLeft: 'var(--space-3)', flexShrink: 0
        }}>
          <User size={16} color="var(--text-muted)" />
        </div>
      )}
    </div>
  );
};

const ThinkingBubble: React.FC = () => (
  <div className="message-container animate-fade-up" style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
    <div className="ai-avatar pulse-soft" style={{ 
      width: 32, height: 32, borderRadius: '10px', 
      background: 'linear-gradient(135deg, var(--brand-primary), #a855f7)', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      flexShrink: 0
    }}>
      <Sparkles size={16} color="white" />
    </div>
    <div className="glass-card" style={{ padding: '12px 20px', borderRadius: '20px 20px 20px 4px', border: '1px solid var(--glass-border)' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="thinking-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand-primary)', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  </div>
);

const AIChatPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationDetail | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [selectedSubj, setSelectedSubj] = useState<number | "">("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshHistory();
    apiGet<Subject[]>("/academics/subjects/").then(setSubjects);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages.length, thinking]);

  const refreshHistory = async () => {
    const list = await listConversations();
    setConversations(list);
  };

  const openConversation = async (id: number) => {
    const detail = await getConversation(id);
    setActiveConv(detail);
    setSidebarOpen(false);
  };

  const startNewConversation = () => {
    setActiveConv({ id: 0, subject_id: selectedSubj || null, subject_name: subjects.find(s => s.id === Number(selectedSubj))?.name ?? "General", messages: [] });
    setSidebarOpen(false);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Purge this sequence from intelligence nodes?")) return;
    await deleteConversation(id);
    if (activeConv?.id === id) setActiveConv(null);
    refreshHistory();
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || thinking) return;
    setInput("");
    setThinking(true);

    const tempMsg: AIMessage = { id: Date.now(), role: "user", content, created_at: new Date().toISOString() };
    setActiveConv(prev => prev ? { ...prev, messages: [...prev.messages, tempMsg] } : prev);

    try {
      const res = await sendMessage({ 
        message: content, 
        conversation_id: activeConv?.id || undefined, 
        subject_id: activeConv?.subject_id || (selectedSubj ? Number(selectedSubj) : undefined) 
      });
      setActiveConv(prev => {
        if (!prev) return null;
        const msgs = prev.messages.filter(m => m.id !== tempMsg.id);
        return { ...prev, id: res.conversation_id, messages: [...msgs, tempMsg, res.message] };
      });
      if (!activeConv?.id) refreshHistory();
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="page-shell">
      <TopBar title="AI Study Assistant" />
      <main className="ai-chamber" style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', position: 'relative' }}>
        
        {/* Toggle Sidebar (Mobile) */}
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)}>
           <Menu size={20} />
        </button>

        {/* Intelligence Rail (Sidebar) */}
        <section className={`intelligence-rail ${sidebarOpen ? 'open' : ''}`}>
           <div className="rail-header">
              <button className="btn--primary new-chat-btn" onClick={startNewConversation}>
                <Plus size={16} /> New Inquiry
              </button>
              <button className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
           </div>
           
           <div className="rail-content">
              <div className="rail-section-label"><History size={12} /> MEMORY NODES</div>
              {conversations.map(c => (
                 <div 
                   key={c.id} 
                   className={`memory-node ${activeConv?.id === c.id ? 'active' : ''}`}
                   onClick={() => openConversation(c.id)}
                 >
                    <div className="node-icon"><MessageSquare size={14} /></div>
                    <div className="node-info">
                       <span className="node-title">{c.subject_name}</span>
                       <span className="node-meta">{c.message_count} sequences</span>
                    </div>
                    <button className="node-delete" onClick={(e) => handleDelete(c.id, e)}>
                       <Trash2 size={12} />
                    </button>
                 </div>
              ))}
              {conversations.length === 0 && (
                <div className="rail-empty">No past intelligence nodes.</div>
              )}
           </div>
        </section>

        {/* Chat Infinity (Main) */}
        <section className="chat-infinity">
           {!activeConv ? (
             <div className="oracle-intro animate-fade-up">
                <div className="oracle-avatar pulse-soft">
                   <Sparkles size={48} color="white" />
                </div>
                <h1 className="text-gradient">Consult the Oracle.</h1>
                <p>Bridge the gap between curriculum nodes with precision intelligence. Select a domain to specialize the response layer.</p>
                
                <div className="domain-selection">
                   <select 
                     className="glass-input domain-select" 
                     value={selectedSubj} 
                     onChange={e => setSelectedSubj(Number(e.target.value))}
                   >
                      <option value="">Neural (General)</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                   
                   <div className="suggestion-grid">
                      {['Explain Quantum Physics', 'Math Proofs', 'Chemical Bonds', 'World History'].map(txt => (
                        <button key={txt} className="suggestion-chip" onClick={() => { setInput(txt); startNewConversation(); }}>{txt}</button>
                      ))}
                   </div>
                </div>
             </div>
           ) : (
             <>
               <header className="chat-header">
                  <div className="chat-header__info">
                     <span className="subject-badge">{activeConv.subject_name}</span>
                     <span className="node-id">SECURE CHANNEL #{activeConv.id || 'NEW'}</span>
                  </div>
               </header>

               <div className="chat-viewport">
                  {activeConv.messages.map(m => <MsgBubble key={m.id} msg={m} />)}
                  {thinking && <ThinkingBubble />}
                  <div ref={bottomRef} />
               </div>
               
               <footer className="chat-controls">
                  <div className="input-wrapper glass-card">
                     <input 
                       className="chat-input" 
                       placeholder="Submit inquiry to intelligence layer..." 
                       value={input}
                       onChange={e => setInput(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleSend()}
                     />
                     <button 
                       className={`send-btn ${input.trim() ? 'active' : ''}`} 
                       onClick={handleSend}
                       disabled={!input.trim() || thinking}
                     >
                       <Send size={18} />
                     </button>
                  </div>
                  <div className="chat-footer-note">Powered by Gemini Quantum Orchestration • Rural Optimized</div>
               </footer>
             </>
           )}
        </section>
      </main>
      <BottomNav />

      <style>{`
        .intelligence-rail {
          width: 320px;
          flex-shrink: 0;
          background: var(--bg-surface);
          border-right: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          z-index: 100;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .rail-header { padding: var(--space-6); display: flex; gap: var(--space-3); }
        .new-chat-btn { flex: 1; height: 44px; font-size: 11px; font-weight: 800; }
        .mobile-close { display: none; background: none; border: none; color: var(--text-muted); }
        .rail-content { flex: 1; overflow-y: auto; padding: 0 var(--space-4); }
        .rail-section-label { font-size: 9px; font-weight: 800; color: var(--text-dim); padding: var(--space-4) var(--space-2); display: flex; alignItems: center; gap: 6px; letter-spacing: 0.1em; }
        .memory-node {
          padding: var(--space-3) var(--space-4);
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 4px;
          position: relative;
        }
        .memory-node:hover { background: var(--bg-elevated); }
        .memory-node.active { background: var(--glass-bg-hover); border: 1px solid var(--brand-primary)33; }
        .node-icon { color: var(--text-muted); }
        .node-info { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .node-title { font-size: 13px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .node-meta { font-size: 10px; color: var(--text-dim); }
        .node-delete { opacity: 0; transition: opacity 0.2s; background: none; border: none; color: var(--error); padding: 4px; border-radius: 6px; }
        .memory-node:hover .node-delete { opacity: 0.6; }
        .node-delete:hover { opacity: 1 !important; background: var(--error)11; }

        .chat-infinity { flex: 1; display: flex; flex-direction: column; background: var(--bg-primary); position: relative; }
        .sidebar-toggle { display: none; position: absolute; top: 12px; left: 16px; z-index: 50; background: var(--bg-elevated); border: 1px solid var(--glass-border); color: var(--text-primary); padding: 8px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        
        .oracle-intro { flex: 1; display: flex; flex-direction: column; alignItems: center; justifyContent: center; textAlign: center; padding: var(--space-10); }
        .oracle-avatar { width: 80px; height: 80px; border-radius: 24px; background: linear-gradient(135deg, var(--brand-primary), #a855f7); display: flex; alignItems: center; justifyContent: center; margin-bottom: var(--space-8); box-shadow: 0 12px 32px rgba(59,130,246,0.3); }
        .oracle-intro p { color: var(--text-muted); max-width: 440px; margin: 0 auto var(--space-8); line-height: 1.6; }
        .domain-selection { width: 100%; max-width: 500px; }
        .suggestion-grid { display: flex; flex-wrap: wrap; gap: 8px; justifyContent: center; margin-top: var(--space-8); }
        .suggestion-chip { background: var(--bg-elevated); border: 1px solid var(--glass-border); color: var(--text-secondary); padding: 8px 16px; border-radius: 20px; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .suggestion-chip:hover { border-color: var(--brand-primary); transform: translateY(-2px); }

        .chat-header { height: 60px; border-bottom: 1px solid var(--glass-border); display: flex; alignItems: center; padding: 0 var(--space-8); background: var(--bg-primary); }
        .subject-badge { font-size: 10px; font-weight: 800; color: var(--brand-primary); background: var(--brand-primary)11; padding: 4px 10px; border-radius: 6px; margin-right: 12px; }
        .node-id { font-size: 9px; font-weight: 800; color: var(--text-dim); letter-spacing: 0.1em; }

        .chat-viewport { flex: 1; overflow-y: auto; padding: var(--space-8) var(--space-8); scroll-behavior: smooth; }
        .chat-controls { padding: var(--space-6) var(--space-8); background: linear-gradient(transparent, var(--bg-primary) 20%); }
        .input-wrapper { display: flex; gap: 12px; padding: 8px 8px 8px 16px; border-radius: 24px; background: var(--bg-elevated); max-width: 900px; margin: 0 auto; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
        .chat-input { flex: 1; background: none; border: none; color: var(--text-primary); font-size: 14px; outline: none; }
        .send-btn { width: 40px; height: 40px; border-radius: 50%; display: flex; alignItems: center; justifyContent: center; transition: all 0.3s; background: var(--bg-surface); color: var(--text-muted); border: none; }
        .send-btn.active { background: var(--brand-primary); color: white; box-shadow: 0 4px 12px rgba(59,130,246,0.4); cursor: pointer; }
        .chat-footer-note { font-size: 8px; color: var(--text-dim); text-align: center; margin-top: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }

        .thinking-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brand-primary); animation: pulse 1.2s infinite ease-in-out; }
        
        @media (max-width: 1024px) {
          .intelligence-rail { position: absolute; left: 0; top: 0; bottom: 0; transform: translateX(-100%); }
          .intelligence-rail.open { transform: translateX(0); }
          .sidebar-toggle { display: block; }
          .mobile-close { display: block; }
          .chat-viewport { padding-top: 60px; }
          .chat-header { padding-left: 64px; }
        }
      `}</style>
    </div>
  );
};

export default AIChatPage;
