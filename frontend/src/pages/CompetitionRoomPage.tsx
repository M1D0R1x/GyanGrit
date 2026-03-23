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
import { useEffect, useRef, useState, useCallback } from "react";
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

// ── Types ─────────────────────────────────────────────────────────────────

type Section  = { id: number; name: string; short_label: string; class_name: string };
type Assessment = { id: number; title: string };

// ── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    draft:    { label: "Lobby",    color: "var(--text-muted)",    bg: "var(--bg-elevated)" },
    active:   { label: "🔴 Live",  color: "var(--success)",       bg: "rgba(16,185,129,0.1)" },
    finished: { label: "Finished", color: "var(--brand-primary)", bg: "rgba(59,130,246,0.1)" },
  };
  const s = map[status] ?? map.draft;
  return (
    <span style={{
      fontSize: "var(--text-xs)", fontWeight: 700, padding: "2px 10px",
      borderRadius: "var(--radius-full)", color: s.color, background: s.bg,
      border: `1px solid ${s.color}33`,
    }}>
      {s.label}
    </span>
  );
}

// ── Leaderboard ───────────────────────────────────────────────────────────

function Leaderboard({ entries, myId }: { entries: LeaderboardEntry[]; myId?: number }) {
  if (!entries.length) return (
    <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", fontStyle: "italic" }}>
      No participants yet.
    </p>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {entries.map((e) => {
        const isMe = e.student_id === myId;
        return (
          <div key={e.student_id} className="card" style={{
            padding: "var(--space-3) var(--space-4)",
            display: "flex", alignItems: "center", gap: "var(--space-4)",
            background: isMe ? "rgba(59,130,246,0.07)" : undefined,
            border: isMe ? "1px solid rgba(59,130,246,0.3)" : undefined,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: e.rank === 1 ? "var(--warning)"
                : e.rank === 2 ? "var(--text-muted)"
                : e.rank === 3 ? "#cd7f32"
                : "var(--bg-overlay)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-display)", fontWeight: 800,
              fontSize: "var(--text-sm)", color: e.rank && e.rank <= 3 ? "#fff" : "var(--text-secondary)",
              flexShrink: 0,
            }}>
              {e.rank ?? "—"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {e.display_name || e.username}
                {isMe && <span style={{ color: "var(--brand-primary)", marginLeft: "var(--space-2)" }}>(you)</span>}
              </div>
            </div>
            <div style={{
              fontFamily: "var(--font-display)", fontWeight: 800,
              fontSize: "var(--text-base)", color: "var(--text-primary)",
            }}>
              {e.score} pts
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Question card (student view during active room) ───────────────────────

function QuestionCard({
  question,
  index,
  total,
  answeredIds,
  onAnswer,
  submitting,
}: {
  question:    Question;
  index:       number;
  total:       number;
  answeredIds: Set<number>;
  onAnswer:    (questionId: number, optionId: number) => void;
  submitting:  boolean;
}) {
  const alreadyAnswered = answeredIds.has(question.id);

  return (
    <div className="card" style={{ marginBottom: "var(--space-4)" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: "var(--space-4)",
      }}>
        <div style={{
          fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--brand-primary)",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          Q{index + 1} / {total}
        </div>
        <span className="badge badge--info" style={{ fontSize: 10 }}>
          {question.marks} mark{question.marks !== 1 ? "s" : ""}
        </span>
      </div>
      <p style={{
        fontFamily: "var(--font-display)", fontWeight: 600,
        fontSize: "var(--text-base)", color: "var(--text-primary)",
        marginBottom: "var(--space-5)", lineHeight: 1.5,
      }}>
        {question.text}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {question.options.map((opt) => (
          <button
            key={opt.id}
            disabled={alreadyAnswered || submitting}
            onClick={() => onAnswer(question.id, opt.id)}
            style={{
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              background: alreadyAnswered ? "var(--bg-elevated)" : "var(--bg-surface)",
              color: "var(--text-primary)",
              fontSize: "var(--text-sm)",
              textAlign: "left",
              cursor: alreadyAnswered ? "default" : "pointer",
              opacity: alreadyAnswered ? 0.6 : 1,
              transition: "all var(--transition-fast)",
              fontFamily: "var(--font-body)",
            }}
            onMouseEnter={(e) => {
              if (!alreadyAnswered) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              if (!alreadyAnswered) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)";
            }}
          >
            {opt.text}
          </button>
        ))}
      </div>
      {alreadyAnswered && (
        <p style={{
          marginTop: "var(--space-3)", fontSize: "var(--text-xs)",
          color: "var(--success)", fontWeight: 600,
        }}>
          ✓ Answer submitted
        </p>
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
  const ablyRef    = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const numRoomId = roomId ? Number(roomId) : null;

  // ── Load list ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (numRoomId) return;
    listRooms()
      .then(setRooms)
      .catch(() => setError("Failed to load competition rooms."))
      .finally(() => setLoadingList(false));
  }, [numRoomId]);

  // ── Load teacher create form dependencies ─────────────────────────────
  useEffect(() => {
    if (!isTeacher || !showCreate) return;
    apiGet<Section[]>("/academics/my-assignments/")
      .then((assignments) => {
        // deduplicate sections
        const seen = new Set<number>();
        const secs: Section[] = [];
        assignments.forEach((a: any) => {
          if (!seen.has(a.section_id)) {
            seen.add(a.section_id);
            secs.push({ id: a.section_id, name: a.section_name, short_label: a.section_name, class_name: a.class_name });
          }
        });
        setSections(secs);
      })
      .catch(() => {});
    apiGet<any[]>("/courses/")
      .then((courses) => {
        // Use courses as proxy for assessments selection — teacher picks a course
        // then we load its assessments
        setAssessments(courses.map((c: any) => ({ id: c.id, title: c.title })));
      })
      .catch(() => {});
  }, [isTeacher, showCreate]);

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
            rank:         p.rank ?? i + 1,
            student_id:   p.student_id,
            username:     p.username,
            display_name: p.display_name,
            score:        p.score,
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
    if (room.status === "finished") return; // don't subscribe to finished rooms

    let mounted = true;

    const connect = async () => {
      try {
        const tokenData = await getAblyToken(numRoomId);
        if (!mounted) return;

        const client = new Ably.Realtime({
          token:    tokenData.token,
          clientId: tokenData.client_id,
        });
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
      ablyRef.current    = null;
      channelRef.current = null;
    };
  }, [numRoomId, room?.status, loadRoom]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleJoin = async () => {
    if (!numRoomId) return;
    try {
      await joinRoom(numRoomId);
      setJoined(true);
      setSuccess("Joined! Waiting for teacher to start...");
      loadRoom();
    } catch {
      setError("Could not join room.");
    }
  };

  const handleStart = async () => {
    if (!numRoomId) return;
    try {
      await startRoom(numRoomId);
      setSuccess("Room started! Students can now answer.");
      loadRoom();
    } catch (err: any) {
      setError(err?.message || "Could not start room.");
    }
  };

  const handleFinish = async () => {
    if (!numRoomId || !confirm("End this competition now?")) return;
    try {
      const res = await finishRoom(numRoomId);
      setLeaderboard(res.leaderboard);
      setRoom((prev) => prev ? { ...prev, status: "finished" } : prev);
      setSuccess("Competition ended. Final results below.");
    } catch {
      setError("Could not end room.");
    }
  };

  const handleAnswer = async (questionId: number, optionId: number) => {
    if (!numRoomId || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitAnswer(numRoomId, questionId, optionId);
      if (res.accepted) {
        setAnsweredIds((prev) => new Set(prev).add(questionId));
      }
    } catch {
      setError("Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!createTitle.trim() || !createSection || !createAssessment) {
      setError("Fill in all fields to create a room.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const newRoom = await createRoom({
        title:         createTitle.trim(),
        section_id:    Number(createSection),
        assessment_id: Number(createAssessment),
      });
      setRooms((prev) => [newRoom, ...prev]);
      setShowCreate(false);
      setCreateTitle(""); setCreateSection(""); setCreateAssessment("");
      setSuccess("Room created! Click on it to open and start.");
    } catch {
      setError("Failed to create room.");
    } finally {
      setCreating(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // RENDER — Room detail view
  // ─────────────────────────────────────────────────────────────────────

  if (numRoomId) {
    if (loadingRoom && !room) {
      return (
        <div className="page-shell">
          <TopBar title="Competition" />
          <main className="page-content page-content--narrow">
            {[160, 80, 120, 80].map((h, i) => (
              <div key={i} className="skeleton" style={{ height: h, borderRadius: "var(--radius-lg)", marginBottom: "var(--space-3)" }} />
            ))}
          </main>
        </div>
      );
    }

    if (!room) return (
      <div className="page-shell">
        <TopBar title="Competition" />
        <main className="page-content page-content--narrow">
          <div className="alert alert--error">Room not found.</div>
          <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        </main>
      </div>
    );

    const questions = room.questions ?? [];

    return (
      <div className="page-shell">
        <TopBar title="Competition Room" />
        <main className="page-content page-content--narrow page-enter">

          <button className="back-btn" onClick={() => navigate(`${prefix}/competitions`)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            All Rooms
          </button>

          {error   && <div className="alert alert--error"   onClick={() => setError(null)}>{error}</div>}
          {success && <div className="alert alert--success" onClick={() => setSuccess(null)}>{success}</div>}

          {/* Room header */}
          <div className="card" style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
                  <StatusBadge status={room.status} />
                </div>
                <h1 style={{
                  fontFamily: "var(--font-display)", fontWeight: 800,
                  fontSize: "var(--text-2xl)", color: "var(--text-primary)", lineHeight: 1.2,
                }}>
                  {room.title}
                </h1>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
                  {room.section} · {room.assessment} · {room.participant_count} participant{room.participant_count !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Teacher controls */}
              {isTeacher && (
                <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                  {room.status === "draft" && (
                    <button className="btn btn--primary" onClick={handleStart}>
                      ▶ Start
                    </button>
                  )}
                  {room.status === "active" && (
                    <button className="btn btn--danger" onClick={handleFinish}>
                      ■ End
                    </button>
                  )}
                </div>
              )}

              {/* Student join button */}
              {isStudent && room.status !== "finished" && !joined && (
                <button className="btn btn--primary" onClick={handleJoin}>
                  Join Room
                </button>
              )}
            </div>
          </div>

          {/* Student: waiting for room to start */}
          {isStudent && joined && room.status === "draft" && (
            <div className="card" style={{ textAlign: "center", padding: "var(--space-10)", marginBottom: "var(--space-6)" }}>
              <div style={{ fontSize: 48, marginBottom: "var(--space-4)" }}>⏳</div>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-primary)" }}>
                Waiting for teacher to start...
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
                Stay on this page. The quiz will begin automatically.
              </p>
            </div>
          )}

          {/* Student: answer questions (active room) */}
          {isStudent && room.status === "active" && (
            <div style={{ marginBottom: "var(--space-6)" }}>
              <div className="section-header">
                <div>
                  <h2 className="section-header__title">Questions</h2>
                  <p className="section-header__subtitle">
                    {answeredIds.size} / {questions.length} answered
                  </p>
                </div>
              </div>
              {questions.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "var(--space-8)" }}>
                  <p style={{ color: "var(--text-muted)" }}>Loading questions...</p>
                </div>
              ) : (
                questions.map((q, i) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    index={i}
                    total={questions.length}
                    answeredIds={answeredIds}
                    onAnswer={handleAnswer}
                    submitting={submitting}
                  />
                ))
              )}
            </div>
          )}

          {/* Teacher: questions with correct answers visible */}
          {isTeacher && room.status === "active" && questions.length > 0 && (
            <div style={{ marginBottom: "var(--space-6)" }}>
              <div className="section-header">
                <h2 className="section-header__title">Questions (teacher view)</h2>
              </div>
              {questions.map((q, i) => (
                <div key={q.id} className="card" style={{ marginBottom: "var(--space-3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
                    <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--brand-primary)", textTransform: "uppercase" }}>
                      Q{i + 1}
                    </span>
                    <span className="badge badge--info" style={{ fontSize: 10 }}>{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", marginBottom: "var(--space-3)" }}>
                    {q.text}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    {q.options.map((opt) => (
                      <div key={opt.id} style={{
                        padding: "var(--space-2) var(--space-3)",
                        borderRadius: "var(--radius-sm)",
                        background: opt.is_correct ? "rgba(16,185,129,0.1)" : "var(--bg-elevated)",
                        border: opt.is_correct ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--border-subtle)",
                        fontSize: "var(--text-sm)",
                        color: opt.is_correct ? "var(--success)" : "var(--text-secondary)",
                        fontWeight: opt.is_correct ? 600 : 400,
                        display: "flex", alignItems: "center", gap: "var(--space-2)",
                      }}>
                        {opt.is_correct && <span>✓</span>}
                        {opt.text}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Live leaderboard */}
          {(joined || isTeacher) && leaderboard.length > 0 && (
            <div>
              <div className="section-header">
                <h2 className="section-header__title">
                  {room.status === "finished" ? "🏆 Final Results" : "📊 Live Leaderboard"}
                </h2>
              </div>
              <Leaderboard entries={leaderboard} myId={user?.id} />
            </div>
          )}

          {/* Finished + no participants */}
          {room.status === "finished" && leaderboard.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">🏁</div>
              <h3 className="empty-state__title">Competition ended</h3>
              <p className="empty-state__message">No participants attempted this room.</p>
            </div>
          )}

        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENDER — Room list view (no roomId)
  // ─────────────────────────────────────────────────────────────────────

  const navigateToRoom = (id: number) =>
    navigate(isTeacher ? `${prefix}/competitions/${id}` : `/competitions/${id}`);

  return (
    <div className="page-shell">
      <TopBar title="Competition Rooms" />
      <main className="page-content page-enter">

        {error   && <div className="alert alert--error"   onClick={() => setError(null)}>{error}</div>}
        {success && <div className="alert alert--success" onClick={() => setSuccess(null)}>{success}</div>}

        {/* Teacher — create room */}
        {isTeacher && (
          <div style={{ marginBottom: "var(--space-6)" }}>
            {!showCreate ? (
              <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Competition Room
              </button>
            ) : (
              <div className="card">
                <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", marginBottom: "var(--space-5)" }}>
                  Create Room
                </h3>

                <div className="form-group">
                  <label className="form-label">Room Title *</label>
                  <input className="form-input" type="text" placeholder="e.g. Maths Quiz — Chapter 3"
                    value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Section *</label>
                  <select className="form-input" value={createSection}
                    onChange={(e) => setCreateSection(e.target.value)}>
                    <option value="">Select section</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>Class {s.class_name} — {s.short_label || s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Assessment (source questions) *</label>
                  <select className="form-input" value={createAssessment}
                    onChange={(e) => setCreateAssessment(e.target.value)}>
                    <option value="">Select assessment</option>
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                  <button className="btn btn--primary" onClick={handleCreate} disabled={creating}>
                    {creating ? <><span className="btn__spinner" /> Creating…</> : "Create Room"}
                  </button>
                  <button className="btn btn--secondary" onClick={() => setShowCreate(false)} disabled={creating}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Room list */}
        <div className="section-header">
          <h2 className="section-header__title">
            {isTeacher ? "My Competition Rooms" : "Competition Rooms"}
          </h2>
        </div>

        {loadingList ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 100, borderRadius: "var(--radius-lg)" }} />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏆</div>
            <h3 className="empty-state__title">No competition rooms yet</h3>
            <p className="empty-state__message">
              {isTeacher ? "Create a room to start a real-time quiz battle." : "Your teacher hasn't created any competition rooms yet."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {rooms.map((r, i) => (
              <div
                key={r.id}
                className="card card--clickable page-enter"
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => navigateToRoom(r.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigateToRoom(r.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
                      <StatusBadge status={r.status} />
                    </div>
                    <div style={{
                      fontFamily: "var(--font-display)", fontWeight: 700,
                      fontSize: "var(--text-base)", color: "var(--text-primary)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                      {r.section} · {r.assessment} · {r.participant_count} joined
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
