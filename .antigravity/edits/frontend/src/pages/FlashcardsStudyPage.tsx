// pages.FlashcardsStudyPage — Student: flip cards and rate them (SM-2)
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  listStudyDecks, getDueCards, submitReview,
  type FlashcardDeck, type Flashcard, type DueSession,
} from "../services/flashcards";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

// ── Card flip component ───────────────────────────────────────────────────────
function FlipCard({ card, onRate }: { card: Flashcard; onRate: (quality: number) => void }) {
  const [flipped, setFlipped] = useState(false);

  // Reset flip when card changes
  // key prop on parent handles reset — no need for effect

  const qualityLabels = [
    { q: 0, label: "No idea",   color: "#ef4444", bg: "rgba(239,68,68,0.08)"   },
    { q: 1, label: "Wrong",     color: "#f97316", bg: "rgba(249,115,22,0.08)"  },
    { q: 2, label: "Hard",      color: "#eab308", bg: "rgba(234,179,8,0.08)"   },
    { q: 3, label: "Easy",      color: "#22c55e", bg: "rgba(34,197,94,0.08)"   },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-6)", width: "100%", maxWidth: 500, margin: "0 auto" }}>
      {/* Card — glassmorphic flip */}
      <div onClick={() => setFlipped(v => !v)}
        style={{ width: "100%", minHeight: 240, cursor: "pointer", position: "relative", borderRadius: "var(--radius-xl)", userSelect: "none" }}>

        {/* Front */}
        <div className="glass-card" style={{
          position: "absolute", inset: 0,
          borderRadius: "var(--radius-xl)", padding: "var(--space-8)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          opacity: flipped ? 0 : 1, transition: "opacity 0.25s ease",
          textAlign: "center",
          border: "1px solid var(--glass-border)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>QUESTION</div>
          <p style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.5 }}>{card.front}</p>
          {card.hint && !flipped && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--role-student)", marginTop: "var(--space-3)" }}>💡 {card.hint}</p>
          )}
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-4)", letterSpacing: "0.05em" }}>TAP TO REVEAL</p>
        </div>

        {/* Back */}
        <div className="glass-card" style={{
          position: "absolute", inset: 0,
          borderRadius: "var(--radius-xl)", padding: "var(--space-8)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          opacity: flipped ? 1 : 0, transition: "opacity 0.25s ease",
          textAlign: "center",
          border: "1px solid rgba(61,214,140,0.35)",
          background: "rgba(61,214,140,0.04)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--role-student)", marginBottom: "var(--space-4)" }}>ANSWER</div>
          <p style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{card.back}</p>
        </div>
      </div>

      {/* Rating buttons — only show after flip */}
      {flipped && (
        <div style={{ display: "flex", gap: "var(--space-3)", width: "100%" }}>
          {qualityLabels.map(({ q, label, color, bg }) => (
            <button key={q} onClick={() => onRate(q)}
              style={{ flex: 1, padding: "var(--space-3) var(--space-2)", border: `1px solid ${color}40`, borderRadius: "var(--radius-md)", background: bg, color, fontWeight: 800, fontSize: "var(--text-xs)", cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.04em" }}>
              {label.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {!flipped && (
        <button className="btn--primary" onClick={() => setFlipped(true)} style={{ width: "100%", maxWidth: 200, letterSpacing: "0.05em" }}>
          SHOW ANSWER
        </button>
      )}
    </div>
  );
}

// ── Session complete screen ───────────────────────────────────────────────────
function SessionComplete({ stats, deckTitle, onRestart, onBack }: {
  stats: { correct: number; total: number };
  deckTitle: string;
  onRestart: () => void;
  onBack: () => void;
}) {
  const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "var(--space-8)", textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: "var(--space-4)" }}>{pct >= 75 ? "🎉" : pct >= 50 ? "💪" : "📚"}</div>
      <div className="role-tag role-tag--student" style={{ marginBottom: "var(--space-3)" }}>SESSION COMPLETE</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-2xl)", color: "var(--text-primary)", marginBottom: "var(--space-2)", letterSpacing: "-0.03em" }}>
        {pct >= 75 ? "Excellent Work!" : pct >= 50 ? "Nice Progress!" : "Keep Grinding!"}
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-6)" }}>{deckTitle}</p>
      <div className="glass-card" style={{ display: "flex", gap: "var(--space-8)", marginBottom: "var(--space-6)", padding: "var(--space-5) var(--space-8)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: "var(--role-student)", letterSpacing: "-0.03em" }}>{stats.correct}</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)" }}>CORRECT</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>{stats.total}</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)" }}>TOTAL</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: "var(--role-teacher)", letterSpacing: "-0.03em" }}>{pct}%</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)" }}>SCORE</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button className="btn--primary" onClick={onRestart}>Study Again</button>
        <button className="btn--ghost"   onClick={onBack}>Back to Decks</button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FlashcardsStudyPage() {
  const { deckId }      = useParams<{ deckId: string }>();

  const [decks,     setDecks]     = useState<FlashcardDeck[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [session,   setSession]   = useState<DueSession | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [studying,  setStudying]  = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    listStudyDecks()
      .then(setDecks)
      .catch(() => setError("Failed to load decks."))
      .finally(() => setLoading(false));
  }, []);

  const startStudy = useCallback(async (id: number) => {
    setStudying(true);
    setError(null);
    try {
      const s = await getDueCards(id);
      if (s.total_due === 0) {
        setError("No cards due today for this deck! Come back tomorrow.");
        setStudying(false);
        return;
      }
      setSession(s);
      setCardIndex(0);
      setSessionStats({ correct: 0, total: 0 });
      setDone(false);
    } catch {
      setError("Failed to load cards.");
    } finally { setStudying(false); }
  }, []);

  // Auto-start if deckId in URL
  useEffect(() => {
    if (deckId && !session && !studying) startStudy(Number(deckId));
  }, [deckId, session, studying, startStudy]);

  const handleRate = useCallback(async (quality: number) => {
    if (!session) return;
    const card = session.cards[cardIndex];
    try {
      await submitReview(session.deck_id, card.id, quality);
    } catch { /* silent — progress is best-effort */ }

    setSessionStats(prev => ({
      correct: prev.correct + (quality >= 2 ? 1 : 0),
      total:   prev.total + 1,
    }));

    if (cardIndex + 1 >= session.cards.length) {
      setDone(true);
    } else {
      setCardIndex(i => i + 1);
    }
  }, [session, cardIndex]);

  const currentCard = session?.cards[cardIndex];
  const progress    = session ? Math.round(((cardIndex) / session.cards.length) * 100) : 0;

  // ── Deck list view ──
  if (!session) return (
    <div className="page-shell">
      <TopBar title="Flashcards" />
      <main className="page-content page-enter has-bottom-nav">

        <header className="page-hero animate-fade-up" style={{ marginBottom: "var(--space-6)" }}>
          <div className="role-tag role-tag--student" style={{ marginBottom: "var(--space-4)" }}>🃏 SPACED REPETITION</div>
          <h1 className="text-gradient md-display">Flash<br/>Forge.</h1>
          <p className="hero-subtitle">Scientifically optimized flashcard study powered by SM-2 algorithm.</p>
        </header>

        {error && <div className="alert alert--error animate-fade-up" style={{ marginBottom: "var(--space-4)" }} onClick={() => setError(null)}>{error}</div>}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {[1,2,3].map(i => <div key={i} className="skeleton-box" style={{ height: 80, borderRadius: "var(--radius-lg)" }} />)}
          </div>
        ) : decks.length === 0 ? (
          <div className="glass-card empty-well animate-fade-up">
            <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>🃏</span>
            <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>NO DECKS AVAILABLE</p>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Your teachers haven't published any flashcard decks yet.</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {decks.map(deck => (
              <div key={deck.id} className="glass-card animate-fade-up" style={{ padding: "var(--space-4)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)", letterSpacing: "0.01em" }}>{deck.title}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                    {deck.subject_name} · {deck.card_count} cards
                    {deck.due_count !== undefined && deck.due_count > 0 && (
                      <span className="role-tag role-tag--student" style={{ marginLeft: "var(--space-2)", fontSize: 9 }}>
                        {deck.due_count} DUE
                      </span>
                    )}
                  </div>
                </div>
                <button className="btn--primary" style={{ fontSize: "var(--text-sm)", flexShrink: 0 }}
                  onClick={() => startStudy(deck.id)} disabled={studying}>
                  {studying ? "Loading…" : "STUDY"}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );

  // ── Session complete view ──
  if (done) return (
    <div className="page-shell" style={{ display: "flex", flexDirection: "column" }}>
      <TopBar title="Flashcards" />
      <SessionComplete
        stats={sessionStats}
        deckTitle={session.deck_title}
        onRestart={() => startStudy(session.deck_id)}
        onBack={() => { setSession(null); setDone(false); }}
      />
      <BottomNav />
    </div>
  );

  // ── Active study session ──
  return (
    <div className="page-shell" style={{ display: "flex", flexDirection: "column" }}>
      <TopBar title={session.deck_title} />
      {/* Progress bar */}
      <div style={{ padding: "var(--space-2) var(--space-4)", borderBottom: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: "var(--space-3)", flexShrink: 0 }}>
        <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, var(--role-teacher), var(--role-student))", borderRadius: 99, transition: "width 0.3s" }} />
        </div>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", flexShrink: 0, fontWeight: 700, letterSpacing: "0.05em" }}>{cardIndex + 1} / {session.cards.length}</span>
        <button className="btn--ghost" style={{ fontSize: "var(--text-xs)", flexShrink: 0, letterSpacing: "0.05em" }} onClick={() => setSession(null)}>EXIT</button>
      </div>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "var(--space-6) var(--space-4)", paddingBottom: 80, overflowY: "auto" }}>
        {currentCard && <FlipCard key={currentCard.id} card={currentCard} onRate={handleRate} />}
      </main>
      <BottomNav />
    </div>
  );
}
