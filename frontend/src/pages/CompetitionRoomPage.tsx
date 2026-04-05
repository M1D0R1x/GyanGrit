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
  getMyCompetitionHistory,
  type CompetitionRoom,
  type Question,
  type LeaderboardEntry,
} from "../services/competitions";
import { useAuth } from "../auth/AuthContext";
import { apiGet } from "../services/api";

// ── Types ─────────────────────────────────────────────────────────────────

type Section  = { id: number; name: string; short_label: string; class_name?: string; grade?: string; institution_id?: number; institution_name?: string };
type Assessment = { id: number; title: string };

// ── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    draft:    { label: "Lobby",    color: "var(--ink-muted)",    bg: "var(--bg-elevated)" },
    active:   { label: "🔴 Live",  color: "var(--success)",       bg: "rgba(16,185,129,0.1)" },
    finished: { label: "Finished", color: "var(--saffron)", bg: "rgba(59,130,246,0.1)" },
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
    <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", fontStyle: "italic" }}>
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
                : e.rank === 2 ? "var(--ink-muted)"
                : e.rank === 3 ? "#cd7f32"
                : "var(--bg-elevated)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-display)", fontWeight: 800,
              fontSize: "var(--text-sm)", color: e.rank && e.rank <= 3 ? "#fff" : "var(--ink-secondary)",
              flexShrink: 0,
            }}>
              {e.rank ?? "—"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--ink-primary)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {e.display_name || e.username}
                {isMe && <span style={{ color: "var(--saffron)", marginLeft: "var(--space-2)" }}>(you)</span>}
              </div>
            </div>
            <div style={{
              fontFamily: "var(--font-display)", fontWeight: 800,
              fontSize: "var(--text-base)", color: "var(--ink-primary)",
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
          fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--saffron)",
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
        fontSize: "var(--text-base)", color: "var(--ink-primary)",
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
              border: "1px solid var(--border-medium)",
              background: alreadyAnswered ? "var(--bg-elevated)" : "var(--bg-surface)",
              color: "var(--ink-primary)",
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

  // ── Tabs ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"rooms" | "history">("rooms");

  // ── List view (no roomId) ─────────────────────────────────────────────
  const [rooms,        setRooms]        = useState<CompetitionRoom[]>([]);
  const [history,      setHistory]      = useState<any[]>([]);
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
  const [createTimeLimit, setCreateTimeLimit] = useState("60");
  const [createScheduledAt, setCreateScheduledAt] = useState("");
  const [createSchool, setCreateSchool] = useState<number | "">("");
  const [sections,     setSections]     = useState<Section[]>([]);
  const [assessments,  setAssessments]  = useState<(Assessment & { subject_id?: number; title: string; grade?: number })[]>([]);
  const [creating,     setCreating]     = useState(false);
  const [assignments,  setAssignments]  = useState<{ section_id: number; section_name: string; class_name: string; subject_id: number; subject_name: string }[]>([]);

  // ── Ably ──────────────────────────────────────────────────────────────
  const ablyRef    = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const numRoomId = roomId ? Number(roomId) : null;

  // ── Timer State ───────────────────────────────────────────────────────
  const [activeIdx, setActiveIdx] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (room?.status !== "active" || !room.started_at || !room.questions) return;
    const timeLimitMs = (room.time_limit_secs || 60) * 1000;
    
    const calculateTimer = () => {
      const elapsedMs = Date.now() - new Date(room.started_at!).getTime();
      const idx = Math.floor(elapsedMs / timeLimitMs);
      const remainingMs = timeLimitMs - (elapsedMs % timeLimitMs);
      setActiveIdx(idx);
      setTimeRemaining(Math.ceil(remainingMs / 1000));
    };
    
    calculateTimer();
    const interval = setInterval(calculateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.status, room?.started_at, room?.time_limit_secs, room?.questions]);

  // ── Load list ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (numRoomId) return;
    listRooms()
      .then(setRooms)
      .catch(() => setError("Failed to load competition rooms."))
      .finally(() => setLoadingList(false));
      
    if (isStudent) {
      getMyCompetitionHistory().then(setHistory).catch(console.error);
    }
  }, [numRoomId, isStudent]);

  const isAdminOrPrincipal = user?.role === "ADMIN" || user?.role === "PRINCIPAL";
  const isRoomHost = room?.host_id === user?.id || isAdminOrPrincipal;

  // ── Load teacher create form dependencies ─────────────────────────────
  useEffect(() => {
    if (!isTeacher || !showCreate) return;

    if (isAdminOrPrincipal) {
      // ADMIN/PRINCIPAL: fetch all sections and schools
      apiGet<Section[]>("/academics/sections/")
        .then((secs) => {
          setSections(secs);
        })
        .catch(() => {});
    } else {
      // TEACHER: use my-assignments (section+subject pairs they teach)
      apiGet<typeof assignments>("/academics/my-assignments/")
        .then((data) => {
          setAssignments(data);
          const seen = new Set<number>();
          const secs: Section[] = [];
          data.forEach((a) => {
            if (!seen.has(a.section_id)) {
              seen.add(a.section_id);
              secs.push({ id: a.section_id, short_label: a.section_name, class_name: a.class_name } as any);
            }
          });
          setSections(secs);
        })
        .catch(() => {});
    }

    apiGet<{ id: number; title: string; subject__id?: number; grade?: number }[]>("/courses/")
      .then((courses) => {
        setAssessments(courses.map((c) => ({ id: c.id, title: c.title, subject_id: c.subject__id, grade: c.grade })));
      })
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not start room.");
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
        time_limit_secs: createTimeLimit ? Number(createTimeLimit) : 60,
        scheduled_at:   createScheduledAt ? new Date(createScheduledAt).toISOString() : undefined,
      });
      setRooms((prev) => [newRoom, ...prev]);
      setShowCreate(false);
      setCreateTitle(""); setCreateSection(""); setCreateAssessment(""); setCreateTimeLimit("60"); setCreateScheduledAt("");
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
        <>
          {[160, 80, 120, 80].map((h, i) => (
            <div key={i} className="skeleton" style={{ height: h, borderRadius: "var(--radius-lg)", marginBottom: "var(--space-3)" }} />
          ))}
        </>
      );
    }

    if (!room) return (
      <>
        <div className="alert alert--error">Room not found.</div>
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
      </>
    );

    const questions = room.questions ?? [];

    return (
      <>

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
                  fontSize: "var(--text-2xl)", color: "var(--ink-primary)", lineHeight: 1.2,
                }}>
                  {room.title}
                </h1>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginTop: "var(--space-2)" }}>
                  {room.section} · {room.assessment} · {room.participant_count} participant{room.participant_count !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Teacher controls */}
              {isTeacher && isRoomHost && (
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
              {isTeacher && !isRoomHost && (
                <div style={{ display: "flex", flexShrink: 0 }}>
                   <span className="badge badge--warning">👁 Spectating</span>
                </div>
              )}

              {/* Student join button */}
              {isStudent && room.status !== "finished" && !joined && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--space-2)"}}>
                  {room.scheduled_at && new Date(room.scheduled_at).getTime() - Date.now() > 5 * 60 * 1000 ? (
                    <span className="badge badge--info">Opens {new Date(room.scheduled_at).toLocaleString()}</span>
                  ) : (
                    <button className="btn btn--primary" onClick={handleJoin}>
                      Join Room
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Student: waiting for room to start */}
          {isStudent && joined && room.status === "draft" && (
            <div className="card" style={{ textAlign: "center", padding: "var(--space-10)", marginBottom: "var(--space-6)" }}>
              <div style={{ fontSize: 48, marginBottom: "var(--space-4)" }}>⏳</div>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--ink-primary)" }}>
                Waiting for teacher to start...
              </h3>
              <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
                Stay on this page. The quiz will begin automatically.
              </p>
            </div>
          )}

          {/* Student: answer questions (active room) */}
          {isStudent && room.status === "active" && (
            <div style={{ marginBottom: "var(--space-6)" }}>
              <div className="section-header">
                <div>
                  <h2 className="section-header__title">Active Question</h2>
                  <p className="section-header__subtitle">
                    {answeredIds.size} / {questions.length} answered
                  </p>
                </div>
                <div style={{
                  padding: "var(--space-2) var(--space-4)",
                  borderRadius: "var(--radius-full)",
                  background: timeRemaining <= 10 ? "rgba(239,68,68,0.1)" : "var(--bg-elevated)",
                  color: timeRemaining <= 10 ? "var(--danger)" : "var(--ink-secondary)",
                  fontWeight: 800,
                  fontSize: "var(--text-lg)",
                  fontFamily: "var(--font-display)",
                }}>
                  ⏱ {timeRemaining}s
                </div>
              </div>
              {questions.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "var(--space-8)" }}>
                  <p style={{ color: "var(--ink-muted)" }}>Loading questions...</p>
                </div>
              ) : activeIdx < questions.length ? (
                <QuestionCard
                  key={questions[activeIdx].id}
                  question={questions[activeIdx]}
                  index={activeIdx}
                  total={questions.length}
                  answeredIds={answeredIds}
                  onAnswer={handleAnswer}
                  submitting={submitting}
                />
              ) : (
                <div className="card" style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--ink-primary)" }}>
                  <div style={{ fontSize: 40, marginBottom: "var(--space-3)" }}>🏁</div>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-2)" }}>All Questions Completed!</h3>
                  <p style={{ color: "var(--ink-muted)" }}>Waiting for the host to officially end the competition.</p>
                </div>
              )}
            </div>
          )}

          {/* Teacher: questions with correct answers visible */}
          {isTeacher && room.status === "active" && questions.length > 0 && (
            <div style={{ marginBottom: "var(--space-6)" }}>
              <div className="section-header">
                <h2 className="section-header__title">Active Question (Teacher View)</h2>
                <div style={{
                  padding: "var(--space-2) var(--space-4)",
                  borderRadius: "var(--radius-full)",
                  background: timeRemaining <= 10 ? "rgba(239,68,68,0.1)" : "var(--bg-elevated)",
                  color: timeRemaining <= 10 ? "var(--danger)" : "var(--ink-secondary)",
                  fontWeight: 800,
                  fontSize: "var(--text-lg)",
                  fontFamily: "var(--font-display)",
                }}>
                  ⏱ {timeRemaining}s
                </div>
              </div>
              {activeIdx < questions.length ? (
                <div key={questions[activeIdx].id} className="card" style={{ marginBottom: "var(--space-3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
                    <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--saffron)", textTransform: "uppercase" }}>
                      Q{activeIdx + 1}
                    </span>
                    <span className="badge badge--info" style={{ fontSize: 10 }}>{questions[activeIdx].marks} mark{questions[activeIdx].marks !== 1 ? "s" : ""}</span>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--ink-primary)", marginBottom: "var(--space-3)" }}>
                    {questions[activeIdx].text}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    {questions[activeIdx].options.map((opt) => (
                      <div key={opt.id} style={{
                        padding: "var(--space-2) var(--space-3)",
                        borderRadius: "var(--radius-sm)",
                        background: opt.is_correct ? "rgba(16,185,129,0.1)" : "var(--bg-elevated)",
                        border: opt.is_correct ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--border-light)",
                        fontSize: "var(--text-sm)",
                        color: opt.is_correct ? "var(--success)" : "var(--ink-secondary)",
                        fontWeight: opt.is_correct ? 600 : 400,
                        display: "flex", alignItems: "center", gap: "var(--space-2)",
                      }}>
                        {opt.is_correct && <span>✓</span>}
                        {opt.text}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card" style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--ink-primary)" }}>
                  <p style={{ color: "var(--ink-muted)" }}>All questions have been displayed. The competition is waiting to be ended.</p>
                </div>
              )}
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
    </>
  );
}

  // ─────────────────────────────────────────────────────────────────────
  // RENDER — Room list view (no roomId)
  // ─────────────────────────────────────────────────────────────────────

  const navigateToRoom = (id: number) =>
    navigate(isTeacher ? `${prefix}/competitions/${id}` : `/competitions/${id}`);

  return (
    <>

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

                {isAdminOrPrincipal && (
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, color: "var(--ink-secondary)" }}>School/Institution</label>
                    <select className="form-input" value={createSchool} onChange={(e) => {
                      setCreateSchool(e.target.value ? Number(e.target.value) : "");
                      setCreateSection("");
                      setCreateAssessment("");
                    }}>
                      <option value="">All Schools</option>
                      {Array.from(new Set(sections.filter(s => s.institution_name).map(s => s.institution_name))).map(name => {
                        const instId = sections.find(s => s.institution_name === name)?.institution_id;
                        return <option key={instId} value={instId}>{name}</option>;
                      })}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Section *</label>
                  <select className="form-input" value={createSection}
                    onChange={(e) => {
                      setCreateSection(e.target.value);
                      setCreateAssessment("");
                    }}>
                    <option value="">Select section</option>
                    {isAdminOrPrincipal
                      ? sections
                          .filter(s => createSchool === "" || s.institution_id === createSchool)
                          .map(s => <option key={s.id} value={s.id}>{s.short_label}</option>)
                      : Array.from(new Set(assignments.map(a => a.section_id))).map(id => {
                          const a = assignments.find(x => x.section_id === id)!;
                          return <option key={id} value={id}>Class {a.class_name} - {a.section_name}</option>;
                      })
                    }
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Assessment (source questions) *</label>
                  <select className="form-input" value={createAssessment}
                    onChange={(e) => setCreateAssessment(e.target.value)}>
                    <option value="">Select assessment</option>
                    {assessments
                      .filter(a => {
                        if (!createSection) return true;
                        if (isAdminOrPrincipal) {
                          // Admin sees all subjects for that section's grade
                          const sec = sections.find(s => s.id === Number(createSection));
                          const classLevel = sec?.grade || sec?.class_name;
                          if (classLevel && a.grade) {
                            return String(a.grade) === String(classLevel);
                          }
                          return true;
                        }
                        // Teacher sees only subjects they actually teach for that section
                        const teacherSubjectsForSection = assignments.filter(assign => assign.section_id === Number(createSection)).map(assign => assign.subject_id);
                        return a.subject_id === undefined || teacherSubjectsForSection.includes(a.subject_id);
                      })
                      .map((a) => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Time Per Question (seconds) *</label>
                  <input className="form-input" type="number" min="10" max="300"
                    value={createTimeLimit} onChange={(e) => setCreateTimeLimit(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Scheduled Start Time (Optional)</label>
                  <input className="form-input" type="datetime-local"
                    value={createScheduledAt} onChange={(e) => setCreateScheduledAt(e.target.value)} />
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

        <div className="section-header" style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 0, marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", gap: "var(--space-6)" }}>
            <button 
              className={`tab-btn ${activeTab === "rooms" ? "tab-btn--active" : ""}`}
              onClick={() => setActiveTab("rooms")}
              style={{ paddingBottom: "var(--space-3)", fontWeight: activeTab === "rooms" ? 700 : 500, borderBottom: activeTab === "rooms" ? "2px solid var(--primary)" : "2px solid transparent", color: activeTab === "rooms" ? "var(--primary)" : "var(--ink-secondary)", background: "transparent", borderTop: "none", borderLeft: "none", borderRight: "none" }}
            >
              {isTeacher ? "My Competition Rooms" : "Active Rooms"}
            </button>
            {isStudent && (
              <button 
                className={`tab-btn ${activeTab === "history" ? "tab-btn--active" : ""}`}
                onClick={() => setActiveTab("history")}
                style={{ paddingBottom: "var(--space-3)", fontWeight: activeTab === "history" ? 700 : 500, borderBottom: activeTab === "history" ? "2px solid var(--primary)" : "2px solid transparent", color: activeTab === "history" ? "var(--primary)" : "var(--ink-secondary)", background: "transparent", borderTop: "none", borderLeft: "none", borderRight: "none" }}
              >
                My History
              </button>
            )}
          </div>
        </div>

        {activeTab === "history" ? (
          history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📜</div>
              <h3 className="empty-state__title">No history yet</h3>
              <p className="empty-state__message">Join a competition room to see your results here.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {history.map((h, i) => (
                <div key={i} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-lg)" }}>{h.title}</h4>
                      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
                        {h.assessment} • {new Date(h.finished_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--primary)" }}>{h.score} pts</div>
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-secondary)" }}>Rank {h.rank} of {h.participant_count}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : loadingList ? (
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
                      fontSize: "var(--text-base)", color: "var(--ink-primary)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
                      {r.section} · {r.assessment} · {r.participant_count} joined
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--ink-muted)" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
    </>
  );
}
