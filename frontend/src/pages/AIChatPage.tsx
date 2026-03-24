// pages.AIChatPage
/**
 * AI Doubt Clearance — Gemini-powered study assistant.
 * Students ask questions about their curriculum.
 * Conversations are persisted per subject.
 * Teachers can see question analytics in their dashboard.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  listConversations, getConversation, sendMessage, deleteConversation,
  type Conversation, type AIMessage, type ConversationDetail,
} from "../services/aiAssistant";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

type Subject = { id: number; name: string };

// ── Message bubble ────────────────────────────────────────────────────────────
function MsgBubble({ msg }: { msg: AIMessage }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: "var(--space-3)" }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, var(--brand-primary), #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginRight: "var(--space-2)", alignSelf: "flex-end" }}>
          🤖
        </div>
      )}
      <div style={{
        maxWidth: "78%", padding: "var(--space-3) var(--space-4)",
        borderRadius: isUser
          ? "var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)"
          : "var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)",
        background: isUser ? "var(--brand-primary)" : "var(--bg-elevated)",
        color:      isUser ? "#fff" : "var(--text-primary)",
        border:     isUser ? "none" : "1px solid var(--border-subtle)",
      }}>
        <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {msg.content}
        </p>
        <span style={{ fontSize: 10, color: isUser ? "rgba(255,255,255,0.6)" : "var(--text-muted)", display: "block", textAlign: "right", marginTop: "var(--space-1)" }}>
          {new Date(msg.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

// ── Thinking indicator ────────────────────────────────────────────────────────
function ThinkingBubble() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, var(--brand-primary), #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div>
      <div style={{ padding: "var(--space-3) var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)", border: "1px solid var(--border-subtle)", display: "flex", gap: 4, alignItems: "center" }}>
        {[0, 150, 300].map(d => (
          <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)", animation: `pulse 1.2s ease-in-out ${d}ms infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AIChatPage() {

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv,    setActiveConv]    = useState<ConversationDetail | null>(null);
  const [subjects,      setSubjects]      = useState<Subject[]>([]);
  const [thinking,      setThinking]      = useState(false);
  const [input,         setInput]         = useState("");
  const [selectedSubj,  setSelectedSubj]  = useState<number | "">("");
  const [error,         setError]         = useState<string | null>(null);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    listConversations()
      .then(setConversations)
      .catch(() => {})
      ;

    // Get subjects from teaching assignments (student) or all subjects (teacher)
    apiGet<Subject[]>("/academics/subjects/")
      .then(setSubjects)
      .catch(() => {});
  }, []);

  useEffect(() => { scrollToBottom(); }, [activeConv?.messages.length, thinking]);

  const openConversation = useCallback(async (id: number) => {
    const detail = await getConversation(id);
    setActiveConv(detail);
    setTimeout(scrollToBottom, 100);
  }, []);

  const startNewConversation = useCallback(() => {
    setActiveConv({ id: 0, subject_id: selectedSubj || null, subject_name: subjects.find(s => s.id === Number(selectedSubj))?.name ?? "General", messages: [] });
  }, [selectedSubj, subjects]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || thinking) return;
    setInput("");
    setThinking(true);
    setError(null);

    // Optimistic user message
    const tempMsg: AIMessage = { id: -Date.now(), role: "user", content, created_at: new Date().toISOString() };
    setActiveConv(prev => prev ? { ...prev, messages: [...prev.messages, tempMsg] } : prev);

    try {
      const res = await sendMessage({
        message:         content,
        conversation_id: activeConv?.id || undefined,
        subject_id:      activeConv?.subject_id || (selectedSubj ? Number(selectedSubj) : undefined),
      });

      setActiveConv(prev => {
        if (!prev) return prev;
        const msgs = prev.messages.filter(m => m.id !== tempMsg.id);
        return {
          ...prev,
          id: res.conversation_id,
          messages: [...msgs, tempMsg, res.message],
        };
      });

      // Update conversation list
      setConversations(prev => {
        const existing = prev.find(c => c.id === res.conversation_id);
        if (existing) {
          return [{ ...existing, updated_at: new Date().toISOString(), message_count: existing.message_count + 2 },
                  ...prev.filter(c => c.id !== res.conversation_id)];
        }
        return [{ id: res.conversation_id, subject_id: activeConv?.subject_id ?? null, subject_name: activeConv?.subject_name ?? "General", started_at: new Date().toISOString(), updated_at: new Date().toISOString(), message_count: 2 }, ...prev];
      });
    } catch {
      setActiveConv(prev => prev ? { ...prev, messages: prev.messages.filter(m => m.id !== tempMsg.id) } : prev);
      setError("Failed to get a response. Please try again.");
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  }, [input, thinking, activeConv, selectedSubj]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm("Delete this conversation?")) return;
    await deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConv?.id === id) setActiveConv(null);
  }, [activeConv?.id]);

  const showSidebar = conversations.length > 0 || activeConv;

  return (
    <div className="page-shell">
      <TopBar title="AI Study Assistant" />
      <main style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden" }}>

        {/* ── Conversation sidebar ── */}
        {showSidebar && (
          <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", background: "var(--bg-surface)" }}>
            <div style={{ padding: "var(--space-3)", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
              <button className="btn btn--primary" style={{ width: "100%", fontSize: "var(--text-xs)" }} onClick={startNewConversation}>
                + New Chat
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-2)" }}>
              {conversations.map(c => (
                <div key={c.id} onClick={() => openConversation(c.id)}
                  style={{ padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-md)", cursor: "pointer", background: activeConv?.id === c.id ? "rgba(59,130,246,0.08)" : "none", marginBottom: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.subject_name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{c.message_count} messages</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, padding: 2, flexShrink: 0 }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Chat area ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!activeConv ? (
            /* Welcome screen */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--space-8)", textAlign: "center" }}>
              <div style={{ fontSize: 56, marginBottom: "var(--space-4)" }}>🤖</div>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-2xl)", color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
                GyanGrit AI Tutor
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", maxWidth: 360, marginBottom: "var(--space-6)", lineHeight: 1.6 }}>
                Ask any question about your subjects. Get instant, curriculum-aligned answers in English, Hindi, or Punjabi.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", maxWidth: 340 }}>
                {subjects.length > 0 && (
                  <select className="form-input" value={selectedSubj} onChange={e => setSelectedSubj(Number(e.target.value))}>
                    <option value="">Select a subject (optional)</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                <button className="btn btn--primary" onClick={startNewConversation}>
                  Start Asking Questions
                </button>
              </div>
              {/* Suggested questions */}
              <div style={{ marginTop: "var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-2)", width: "100%", maxWidth: 360 }}>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 600 }}>Try asking:</p>
                {["Explain photosynthesis simply", "What is Newton's second law?", "ਪੰਜਾਬੀ ਵਿੱਚ ਦੱਸੋ — ਲੋਕਤੰਤਰ ਕੀ ਹੈ?", "Maths mein percentage kaise nikaltey hain?"].map(q => (
                  <button key={q} onClick={() => { startNewConversation(); setTimeout(() => setInput(q), 100); }}
                    style={{ padding: "var(--space-2) var(--space-3)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--text-secondary)", textAlign: "left" }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                    {activeConv.subject_name || "General"} Tutor
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Powered by Gemini · Curriculum-aligned</div>
                </div>
                <button className="btn btn--ghost" style={{ fontSize: "var(--text-xs)" }} onClick={() => setActiveConv(null)}>← Back</button>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4)" }}>
                {activeConv.messages.length === 0 && (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-8)" }}>
                    Ask your first question below 👇
                  </div>
                )}
                {activeConv.messages.map(m => <MsgBubble key={m.id} msg={m} />)}
                {thinking && <ThinkingBubble />}
                {error && (
                  <div className="alert alert--error" style={{ margin: "var(--space-2) 0" }} onClick={() => setError(null)}>{error}</div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Disclaimer */}
              <div style={{ padding: "var(--space-1) var(--space-4)", background: "rgba(245,158,11,0.06)", borderTop: "1px solid rgba(245,158,11,0.15)", fontSize: 10, color: "rgba(180,120,0,0.8)", textAlign: "center" }}>
                ⚠️ AI can make mistakes. Always verify with your textbook or teacher.
              </div>

              {/* Input */}
              <div style={{ padding: "var(--space-3) var(--space-4)", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface)", display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                <input ref={inputRef} className="form-input" type="text"
                  placeholder="Ask anything about your subjects… (English, Hindi, or Punjabi)"
                  value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                  disabled={thinking} style={{ flex: 1 }} maxLength={1000} />
                <button className="btn btn--primary" style={{ flexShrink: 0, padding: "var(--space-3) var(--space-4)" }}
                  onClick={() => void handleSend()} disabled={thinking || !input.trim()}>
                  {thinking ? <span className="btn__spinner" aria-hidden="true" /> : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <BottomNav />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
