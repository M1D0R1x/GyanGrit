import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  listConversations, getConversation, sendMessage, deleteConversation,
  type Conversation, type AIMessage, type ConversationDetail,
} from "../services/aiAssistant";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

type Subject = { id: number; name: string };

const MsgBubble: React.FC<{ msg: AIMessage }> = ({ msg }) => {
  const isUser = msg.role === "user";
  return (
    <div className="page-enter" style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 'var(--space-6)' }}>
      <div className="glass-card" style={{ 
        maxWidth: '85%', 
        padding: 'var(--space-4) var(--space-5)', 
        background: isUser ? 'var(--bg-elevated)' : 'var(--bg-glass)',
        borderLeft: isUser ? 'none' : '2px solid var(--role-teacher)',
        borderRight: isUser ? '2px solid var(--brand-primary)' : 'none',
        borderRadius: isUser ? '18px 18px 2px 18px' : '18px 18px 18px 2px'
      }}>
        <p style={{ fontSize: '13px', lineHeight: 1.6, margin: 0, color: 'var(--text-primary)' }}>{msg.content}</p>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '8px', textAlign: isUser ? 'right' : 'left', fontWeight: 700 }}>
          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

const ThinkingBubble: React.FC = () => (
  <div className="page-enter" style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-6)' }}>
    <div className="glass-card" style={{ padding: '12px 20px', borderRadius: '18px 18px 18px 2px', borderLeft: '2px solid var(--role-teacher)' }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--role-teacher)', opacity: 0.4, animation: `pulse 1.2s infinite ${i * 0.2}s` }} />
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
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listConversations().then(setConversations);
    apiGet<Subject[]>("/academics/subjects/").then(setSubjects);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages.length, thinking]);

  const openConversation = async (id: number) => {
    const detail = await getConversation(id);
    setActiveConv(detail);
  };

  const startNewConversation = () => {
    setActiveConv({ id: 0, subject_id: selectedSubj || null, subject_name: subjects.find(s => s.id === Number(selectedSubj))?.name ?? "General", messages: [] });
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || thinking) return;
    setInput("");
    setThinking(true);

    const tempMsg: AIMessage = { id: Date.now(), role: "user", content, created_at: new Date().toISOString() };
    setActiveConv(prev => prev ? { ...prev, messages: [...prev.messages, tempMsg] } : prev);

    try {
      const res = await sendMessage({ message: content, conversation_id: activeConv?.id || undefined, subject_id: activeConv?.subject_id || (selectedSubj ? Number(selectedSubj) : undefined) });
      setActiveConv(prev => {
        if (!prev) return null;
        const msgs = prev.messages.filter(m => m.id !== tempMsg.id);
        return { ...prev, id: res.conversation_id, messages: [...msgs, tempMsg, res.message] };
      });
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="page-shell">
      <TopBar title="The Oracle" />
      <main style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        
        {/* History Rail */}
        <section style={{ width: '280px', flexShrink: 0, borderRight: '1px solid var(--glass-border)', overflowY: 'auto', padding: 'var(--space-4)', background: 'var(--bg-surface)' }}>
           <button className="btn--primary" style={{ width: '100%', marginBottom: 'var(--space-6)', fontSize: '11px' }} onClick={startNewConversation}>+ NEW INQUIRY</button>
           <h3 style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, marginBottom: 'var(--space-4)', letterSpacing: '0.1em' }}>PAST CONVERSATIONS</h3>
           {conversations.map(c => (
              <div key={c.id} className="glass-card" onClick={() => openConversation(c.id)} style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-2)', cursor: 'pointer', border: activeConv?.id === c.id ? '1px solid var(--brand-primary)' : '1px solid transparent' }}>
                 <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.subject_name}</div>
                 <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{c.message_count} sequences</div>
              </div>
           ))}
        </section>

        {/* Chat Chamber */}
        <section style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
           {!activeConv ? (
             <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-10)' }}>
                <div className="page-enter">
                   <h1 className="text-gradient" style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>Consult the Oracle.</h1>
                   <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto var(--space-8)' }}>Ask any specialized inquiry across your curriculum domains. Our intelligence layer provides high-precision answers.</p>
                   {subjects.length > 0 && (
                     <select className="form-input" value={selectedSubj} onChange={e => setSelectedSubj(Number(e.target.value))} style={{ maxWidth: '300px', margin: '0 auto' }}>
                        <option value="">Select Domain (Optional)</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                   )}
                </div>
             </div>
           ) : (
             <>
               <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-8) var(--space-10)' }}>
                  {activeConv.messages.map(m => <MsgBubble key={m.id} msg={m} />)}
                  {thinking && <ThinkingBubble />}
                  <div ref={bottomRef} />
               </div>
               
               <footer style={{ padding: 'var(--space-6) var(--space-10)', borderTop: '1px solid var(--glass-border)', background: 'var(--bg-glass)', backdropFilter: 'blur(20px)' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                     <input 
                       className="form-input" 
                       placeholder="Submit inquiry to the Oracle..." 
                       value={input}
                       onChange={e => setInput(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleSend()}
                       style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)' }}
                     />
                     <button className="btn--primary" style={{ padding: '0 var(--space-6)' }} onClick={handleSend}>SEND</button>
                  </div>
               </footer>
             </>
           )}
        </section>
      </main>
      <BottomNav />
    </div>
  );
};

export default AIChatPage;
