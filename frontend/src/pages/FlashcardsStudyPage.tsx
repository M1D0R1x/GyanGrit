// pages.FlashcardsStudyPage — Student: flip cards and rate them (SM-2)
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  listStudyDecks, getDueCards, submitReview,
  type FlashcardDeck, type Flashcard, type DueSession,
} from "../services/flashcards";
import {
  getAllOfflineDecks,
  getOfflineFlashcardDeck,
  isOnline,
  enqueueOfflineAction,
} from "../services/offline";
import { sendHeartbeat } from "../services/analytics";

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
      {/* Card */}
      <div onClick={() => setFlipped(v => !v)}
        style={{ width: "100%", minHeight: 220, cursor: "pointer", position: "relative", borderRadius: "var(--radius-xl)", userSelect: "none" }}>

        {/* Front */}
        <div style={{
          position: "absolute", inset: 0,
          background: "var(--bg-elevated)", border: "2px solid var(--border-medium)",
          borderRadius: "var(--radius-xl)", padding: "var(--space-6)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          opacity: flipped ? 0 : 1, transition: "opacity 0.2s",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-muted)", marginBottom: "var(--space-3)" }}>Question</div>
          <p style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--ink-primary)", lineHeight: 1.5 }}>{card.front}</p>
          {card.hint && !flipped && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--saffron)", marginTop: "var(--space-3)" }}>💡 {card.hint}</p>
          )}
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-4)" }}>Tap to reveal answer</p>
        </div>

        {/* Back */}
        <div style={{
          position: "absolute", inset: 0,
          background: "var(--bg-elevated)", border: "2px solid var(--saffron)",
          borderRadius: "var(--radius-xl)", padding: "var(--space-6)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          opacity: flipped ? 1 : 0, transition: "opacity 0.2s",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--saffron)", marginBottom: "var(--space-3)" }}>Answer</div>
          <p style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--ink-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{card.back}</p>
        </div>
      </div>

      {/* Rating buttons — only show after flip */}
      {flipped && (
        <div style={{ display: "flex", gap: "var(--space-3)", width: "100%" }}>
          {qualityLabels.map(({ q, label, color, bg }) => (
            <button key={q} onClick={() => onRate(q)}
              style={{ flex: 1, padding: "var(--space-3) var(--space-2)", border: `1px solid ${color}40`, borderRadius: "var(--radius-md)", background: bg, color, fontWeight: 700, fontSize: "var(--text-xs)", cursor: "pointer", transition: "all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {!flipped && (
        <button className="btn btn--primary" onClick={() => setFlipped(true)} style={{ width: "100%", maxWidth: 200 }}>
          Show Answer
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
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-2xl)", color: "var(--ink-primary)", marginBottom: "var(--space-2)" }}>Session Complete!</h2>
      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-6)" }}>{deckTitle}</p>
      <div style={{ display: "flex", gap: "var(--space-6)", marginBottom: "var(--space-6)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: "var(--success)" }}>{stats.correct}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Correct</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: "var(--ink-primary)" }}>{stats.total}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Total</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: "var(--saffron)" }}>{pct}%</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Score</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button className="btn btn--primary" onClick={onRestart}>Study Again</button>
        <button className="btn btn--ghost"   onClick={onBack}>Back to Decks</button>
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
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Engagement heartbeat — fires every 30s while studying
  useEffect(() => {
    if (!session || !studying) {
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      return;
    }
    heartbeatRef.current = setInterval(() => {
      sendHeartbeat("flashcard_study", session.deck_id).catch(() => {});
    }, 30_000);
    return () => {
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    };
  }, [session?.deck_id, studying]);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    listStudyDecks()
      .then(setDecks)
      .catch(async () => {
        // Offline fallback: load saved decks from IndexedDB
        try {
          const offlineDecks = await getAllOfflineDecks();
          if (offlineDecks.length > 0) {
            const mapped: FlashcardDeck[] = offlineDecks.map(d => ({
              id: d.deckId, title: d.title, description: "",
              subject_id: d.subjectId, subject_name: "",
              section_id: null, is_published: true,
              card_count: d.cards.length, created_at: d.savedAt, created_by: "",
            }));
            setDecks(mapped);
            setOfflineMode(true);
            return;
          }
        } catch { /* IndexedDB also failed */ }
        setError("Failed to load decks. You may be offline.");
      })
      .finally(() => setLoading(false));
  }, []);

  const startStudy = useCallback(async (id: number) => {
    setStudying(true);
    setError(null);
    try {
      if (offlineMode || !isOnline()) {
        // Load from IndexedDB
        const offDeck = await getOfflineFlashcardDeck(id);
        if (!offDeck || offDeck.cards.length === 0) {
          setError("No saved cards for this deck.");
          setStudying(false);
          return;
        }
        const offlineSession: DueSession = {
          deck_id: offDeck.deckId,
          deck_title: offDeck.title,
          total_due: offDeck.cards.length,
          cards: offDeck.cards.map(c => ({
            id: c.id, front: c.front, back: c.back, hint: c.hint, order: 0,
          })),
        };
        setSession(offlineSession);
        setCardIndex(0);
        setSessionStats({ correct: 0, total: 0 });
        setDone(false);
        setOfflineMode(true);
      } else {
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
      }
    } catch {
      setError("Failed to load cards.");
    } finally { setStudying(false); }
  }, [offlineMode]);

  // Auto-start if deckId in URL
  useEffect(() => {
    if (deckId && !session && !studying) startStudy(Number(deckId));
  }, [deckId, session, studying, startStudy]);

  const handleRate = useCallback(async (quality: number) => {
    if (!session) return;
    const card = session.cards[cardIndex];
    try {
      if (offlineMode || !isOnline()) {
        // Queue review for sync when back online
        await enqueueOfflineAction("flashcard_review", {
          deckId: session.deck_id,
          cardId: card.id,
          quality,
        });
      } else {
        await submitReview(session.deck_id, card.id, quality);
      }
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
  }, [session, cardIndex, offlineMode]);

  const currentCard = session?.cards[cardIndex];
  const progress    = session ? Math.round(((cardIndex) / session.cards.length) * 100) : 0;

  // ── Deck list view ──
  if (!session) return (
    <>
      <div style={{ marginBottom: "var(--space-4)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--ink-primary)" }}>Study Decks</h2>
          {offlineMode && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "var(--radius-full)", padding: "2px 10px",
              fontSize: 10, fontWeight: 800, color: "var(--error)",
              letterSpacing: "0.05em",
            }}>
              OFFLINE
            </span>
          )}
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: "var(--space-4)" }} onClick={() => setError(null)}>{error}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: "var(--radius-lg)" }} />)}
        </div>
      ) : decks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🃏</div>
          <h3 className="empty-state__title">No decks available</h3>
          <p className="empty-state__message">Your teachers haven't published any flashcard decks yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {decks.map(deck => (
            <div key={deck.id} style={{ padding: "var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--ink-primary)" }}>{deck.title}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>
                  {deck.subject_name} · {deck.card_count} cards
                  {deck.due_count !== undefined && deck.due_count > 0 && (
                    <span style={{ marginLeft: "var(--space-2)", background: "var(--saffron)", color: "#fff", padding: "1px 6px", borderRadius: "var(--radius-full)", fontSize: 10, fontWeight: 700 }}>
                      {deck.due_count} due
                    </span>
                  )}
                </div>
              </div>
              <button className="btn btn--primary" style={{ fontSize: "var(--text-sm)", flexShrink: 0 }}
                onClick={() => startStudy(deck.id)} disabled={studying}>
                {studying ? "Loading…" : "Study"}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );

  // ── Session complete view ──
  if (done) return (
    <SessionComplete
      stats={sessionStats}
      deckTitle={session.deck_title}
      onRestart={() => startStudy(session.deck_id)}
      onBack={() => { setSession(null); setDone(false); }}
    />
  );

  // ── Active study session ──
  return (
    <>
      <div style={{ marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <div style={{ flex: 1, height: 6, background: "var(--bg-elevated)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "var(--saffron)", borderRadius: "var(--radius-full)", transition: "width 0.3s" }} />
        </div>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", flexShrink: 0 }}>{cardIndex + 1} / {session.cards.length}</span>
        <button className="btn btn--ghost" style={{ fontSize: "var(--text-xs)", flexShrink: 0 }} onClick={() => setSession(null)}>Exit</button>
      </div>
      {currentCard && <FlipCard key={currentCard.id} card={currentCard} onRate={handleRate} />}
    </>
  );
}
