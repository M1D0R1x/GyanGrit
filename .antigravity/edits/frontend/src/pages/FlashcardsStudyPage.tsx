import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  listStudyDecks, getDueCards, submitReview,
  type FlashcardDeck, type Flashcard, type DueSession,
} from "../services/flashcards";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

const FlipCard: React.FC<{ card: Flashcard; onRate: (q: number) => void }> = ({ card, onRate }) => {
  const [flipped, setFlipped] = useState(false);
  const qualities = [
    { q: 0, label: "AGAIN", color: "#ff6b6b" },
    { q: 1, label: "HARD", color: "#fab005" },
    { q: 2, label: "GOOD", color: "#3dd68c" },
    { q: 3, label: "EASY", color: "#4dabf7" },
  ];

  return (
    <div style={{ perspective: '1000px', width: '100%', maxWidth: '440px', margin: '0 auto' }}>
      <div 
        onClick={() => setFlipped(!flipped)}
        style={{ 
          width: '100%', height: '320px', position: 'relative', 
          transformStyle: 'preserve-3d', transition: 'transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          cursor: 'pointer'
        }}
      >
        {/* Front */}
        <div className="glass-card" style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)', textAlign: 'center', border: '2px solid var(--glass-border)' }}>
           <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>QUESTION ORACLE</div>
           <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700, lineHeight: 1.4 }}>{card.front}</p>
           {card.hint && <div style={{ marginTop: 'var(--space-6)', padding: '4px 12px', borderRadius: '4px', background: 'var(--brand-primary-glow)', fontSize: '11px', color: 'var(--brand-primary)' }}>💡 {card.hint}</div>}
        </div>
        {/* Back */}
        <div className="glass-card" style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)', textAlign: 'center', background: 'var(--bg-elevated)', border: '2px solid var(--brand-primary)' }}>
           <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--brand-primary)', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>ARCHIVED TRUTH</div>
           <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>{card.back}</p>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-10)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)', opacity: flipped ? 1 : 0.2, pointerEvents: flipped ? 'auto' : 'none', transition: 'opacity 0.3s' }}>
         {qualities.map(item => (
           <button key={item.q} onClick={(e) => { e.stopPropagation(); onRate(item.q); }} className="btn--ghost" style={{ padding: 'var(--space-4) 0', fontSize: '10px', fontWeight: 900, border: `1px solid ${item.color}44`, color: item.color }}>{item.label}</button>
         ))}
      </div>
    </div>
  );
};

const FlashcardsStudyPage: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [session, setSession] = useState<DueSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    listStudyDecks().then(setDecks).finally(() => setLoading(false));
  }, []);

  const handleStudy = async (id: number) => {
    const s = await getDueCards(id);
    setSession(s);
  };

  const handleRate = (q: number) => {
    if (!session) return;
    submitReview(session.deck_id, session.cards[index].id, q);
    if (index + 1 < session.cards.length) setIndex(index + 1);
    else navigate(-1);
  };

  if (loading) return <div className="page-shell"><TopBar /><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="btn__spinner" /></main></div>;

  return (
    <div className="page-shell">
      <TopBar title="Active Retention" />
      <main className="page-content page-enter has-bottom-nav" style={{ padding: 'var(--space-10) var(--space-6)' }}>
        
        {!session ? (
           <>
             <header className="editorial-header" style={{ marginBottom: 'var(--space-10)' }}>
                <div className="role-tag role-tag--student" style={{ marginBottom: 'var(--space-4)' }}>🧠 Neuro-Sync Mode</div>
                <h1 className="text-gradient" style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>Study Decks.</h1>
                <p style={{ color: 'var(--text-muted)' }}>Reinforce your long-term memory via spaced-repetition logic.</p>
             </header>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {decks.map(d => (
                  <div key={d.id} className="glass-card" style={{ padding: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>{d.title}</h3>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{d.subject_name} · {d.card_count} ENTITIES</div>
                     </div>
                     <button className="btn--primary" onClick={() => handleStudy(d.id)} style={{ padding: '0 var(--space-6)', fontSize: '11px' }}>STUDY</button>
                  </div>
                ))}
             </div>
           </>
        ) : (
           <div className="animate-fade-up">
              <div style={{ height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden', marginBottom: 'var(--space-12)' }}>
                 <div style={{ height: '100%', width: `${((index + 1) / session.cards.length) * 100}%`, background: 'var(--role-student)', transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
              </div>
              <FlipCard card={session.cards[index]} onRate={handleRate} />
           </div>
        )}

      </main>
      <BottomNav />
    </div>
  );
};

export default FlashcardsStudyPage;
