import React, { useEffect, useState } from "react";
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

const CardRow: React.FC<{ card: Flashcard; deckId: number; onSaved: (c: Flashcard) => void; onDeleted: (id: number) => void; }> = ({ card, deckId, onSaved, onDeleted }) => {
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await updateCard(deckId, card.id, { front, back, hint: card.hint });
      onSaved(saved);
      setEditing(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="glass-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)', background: editing ? 'var(--bg-elevated)' : 'var(--bg-glass)' }}>
      {editing ? (
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <input className="form-input" value={front} onChange={e => setFront(e.target.value)} style={{ fontSize: '11px', background: 'var(--bg-primary)' }} />
          <input className="form-input" value={back} onChange={e => setBack(e.target.value)} style={{ fontSize: '11px', background: 'var(--bg-primary)' }} />
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <button className="btn--primary" style={{ fontSize: '10px', padding: '6px 12px' }} onClick={save}>SAVE</button>
            <button className="btn--ghost" style={{ fontSize: '10px', padding: '6px 12px' }} onClick={() => setEditing(false)}>CANCEL</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{card.front}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{card.back}</div>
          </div>
          <button className="btn--ghost" style={{ padding: '4px 8px', fontSize: '10px' }} onClick={() => setEditing(true)}>EDIT</button>
        </div>
      )}
    </div>
  );
};

const FlashcardDecksPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [activeDeck, setActiveDeck] = useState<DeckDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyDecks().then(setDecks).finally(() => setLoading(false));
  }, []);

  const openDeck = async (id: number) => {
    const d = await getDeck(id);
    setActiveDeck(d);
  };

  return (
    <div className="page-shell">
      <TopBar title="Knowledge Library" />
      <main style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        
        {/* Explorer Pane */}
        <section style={{ width: activeDeck ? '320px' : '100%', flexShrink: 0, borderRight: '1px solid var(--glass-border)', overflowY: 'auto', padding: 'var(--space-6)', transition: 'width 0.3s ease' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
              <h2 className="text-gradient" style={{ fontSize: 'var(--text-xl)', letterSpacing: '-0.02em' }}>Memory Vault</h2>
              <button className="btn--primary" style={{ padding: '8px 16px', fontSize: '10px' }}>+ NEW DECK</button>
           </div>

           {loading ? (
             <div className="btn__spinner" style={{ margin: 'auto' }} />
           ) : (
             <div style={{ display: 'grid', gridTemplateColumns: activeDeck ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                {decks.map(d => (
                  <div key={d.id} className="glass-card page-enter" onClick={() => openDeck(d.id)} style={{ padding: 'var(--space-5)', cursor: 'pointer', border: activeDeck?.id === d.id ? '1px solid var(--brand-primary)' : '1px solid var(--glass-border)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                        <div className="role-tag role-tag--teacher" style={{ fontSize: '7px' }}>{d.subject_name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 }}>{d.card_count} CARDS</div>
                     </div>
                     <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-primary)' }}>{d.title}</h3>
                     <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>Last updated 2 days ago</p>
                  </div>
                ))}
             </div>
           )}
        </section>

        {/* Editor Pane (Hidden if no active deck) */}
        {activeDeck && (
          <section className="page-enter" style={{ flex: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.01)', padding: 'var(--space-8)' }}>
             <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-10)' }}>
                <div>
                   <h1 className="text-gradient" style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-1)' }}>{activeDeck.title}</h1>
                   <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>📚 {activeDeck.subject_name}</span>
                      <span>💠 {activeDeck.cards.length} Total Cards</span>
                   </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                   <button className="btn--primary" style={{ padding: '10px 20px', fontSize: '11px' }}>+ ADD CARD</button>
                   <button className="btn--ghost" style={{ padding: '10px 20px', fontSize: '11px', color: 'var(--admin)' }}>DELETE</button>
                </div>
             </header>

             <div style={{ maxWidth: '600px' }}>
                <h3 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>CARD ORCHESTRATION</h3>
                {activeDeck.cards.map(card => (
                  <CardRow key={card.id} card={card} deckId={activeDeck.id} onSaved={s => setActiveDeck({...activeDeck, cards: activeDeck.cards.map(c => c.id === s.id ? s : c)})} onDeleted={() => {}} />
                ))}
             </div>
          </section>
        )}

      </main>
    </div>
  );
};

export default FlashcardDecksPage;
