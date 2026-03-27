import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import * as Ably from "ably";
import {
  listRooms,
  getRoomDetail,
  createRoom,
  joinRoom,
  startRoom,
  finishRoom,
  submitAnswer,
  getAblyToken,
  type CompetitionRoom,
  type Question,
  type LeaderboardEntry,
} from "../services/competitions";
import { useAuth } from "../auth/AuthContext";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

// pages.CompetitionRoomPage
/**
 * Competition Rooms — real-time quiz battles via Ably Pub/Sub.
 *
 * Role behaviour:
 *   STUDENT  → join a room, answer questions, watch live leaderboard
 *   TEACHER  → create rooms, start/stop, see live leaderboard + correct answers
 *   PRINCIPAL/ADMIN → same as TEACHER view
 *
 * Real-time events (Ably channel: competition:{roomId}):
 *   room:started  → switch student view to quiz mode
 *   room:question → (reserved for future per-question push; currently polled)
 *   room:scores   → update live leaderboard
 *   room:finished → show final results
 */

// ── Types ─────────────────────────────────────────────────────────────────

type Section  = { id: number; name: string; short_label: string; class_name: string };
type Assessment = { id: number; title: string };

// ── Status badge ──────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
    draft:    { label: "STANDBY", color: "var(--text-muted)", bg: "var(--bg-elevated)" },
    active:   { label: "LIVE ARENA", color: "var(--role-teacher)", bg: "rgba(16,185,129,0.1)", pulse: true },
    finished: { label: "ARCHIVED", color: "var(--brand-primary)", bg: "rgba(59,130,246,0.1)" },
  };
  const s = map[status] ?? map.draft;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {s.pulse && <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, animation: 'pulse 1.5s infinite' }} />}
      <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', color: s.color }}>{s.label}</span>
    </div>
  );
};

// ── Leaderboard ───────────────────────────────────────────────────────────

function LiveScoreboard({ entries, myId, isFinished }: { entries: LeaderboardEntry[]; myId?: number; isFinished: boolean }) {
  return (
    <aside style={{ background: 'var(--bg-surface)', padding: 'var(--space-6)', overflowY: 'auto' }}>
       <h3 style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 'var(--space-6)' }}>
         {isFinished ? "🏆 FINAL RESULTS" : "📊 LIVE SCOREBOARD"}
       </h3>
       
       {entries.length === 0 ? (
         <p style={{ color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>No participants active telemetry detected.</p>
       ) : (
         <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {entries.map((e, i) => {
              const isMe = e.student_id === myId;
              const isFirst = e.rank === 1;
              
              return (
                <div key={e.student_id} className="glass-card page-enter" style={{ 
                  padding: 'var(--space-3) var(--space-4)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 'var(--space-4)',
                  borderLeft: isFirst ? '4px solid var(--warning)' : isMe ? '4px solid var(--brand-primary)' : '1px solid var(--glass-border)',
                  background: isMe ? 'rgba(59,130,246,0.05)' : 'var(--bg-elevated)',
                  animationDelay: `${i * 50}ms`
                }}>
                  <div style={{ 
                    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900,
                    background: isFirst ? "var(--warning)" : e.rank === 2 ? "var(--text-muted)" : e.rank === 3 ? "#cd7f32" : "var(--bg-surface)",
                    color: (e.rank && e.rank <= 3) ? '#000' : 'var(--text-secondary)'
                  }}>
                    {e.rank ?? "—"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                     <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                       {e.display_name || e.username}
                       {isMe && <span style={{ color: "var(--brand-primary)", marginLeft: "4px" }}>(you)</span>}
                     </div>
                     <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px', fontWeight: 700 }}>{e.score} PTS</div>
                  </div>
                  {isFirst && <span style={{ fontSize: '14px' }}>👑</span>}
                </div>
              );
            })}
         </div>
       )}
    </aside>
  );
}

// ── Question card (student view during active room) ───────────────────────

function QuestionCard({
  question, index, total, answeredIds, onAnswer, submitting,
}: {
  question: Question; index: number; total: number; answeredIds: Set<number>;
  onAnswer: (questionId: number, optionId: number) => void; submitting: boolean;
}) {
  const alreadyAnswered = answeredIds.has(question.id);

  return (
    <div className="glass-card page-enter" style={{ padding: 'var(--space-8)' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-primary)', letterSpacing: '0.1em' }}>SEQUENCE 0{index + 1} / 0{total}</div>
          <span style={{ fontSize: '10px', fontWeight: 800, padding: '4px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--role-student)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            {question.marks} MARK{question.marks !== 1 ? "S" : ""}
          </span>
       </div>
       
       <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
         {question.text}
       </p>
       
       <div style={{ display: "grid", gap: "var(--space-3)" }}>
         {question.options.map((opt) => (
           <button
             key={opt.id}
             disabled={alreadyAnswered || submitting}
             onClick={() => onAnswer(question.id, opt.id)}
             className={alreadyAnswered ? "" : "btn--ghost"}
             style={{
               padding: "var(--space-4)",
               borderRadius: "var(--radius-md)",
               border: "1px solid var(--glass-border)",
               background: alreadyAnswered ? "var(--bg-elevated)" : "transparent",
               color: alreadyAnswered ? "var(--text-secondary)" : "var(--text-primary)",
               fontSize: "14px",
               fontWeight: 500,
               textAlign: "left",
               cursor: alreadyAnswered ? "default" : "pointer",
               opacity: alreadyAnswered ? 0.6 : 1,
               transition: "all 0.2s"
             }}
           >
             {opt.text}
           </button>
         ))}
       </div>
       {alreadyAnswered && (
         <div style={{ marginTop: 'var(--space-4)', fontSize: '12px', color: 'var(--success)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
           <span style={{ fontSize: '14px' }}>✅</span> Telemetry registered
         </div>
       )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function CompetitionRoomPage() {
  const { roomId }   = useParams<{ roomId: string }>();
  const navigate     = useNavigate();
  const location     = useLocation();
  const { user }     = useAuth();

  const isTeacher    = user?.role === "TEACHER" || user?.role === "PRINCIPAL" || user?.role === "ADMIN";
  const isStudent    = user?.role === "STUDENT";

  // Prefix for back nav
  const prefix = location.pathname.startsWith("/teacher") ? "/teacher"
    : location.pathname.startsWith("/principal") ? "/principal"
    : "/admin";

  // ── List view (no roomId) ─────────────────────────────────────────────
  const [rooms,        setRooms]        = useState<CompetitionRoom[]>([]);
  const [loadingList,  setLoadingList]  = useState(true);

  // ── Room detail view (roomId present) ────────────────────────────────
  const [room,         setRoom]         = useState<CompetitionRoom | null>(null);
  const [loadingRoom,  setLoadingRoom]  = useState(false);
  const [leaderboard,  setLeaderboard]  = useState<LeaderboardEntry[]>([]);
  const [answeredIds,  setAnsweredIds]  = useState<Set<number>>(new Set());
  const [submitting,   setSubmitting]   = useState(false);
  const [joined,       setJoined]       = useState(false);

  // ── Create form (teacher) ─────────────────────────────────────────────
  const [showCreate,   setShowCreate]   = useState(false);
  const [createTitle,  setCreateTitle]  = useState("");
  const [createSection, setCreateSection] = useState("");
  const [createAssessment, setCreateAssessment] = useState("");
  const [sections,     setSections]     = useState<Section[]>([]);
  const [assessments,  setAssessments]  = useState<Assessment[]>([]);
  const [creating,     setCreating]     = useState(false);

  // ── Ably ──────────────────────────────────────────────────────────────
  const ablyRef    = useRef<any>(null);
  const channelRef = useRef<any>(null);

  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const numRoomId = roomId ? Number(roomId) : null;

  // ── Load list ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (numRoomId) return;
    listRooms().then(setRooms).catch(() => setError("Failed to load competition rooms.")).finally(() => setLoadingList(false));
  }, [numRoomId]);

  const isAdminOrPrincipal = user?.role === "ADMIN" || user?.role === "PRINCIPAL";

  // ── Load teacher create form dependencies ─────────────────────────────
  useEffect(() => {
    if (!isTeacher || !showCreate) return;

    if (isAdminOrPrincipal) {
      // ADMIN/PRINCIPAL: fetch all sections from dedicated endpoint (no duplicates)
      apiGet<{ id: number; short_label: string; class_name?: string }[]>("/academics/sections/")
        .then((secs) => { setSections(secs.map(s => ({ id: s.id, name: s.short_label, short_label: s.short_label, class_name: "" }))); })
        .catch(() => {});
    } else {
      // TEACHER: use my-assignments (section+subject pairs they teach)
      type AssignmentRow = { section_id: number; section_name: string; class_name: string };
      apiGet<AssignmentRow[]>("/academics/my-assignments/")
        .then((assignments) => {
          const seen = new Set<number>();
          const secs: Section[] = [];
          assignments.forEach((a) => {
            if (!seen.has(a.section_id)) {
              seen.add(a.section_id);
              secs.push({ id: a.section_id, name: `Class ${a.class_name} - ${a.section_name}`, short_label: a.section_name, class_name: a.class_name });
            }
          });
          setSections(secs);
        })
        .catch(() => {});
    }

    apiGet<{ id: number; title: string }[]>("/courses/")
      .then((courses) => { setAssessments(courses.map((c) => ({ id: c.id, title: c.title }))); })
      .catch(() => {});
  }, [isTeacher, showCreate, isAdminOrPrincipal]);

  // ── Load room detail ──────────────────────────────────────────────────
  const loadRoom = useCallback(async () => {
    if (!numRoomId) return;
    setLoadingRoom(true);
    try {
      const r = await getRoomDetail(numRoomId);
      setRoom(r);
      if (r.participants) {
        setLeaderboard(
          r.participants.map((p, i) => ({
            rank: p.rank ?? i + 1, student_id: p.student_id, username: p.username, display_name: p.display_name, score: p.score,
          }))
        );
      }
      // Check if student already joined
      if (isStudent && user) {
        const alreadyIn = r.participants?.some((p) => p.student_id === user.id);
        if (alreadyIn) setJoined(true);
      }
    } catch {
      setError("Failed to load room.");
    } finally {
      setLoadingRoom(false);
    }
  }, [numRoomId, isStudent, user]);

  useEffect(() => { loadRoom(); }, [loadRoom]);

  // ── Ably subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!numRoomId || !room) return;
    // don't subscribe to finished rooms
    if (room.status === "finished") return; 

    let mounted = true;

    const connect = async () => {
      try {
        const tokenData = await getAblyToken(numRoomId);
        if (!mounted) return;

        const client = new Ably.Realtime({ token: tokenData.token, clientId: tokenData.client_id });
        ablyRef.current = client;

        const channel = client.channels.get(`competition:${numRoomId}`);
        channelRef.current = channel;

        channel.subscribe("room:started", () => {
          setRoom((prev) => prev ? { ...prev, status: "active" } : prev);
          loadRoom();
        });

        channel.subscribe("room:scores", (msg) => {
          const lb = msg.data?.leaderboard as LeaderboardEntry[] | undefined;
          if (lb) setLeaderboard(lb);
        });

        channel.subscribe("room:finished", (msg) => {
          setRoom((prev) => prev ? { ...prev, status: "finished" } : prev);
          const lb = msg.data?.leaderboard as LeaderboardEntry[] | undefined;
          if (lb) setLeaderboard(lb);
        });
      } catch (err) {
        // Ably not configured — silently fall back to polling
        console.warn("[Competition] Ably not available, using polling", err);
      }
    };

    void connect();
    
    // Poll every 5s as fallback (when Ably key not set)
    const poll = setInterval(() => { if (mounted) loadRoom(); }, 5000);

    return () => {
      mounted = false;
      clearInterval(poll);
      channelRef.current?.unsubscribe();
      ablyRef.current?.close();
      ablyRef.current = null;
      channelRef.current = null;
    };
  }, [numRoomId, room?.status, loadRoom]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleJoin = async () => {
    if (!numRoomId) return;
    try {
      await joinRoom(numRoomId);
      setJoined(true);
      setSuccess("Joined! Waiting for sequence initiation...");
      loadRoom();
    } catch { setError("Registration failed."); }
  };

  const handleStart = async () => {
    if (!numRoomId) return;
    try {
      await startRoom(numRoomId);
      setSuccess("Arena activated. Real-time telemetry engaged.");
      loadRoom();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Activation failed."); }
  };

  const handleFinish = async () => {
    if (!numRoomId || !confirm("Nullify arena and finalize scores?")) return;
    try {
      const res = await finishRoom(numRoomId);
      setLeaderboard(res.leaderboard);
      setRoom((prev) => prev ? { ...prev, status: "finished" } : prev);
      setSuccess("Simulation archived. Final results calculated.");
    } catch { setError("Archival failed."); }
  };

  const handleAnswer = async (questionId: number, optionId: number) => {
    if (!numRoomId || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitAnswer(numRoomId, questionId, optionId);
      if (res.accepted) setAnsweredIds((prev) => new Set(prev).add(questionId));
    } catch { setError("Telemetry submission failed."); } finally { setSubmitting(false); }
  };

  const handleCreate = async () => {
    if (!createTitle.trim() || !createSection || !createAssessment) { setError("Complete all parameters to forge an arena."); return; }
    setCreating(true); setError(null);
    try {
      const newRoom = await createRoom({ title: createTitle.trim(), section_id: Number(createSection), assessment_id: Number(createAssessment) });
      setRooms((prev) => [newRoom, ...prev]);
      setShowCreate(false); setCreateTitle(""); setCreateSection(""); setCreateAssessment("");
      setSuccess("Arena forged successfully.");
    } catch { setError("Forge failed."); } finally { setCreating(false); }
  };

  // ─────────────────────────────────────────────────────────────────────
  // RENDER — Room detail view
  // ─────────────────────────────────────────────────────────────────────

  if (numRoomId) {
    if (loadingRoom && !room) {
      return (
        <div className="page-shell"><TopBar /><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="btn__spinner" /></main></div>
      );
    }

    if (!room) return <div className="page-shell"><main className="page-content"><div className="alert alert--error">Simulation unavailable.</div></main></div>;

    const questions = room.questions ?? [];

    return (
      <div className="page-shell" style={{ background: 'var(--bg-primary)' }}>
        <TopBar title={room.title} />
        <main style={{ height: 'calc(100vh - 64px)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', overflow: 'hidden' }}>
          
          <section style={{ padding: 'var(--space-10)', overflowY: 'auto', borderRight: '1px solid var(--glass-border)' }}>
             <div className="page-enter" style={{ maxWidth: '700px', margin: '0 auto' }}>
                <button className="btn--ghost" style={{ padding: '8px 16px', fontSize: '10px', letterSpacing: '0.1em', marginBottom: 'var(--space-6)' }} onClick={() => navigate(isTeacher ? `${prefix}/competitions` : `/competitions`)}>
                  ◀ BACK TO HUB
                </button>

                {error && <div className="alert alert--error animate-fade-up" onClick={() => setError(null)} style={{ cursor: 'pointer', marginBottom: 'var(--space-6)' }}>{error}</div>}
                {success && <div className="alert alert--success animate-fade-up" onClick={() => setSuccess(null)} style={{ cursor: 'pointer', marginBottom: 'var(--space-6)' }}>{success}</div>}

                {/* Room header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)' }}>
                   <div>
                      <StatusBadge status={room.status} />
                      <h1 style={{ fontSize: 'var(--text-4xl)', fontWeight: 900, marginTop: 'var(--space-4)', marginBottom: '8px' }}>{room.title}</h1>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{room.section} · {room.assessment} · {room.participant_count} Registered</div>
                   </div>

                   {/* Teacher controls */}
                   {isTeacher && (
                     <div style={{ display: "flex", gap: "var(--space-3)" }}>
                       {room.status === "draft" && <button className="btn--primary" style={{ padding: '12px 24px', fontSize: '12px', letterSpacing: '0.1em' }} onClick={handleStart}>INITIALIZE</button>}
                       {room.status === "active" && <button className="btn--ghost" style={{ padding: '12px 24px', fontSize: '12px', letterSpacing: '0.1em', color: 'var(--error)' }} onClick={handleFinish}>ARCHIVE</button>}
                     </div>
                   )}
                   {/* Student join button */}
                   {isStudent && room.status !== "finished" && !joined && (
                     <button className="btn--primary" style={{ padding: '12px 24px', fontSize: '12px', letterSpacing: '0.1em' }} onClick={handleJoin}>ENTER SIMULATION</button>
                   )}
                </div>

                {/* Student: waiting for room to start */}
                {isStudent && joined && room.status === "draft" && (
                  <div className="glass-card page-enter" style={{ textAlign: "center", padding: "var(--space-10)", border: "2px dashed var(--glass-border)" }}>
                    <div style={{ fontSize: 48, marginBottom: "var(--space-4)" }}>⏳</div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: "var(--text-primary)" }}>Awaiting Sequence Initiation...</h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "8px" }}>Maintain connection. Simulation will commence automatically.</p>
                  </div>
                )}

                {/* Student: answer questions (active room) */}
                {isStudent && room.status === "active" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                     {questions.map((q, i) => (
                       <QuestionCard key={q.id} question={q} index={i} total={questions.length} answeredIds={answeredIds} onAnswer={handleAnswer} submitting={submitting} />
                     ))}
                  </div>
                )}

                {/* Teacher: questions with correct answers visible */}
                {isTeacher && room.status === "active" && questions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                     {questions.map((q, i) => (
                       <div key={q.id} className="glass-card page-enter">
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
                            <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--brand-primary)", letterSpacing: '0.1em' }}>SEQUENCE 0{i + 1}</span>
                            <span style={{ fontSize: "10px", fontWeight: 800, padding: "4px 8px", borderRadius: "4px", background: "rgba(56, 189, 248, 0.1)", color: "var(--role-teacher)", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
                              {q.marks} MARK{q.marks !== 1 ? "S" : ""}
                            </span>
                          </div>
                          <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-6)", lineHeight: 1.5 }}>{q.text}</p>
                          <div style={{ display: "grid", gap: "var(--space-2)" }}>
                            {q.options.map((opt) => (
                              <div key={opt.id} style={{
                                padding: "var(--space-4)", borderRadius: "var(--radius-sm)",
                                background: opt.is_correct ? "rgba(16,185,129,0.1)" : "var(--bg-elevated)",
                                border: opt.is_correct ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--glass-border)",
                                fontSize: "14px", color: opt.is_correct ? "var(--success)" : "var(--text-secondary)", fontWeight: opt.is_correct ? 800 : 400,
                                display: "flex", alignItems: "center", gap: "var(--space-3)",
                              }}>
                                {opt.is_correct && <span>✅</span>} {opt.text}
                              </div>
                            ))}
                          </div>
                       </div>
                     ))}
                  </div>
                )}

                {/* Finished + no participants */}
                {room.status === "finished" && leaderboard.length === 0 && (
                  <div className="glass-card" style={{ padding: '64px 24px', textAlign: 'center' }}>
                     <span style={{ fontSize: '48px', display: 'block', marginBottom: '24px', filter: 'grayscale(1) opacity(0.3)' }}>🏁</span>
                     <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Simulation concluded with zero active attempts.</p>
                  </div>
                )}
             </div>
          </section>

          {/* Live leaderboard */}
          {(joined || isTeacher) && <LiveScoreboard entries={leaderboard} myId={user?.id} isFinished={room.status === "finished"} />}

        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENDER — Room list view (no roomId)
  // ─────────────────────────────────────────────────────────────────────

  return (
    <div className="page-shell">
      <TopBar title="The Arena" />
      <main className="page-content page-enter" style={{ padding: 'var(--space-10) var(--space-6)' }}>
        
        <header className="editorial-header" style={{ marginBottom: 'var(--space-10)' }}>
           <div className="role-tag role-tag--student" style={{ marginBottom: 'var(--space-4)' }}>🏆 REAL-TIME MASTERY</div>
           <h1 className="text-gradient" style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>Competitions.</h1>
           <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>Enter the live arena and challenge your peers in real-time knowledge battles.</p>
        </header>

        {error && <div className="alert alert--error animate-fade-up" onClick={() => setError(null)} style={{ cursor: 'pointer', marginBottom: 'var(--space-6)' }}>{error}</div>}
        {success && <div className="alert alert--success animate-fade-up" onClick={() => setSuccess(null)} style={{ cursor: 'pointer', marginBottom: 'var(--space-6)' }}>{success}</div>}

        {/* Teacher — create room */}
        {isTeacher && (
           <div style={{ marginBottom: 'var(--space-10)' }}>
              {!showCreate ? (
                 <button className="btn--primary" style={{ padding: '16px 32px', fontSize: '12px', letterSpacing: '0.1em' }} onClick={() => setShowCreate(true)}>
                    ➕ FORGE NEW ARENA
                 </button>
              ) : (
                 <div className="glass-card page-enter" style={{ maxWidth: '600px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: 'var(--space-6)' }}>Forge Arena</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                       <div>
                         <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>ARENA TITLE *</label>
                         <input className="form-input" style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', fontSize: '14px' }} type="text" placeholder="e.g. Physics Duel" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} />
                       </div>
                       
                       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div>
                            <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>JURISDICTION (SECTION) *</label>
                            <select className="form-input" style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', fontSize: '14px' }} value={createSection} onChange={(e) => setCreateSection(e.target.value)}>
                               <option value="">Select section</option>
                               {sections.map(s => <option key={s.id} value={s.id}>Class {s.class_name} — {s.short_label || s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>KNOWLEDGE CORE (ASSESSMENT) *</label>
                            <select className="form-input" style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', fontSize: '14px' }} value={createAssessment} onChange={(e) => setCreateAssessment(e.target.value)}>
                               <option value="">Select assessment</option>
                               {assessments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                            </select>
                          </div>
                       </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                       <button className="btn--primary" style={{ padding: '16px 32px', fontSize: '12px', letterSpacing: '0.1em' }} onClick={handleCreate} disabled={creating}>
                         {creating ? "FORGING..." : "FORGE ARENA"}
                       </button>
                       <button className="btn--ghost" style={{ padding: '16px 32px', fontSize: '12px', letterSpacing: '0.1em' }} onClick={() => setShowCreate(false)} disabled={creating}>CANCEL</button>
                    </div>
                 </div>
              )}
           </div>
        )}

        {/* Room list */}
        {loadingList ? (
           <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}><div className="btn__spinner" /></div>
        ) : rooms.length === 0 ? (
           <div className="empty-state">
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '24px', filter: 'grayscale(1) opacity(0.5)' }}>🏟️</span>
              <p style={{ color: 'var(--text-muted)' }}>{isTeacher ? "Forge a new arena to commence real-time battles." : "No arenas currently active in your jurisdiction."}</p>
           </div>
        ) : (
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              {rooms.map((r, i) => (
                <div key={r.id} className="glass-card card--clickable page-enter" style={{ padding: 'var(--space-6)', animationDelay: `${i * 40}ms` }} onClick={() => navigate(isTeacher ? `${prefix}/competitions/${r.id}` : `/competitions/${r.id}`)}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                      <StatusBadge status={r.status} />
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 800 }}>{r.participant_count} ENTERED</div>
                   </div>
                   <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>{r.title}</h3>
                   <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.section} · {r.assessment}</div>
                </div>
              ))}
           </div>
        )}

      </main>
      <BottomNav />
    </div>
  );
}
