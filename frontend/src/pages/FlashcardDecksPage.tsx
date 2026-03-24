// pages.FlashcardDecksPage — Teacher: create & manage flashcard decks
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listMyDecks, createDeck, updateDeck, deleteDeck,
  createCard, updateCard, deleteCard, getDeck,
  type FlashcardDeck, type DeckDetail, type Flashcard,
} from "../services/flashcards";
import { apiGet } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";

type Subject = { id: number; name: string };
type TeachingAssignment = { section_id: number; section_name: string; subject_id: number; subject_name: string };

// ── Card editor row ───────────────────────────────────────────────────────────
function CardRow({ card, deckId, onSaved, onDeleted }: {
  card: Flashcard; deckId: number;
  onSaved: (c: Flashcard) => void;
  onDeleted: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [front, setFront]     = useState(card.front);
  const [back, setBack]       = useState(card.back);
  const [hint, setHint]       = useState(card.hint);
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await updateCard(deckId, card.id, { front, back, hint });
      onSaved(saved);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!confirm("Delete this card?")) return;
    await deleteCard(deckId, card.id);
    onDeleted(card.id);
  };

  if (!editing) return (
    <div style={{ display: "flex", gap: "var(--space-3)", padding: "var(--space-3)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-2)", border: "1px solid var(--border-subtle)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{card.front}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{card.back}</div>
        {card.hint && <div style={{ fontSize: 10, color: "var(--brand-primary)", marginTop: 2 }}>💡 {card.hint}</div>}
      </div>
      <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
        <button className="btn btn--ghost" style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)" }} onClick={() => setEditing(true)}>Edit</button>
        <button className="btn btn--ghost" style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)", color: "var(--error)" }} onClick={remove}>✕</button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "var(--space-3)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-2)", border: "1px solid var(--brand-primary)" }}>
      <input className="form-input" value={front} onChange={e => setFront(e.target.value)} placeholder="Front (question)" style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-sm)" }} />
      <input className="form-input" value={back}  onChange={e => setBack(e.target.value)}  placeholder="Back (answer)"    style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-sm)" }} />
      <input className="form-input" value={hint}  onChange={e => setHint(e.target.value)}  placeholder="Hint (optional)"  style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-sm)" }} />
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <button className="btn btn--primary" style={{ fontSize: "var(--text-xs)" }} onClick={save} disabled={saving}>Save</button>
        <button className="btn btn--ghost"   style={{ fontSize: "var(--text-xs)" }} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FlashcardDecksPage() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const prefix     = user?.role === "ADMIN" ? "/admin" : user?.role === "PRINCIPAL" ? "/principal" : "/teacher";

  const [decks,        setDecks]        = useState<FlashcardDeck[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeDeck,   setActiveDeck]   = useState<DeckDetail | null>(null);
  const [loadingDeck,  setLoadingDeck]  = useState(false);
  const [subjects,     setSubjects]     = useState<Subject[]>([]);
  const [assignments,  setAssignments]  = useState<TeachingAssignment[]>([]);

  // New deck form
  const [showNewDeck,  setShowNewDeck]  = useState(false);
  const [newTitle,     setNewTitle]     = useState("");
  const [newDesc,      setNewDesc]      = useState("");
  const [newSubjectId, setNewSubjectId] = useState<number | "">("");
  const [newSectionId, setNewSectionId] = useState<number | "">("");
  const [creating,     setCreating]     = useState(false);

  // New card form
  const [showAddCard,  setShowAddCard]  = useState(false);
  const [newFront,     setNewFront]     = useState("");
  const [newBack,      setNewBack]      = useState("");
  const [newHint,      setNewHint]      = useState("");
  const [addingCard,   setAddingCard]   = useState(false);

  useEffect(() => {
    listMyDecks()
      .then(setDecks)
      .catch(() => {})
      .finally(() => setLoading(false));

    if (user?.role === "TEACHER") {
      apiGet<TeachingAssignment[]>("/accounts/my-assignments/")
        .then(setAssignments)
        .catch(() => {});
    } else {
      apiGet<Subject[]>("/academics/subjects/")
        .then(setSubjects)
        .catch(() => {});
    }
  }, [user?.role]);

  const openDeck = async (id: number) => {
    setLoadingDeck(true);
    try {
      const d = await getDeck(id);
      setActiveDeck(d);
    } finally { setLoadingDeck(false); }
  };

  const handleCreateDeck = async () => {
    if (!newTitle.trim() || !newSubjectId) return;
    setCreating(true);
    try {
      const deck = await createDeck({
        title: newTitle.trim(), description: newDesc.trim(),
        subject_id: Number(newSubjectId),
        section_id: newSectionId ? Number(newSectionId) : undefined,
      });
      setDecks(prev => [deck, ...prev]);
      setShowNewDeck(false); setNewTitle(""); setNewDesc(""); setNewSubjectId(""); setNewSectionId("");
    } finally { setCreating(false); }
  };

  const togglePublish = async (deck: FlashcardDeck) => {
    const updated = await updateDeck(deck.id, { is_published: !deck.is_published });
    setDecks(prev => prev.map(d => d.id === deck.id ? { ...d, ...updated } : d));
    if (activeDeck?.id === deck.id) setActiveDeck(prev => prev ? { ...prev, is_published: !prev.is_published } : prev);
  };

  const handleDeleteDeck = async (id: number) => {
    if (!confirm("Delete this deck and all its cards?")) return;
    await deleteDeck(id);
    setDecks(prev => prev.filter(d => d.id !== id));
    if (activeDeck?.id === id) setActiveDeck(null);
  };

  const handleAddCard = async () => {
    if (!newFront.trim() || !newBack.trim() || !activeDeck) return;
    setAddingCard(true);
    try {
      const card = await createCard(activeDeck.id, { front: newFront.trim(), back: newBack.trim(), hint: newHint.trim() });
      setActiveDeck(prev => prev ? { ...prev, cards: [...prev.cards, card], card_count: prev.card_count + 1 } : prev);
      setDecks(prev => prev.map(d => d.id === activeDeck.id ? { ...d, card_count: d.card_count + 1 } : d));
      setNewFront(""); setNewBack(""); setNewHint(""); setShowAddCard(false);
    } finally { setAddingCard(false); }
  };

  // Sections for selected subject (teacher assignments)
  const sectionsForSubject = assignments.filter(a => a.subject_id === Number(newSubjectId));
  const subjectOptions = user?.role === "TEACHER"
    ? [...new Map(assignments.map(a => [a.subject_id, { id: a.subject_id, name: a.subject_name }])).values()]
    : subjects;

  return (
    <div className="page-shell">
      <TopBar title="Flashcard Decks" />
      <main style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden" }}>

        {/* ── Left: deck list ── */}
        <div style={{ width: activeDeck ? 280 : "100%", flexShrink: 0, borderRight: activeDeck ? "1px solid var(--border-subtle)" : "none", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
              <button className="back-btn" onClick={() => navigate(`${prefix}`)}>← Back</button>
              <button className="btn btn--primary" style={{ fontSize: "var(--text-xs)" }} onClick={() => setShowNewDeck(v => !v)}>+ New Deck</button>
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", color: "var(--text-primary)" }}>My Decks</h2>

            {showNewDeck && (
              <div style={{ marginTop: "var(--space-3)", padding: "var(--space-3)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
                <input className="form-input" placeholder="Deck title *" value={newTitle} onChange={e => setNewTitle(e.target.value)} style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-sm)" }} />
                <input className="form-input" placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-sm)" }} />
                <select className="form-input" value={newSubjectId} onChange={e => setNewSubjectId(Number(e.target.value))} style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                  <option value="">Select subject *</option>
                  {subjectOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {sectionsForSubject.length > 0 && (
                  <select className="form-input" value={newSectionId} onChange={e => setNewSectionId(Number(e.target.value))} style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                    <option value="">All sections (global)</option>
                    {sectionsForSubject.map(a => <option key={a.section_id} value={a.section_id}>{a.section_name}</option>)}
                  </select>
                )}
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button className="btn btn--primary" style={{ fontSize: "var(--text-xs)" }} onClick={handleCreateDeck} disabled={creating || !newTitle.trim() || !newSubjectId}>
                    {creating ? "Creating…" : "Create"}
                  </button>
                  <button className="btn btn--ghost" style={{ fontSize: "var(--text-xs)" }} onClick={() => setShowNewDeck(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: "var(--radius-md)" }} />)}
            </div>
          ) : decks.length === 0 ? (
            <div className="empty-state" style={{ padding: "var(--space-8)" }}>
              <div className="empty-state__icon">🗂️</div>
              <h3 className="empty-state__title">No decks yet</h3>
              <p className="empty-state__message">Create your first flashcard deck above.</p>
            </div>
          ) : (
            <div style={{ padding: "var(--space-3)", overflowY: "auto" }}>
              {decks.map(deck => (
                <div key={deck.id} onClick={() => openDeck(deck.id)}
                  style={{ padding: "var(--space-3)", background: activeDeck?.id === deck.id ? "rgba(59,130,246,0.08)" : "var(--bg-elevated)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-2)", cursor: "pointer", border: activeDeck?.id === deck.id ? "1px solid var(--brand-primary)" : "1px solid var(--border-subtle)", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{deck.title}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{deck.subject_name} · {deck.card_count} cards</div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: "var(--radius-full)", background: deck.is_published ? "rgba(16,185,129,0.1)" : "rgba(107,114,128,0.1)", color: deck.is_published ? "var(--success)" : "var(--text-muted)", flexShrink: 0, marginLeft: "var(--space-2)" }}>
                      {deck.is_published ? "LIVE" : "DRAFT"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: deck editor ── */}
        {activeDeck && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
            <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{activeDeck.title}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{activeDeck.subject_name} · {activeDeck.cards.length} cards</div>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <button className="btn btn--ghost" style={{ fontSize: "var(--text-xs)" }} onClick={() => setShowAddCard(v => !v)}>+ Add Card</button>
                <button className="btn btn--ghost" style={{ fontSize: "var(--text-xs)", color: activeDeck.is_published ? "var(--warning)" : "var(--success)" }} onClick={() => togglePublish(activeDeck)}>
                  {activeDeck.is_published ? "Unpublish" : "Publish"}
                </button>
                <button className="btn btn--ghost" style={{ fontSize: "var(--text-xs)", color: "var(--error)" }} onClick={() => handleDeleteDeck(activeDeck.id)}>Delete</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4)" }}>
              {showAddCard && (
                <div style={{ padding: "var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--brand-primary)", marginBottom: "var(--space-4)" }}>
                  <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "var(--space-3)", color: "var(--text-primary)" }}>New Card</div>
                  <input className="form-input" placeholder="Front — question or term *" value={newFront} onChange={e => setNewFront(e.target.value)} style={{ marginBottom: "var(--space-2)" }} />
                  <textarea className="form-input" placeholder="Back — answer or definition *" value={newBack} onChange={e => setNewBack(e.target.value)} style={{ marginBottom: "var(--space-2)", resize: "none", minHeight: 72 }} />
                  <input className="form-input" placeholder="Hint (optional)" value={newHint} onChange={e => setNewHint(e.target.value)} style={{ marginBottom: "var(--space-3)" }} />
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <button className="btn btn--primary" style={{ fontSize: "var(--text-sm)" }} onClick={handleAddCard} disabled={addingCard || !newFront.trim() || !newBack.trim()}>
                      {addingCard ? "Adding…" : "Add Card"}
                    </button>
                    <button className="btn btn--ghost" style={{ fontSize: "var(--text-sm)" }} onClick={() => setShowAddCard(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {loadingDeck ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: "var(--radius-md)" }} />)}
                </div>
              ) : activeDeck.cards.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">🃏</div>
                  <h3 className="empty-state__title">No cards yet</h3>
                  <p className="empty-state__message">Click "+ Add Card" above to create your first flashcard.</p>
                </div>
              ) : (
                activeDeck.cards.map(card => (
                  <CardRow key={card.id} card={card} deckId={activeDeck.id}
                    onSaved={saved => setActiveDeck(prev => prev ? { ...prev, cards: prev.cards.map(c => c.id === saved.id ? saved : c) } : prev)}
                    onDeleted={id => setActiveDeck(prev => prev ? { ...prev, cards: prev.cards.filter(c => c.id !== id), card_count: prev.card_count - 1 } : prev)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
