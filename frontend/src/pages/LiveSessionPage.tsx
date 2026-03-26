// pages.LiveSessionPage
/**
 * Live class session page — teacher hosts, students join.
 *
 * Teacher view:
 *   - Create / list sessions
 *   - Start / end session
 *   - See attendance in real time
 *   - Full publish rights (camera + mic)
 *
 * Student view:
 *   - See upcoming / live sessions
 *   - Join with one tap
 *   - Subscribe only (no publish by default)
 *   - Attendance auto-recorded on join
 *
 * Uses LiveKit @livekit/components-react for the video UI.
 * LiveKit handles all WebRTC — we just supply a JWT token.
 */
import "@livekit/components-styles";
import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  listMySessions, createSession, startSession, endSession,
  getUpcomingSessions, joinSession, getSessionToken,
  type LiveSession, type LiveToken,
} from "../services/livesessions";
import { apiGet } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

// ── Tiny video layout for students (subscriber only) ─────────────────────────
function StudentVideoLayout() {
  const tracks = useTracks([
    { source: Track.Source.Camera,      withPlaceholder: true  },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  return (
    <GridLayout tracks={tracks} style={{ height: "calc(100vh - 160px)" }}>
      <ParticipantTile />
    </GridLayout>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────
function SessionCard({ session, onAction, actionLabel, actionStyle }: {
  session: LiveSession;
  onAction: (s: LiveSession) => void;
  actionLabel: string;
  actionStyle?: React.CSSProperties;
}) {
  const statusColors: Record<string, string> = {
    scheduled: "var(--text-muted)",
    live:      "var(--success)",
    ended:     "var(--error)",
  };
  const statusBg: Record<string, string> = {
    scheduled: "rgba(107,114,128,0.08)",
    live:      "rgba(34,197,94,0.1)",
    ended:     "rgba(239,68,68,0.08)",
  };

  return (
    <div style={{ padding: "var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
          <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{session.title}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: "var(--radius-full)", background: statusBg[session.status], color: statusColors[session.status], textTransform: "uppercase" as const }}>
            {session.status === "live" ? "🔴 LIVE" : session.status}
          </span>
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {session.subject_name ?? "General"} · {session.teacher_name}
          {session.attendance_count !== undefined && ` · ${session.attendance_count} attending`}
        </div>
        {session.description && <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{session.description}</div>}
      </div>
      <button className="btn btn--primary" style={{ flexShrink: 0, fontSize: "var(--text-sm)", ...actionStyle }}
        onClick={() => onAction(session)}>
        {actionLabel}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LiveSessionPage() {
  const { sessionId }      = useParams<{ sessionId: string }>();
  const { user }           = useAuth();

  const isTeacher          = user?.role === "TEACHER" || user?.role === "PRINCIPAL" || user?.role === "ADMIN";

  const [sessions,    setSessions]    = useState<LiveSession[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [liveToken,   setLiveToken]   = useState<LiveToken | null>(null);
  const [inRoom,      setInRoom]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Teacher: create form
  const [showCreate,  setShowCreate]  = useState(false);
  const [newTitle,    setNewTitle]    = useState("");
  const [newDesc,     setNewDesc]     = useState("");
  const [newSection,  setNewSection]  = useState<number | "">("");
  const [newSubject,  setNewSubject]  = useState<number | "">("");
  const [creating,    setCreating]    = useState(false);
  const [assignments, setAssignments] = useState<{ section_id: number; section_name: string; class_name: string; subject_id: number; subject_name: string }[]>([]);
  // For ADMIN/PRINCIPAL: dedicated section + subject lists (no duplication from assignments)
  const [allSections, setAllSections] = useState<{ id: number; short_label: string }[]>([]);
  const [allSubjects, setAllSubjects] = useState<{ id: number; name: string }[]>([]);

  const isAdminOrPrincipal = user?.role === "ADMIN" || user?.role === "PRINCIPAL";

  // Load sessions
  useEffect(() => {
    const fetch = isTeacher ? listMySessions : getUpcomingSessions;
    fetch()
      .then(setSessions)
      .catch(() => setError("Failed to load sessions."))
      .finally(() => setLoading(false));

    if (isTeacher) {
      if (isAdminOrPrincipal) {
        // ADMIN/PRINCIPAL: fetch all sections + all subjects (no assignment duplication)
        apiGet<{ id: number; short_label: string }[]>("/academics/sections/")
          .then(setAllSections)
          .catch(() => {});
        apiGet<{ id: number; name: string }[]>("/academics/subjects/")
          .then(setAllSubjects)
          .catch(() => {});
      } else {
        // TEACHER: use my-assignments (section+subject pairs they teach)
        apiGet<typeof assignments>("/academics/my-assignments/")
          .then(setAssignments)
          .catch(() => {});
      }
    }
  }, [isTeacher, isAdminOrPrincipal]);

  // Auto-join if sessionId in URL
  useEffect(() => {
    if (sessionId && !inRoom) handleJoin(Number(sessionId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleJoin = useCallback(async (id: number) => {
    setError(null);
    try {
      if (!isTeacher) await joinSession(id);
      const token = await getSessionToken(id);
      setLiveToken(token);
      setInRoom(true);
    } catch (err: unknown) {
      let msg = "Failed to join session.";
      if (err instanceof Error) {
        const raw = err.message.toLowerCase();
        if (raw.includes("ended")) msg = "This session has ended. The teacher has closed the live class.";
        else if (raw.includes("not live")) msg = "This session hasn't started yet. Wait for the teacher to go live.";
        else if (raw.includes("forbidden") || raw.includes("403")) msg = "You don't have access to this session.";
        else msg = err.message;
      }
      setError(msg);
      // Refresh session list so UI updates the status
      const fetch = isTeacher ? listMySessions : getUpcomingSessions;
      fetch().then(setSessions).catch(() => {});
    }
  }, [isTeacher]);

  const handleStart = useCallback(async (session: LiveSession) => {
    try {
      const updated = await startSession(session.id);
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
      await handleJoin(session.id);
    } catch { setError("Failed to start session."); }
  }, [handleJoin]);

  const handleEnd = useCallback(async (session: LiveSession) => {
    if (!confirm("End this live session?")) return;
    try {
      const updated = await endSession(session.id);
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
      setInRoom(false);
      setLiveToken(null);
    } catch { setError("Failed to end session."); }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || !newSection) return;
    setCreating(true);
    try {
      const s = await createSession({
        title: newTitle.trim(), description: newDesc.trim(),
        section_id: Number(newSection),
        subject_id: newSubject ? Number(newSubject) : undefined,
      });
      setSessions(prev => [s, ...prev]);
      setShowCreate(false); setNewTitle(""); setNewDesc(""); setNewSection(""); setNewSubject("");
    } finally { setCreating(false); }
  }, [newTitle, newDesc, newSection, newSubject]);

  // Sections: ADMIN/PRINCIPAL use /academics/sections/, TEACHER uses my-assignments
  const uniqueSections = isAdminOrPrincipal
    ? allSections.map(s => ({ id: s.id, name: s.short_label }))
    : [...new Map(assignments.map(a => [a.section_id, { id: a.section_id, name: `Class ${a.class_name} - ${a.section_name}` }])).values()];

  // Subjects: ADMIN/PRINCIPAL see ALL subjects, TEACHER sees only their assigned subjects for the selected section
  const subjectOptions = isAdminOrPrincipal
    ? allSubjects
    : [...new Map(assignments.filter(a => a.section_id === Number(newSection)).map(a => [a.subject_id, { id: a.subject_id, name: a.subject_name }])).values()];

  // ── In-room view ──
  if (inRoom && liveToken) {
    const activeSession = sessions.find(s => s.status === "live");
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0f0f0f" }}>
        <div style={{ padding: "var(--space-3) var(--space-4)", background: "#1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ color: "#fff", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-sm)" }}>
            🔴 Live — {activeSession?.title ?? "Class Session"}
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {isTeacher && activeSession && (
              <button className="btn" style={{ background: "var(--error)", color: "#fff", fontSize: "var(--text-xs)" }}
                onClick={() => handleEnd(activeSession)}>
                End Session
              </button>
            )}
            <button className="btn btn--ghost" style={{ fontSize: "var(--text-xs)", color: "#fff", borderColor: "#444" }}
              onClick={() => { setInRoom(false); setLiveToken(null); }}>
              Leave
            </button>
          </div>
        </div>

        <LiveKitRoom
          token={liveToken.token}
          serverUrl={liveToken.livekit_url}
          connect={true}
          video={isTeacher}
          audio={isTeacher}
          onDisconnected={() => { setInRoom(false); setLiveToken(null); }}
          style={{ flex: 1 }}
        >
          {isTeacher ? (
            <VideoConference />
          ) : (
            <>
              <RoomAudioRenderer />
              <StudentVideoLayout />
              <ControlBar variation="minimal" />
            </>
          )}
        </LiveKitRoom>
      </div>
    );
  }

  // ── Session list view ──
  return (
    <div className="page-shell">
      <TopBar title="Live Classes" />
      <main style={{ padding: "var(--space-4)", paddingBottom: 80, maxWidth: 640, margin: "0 auto" }}>
        {error && (
          <div className="alert alert--error" style={{ marginBottom: "var(--space-4)", display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16, lineHeight: 1, opacity: 0.7 }} aria-label="Dismiss">✕</button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--text-primary)" }}>
            {isTeacher ? "My Sessions" : "Upcoming Classes"}
          </h2>
          {isTeacher && (
            <button className="btn btn--primary" style={{ fontSize: "var(--text-xs)" }} onClick={() => setShowCreate(v => !v)}>
              + New Session
            </button>
          )}
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{ padding: "var(--space-4)", background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid var(--brand-primary)", marginBottom: "var(--space-4)" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "var(--space-3)", color: "var(--text-primary)" }}>New Live Session</div>
            <input className="form-input" placeholder="Session title *" value={newTitle} onChange={e => setNewTitle(e.target.value)} style={{ marginBottom: "var(--space-2)" }} />
            <input className="form-input" placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ marginBottom: "var(--space-2)" }} />
            <select className="form-input" value={newSection} onChange={e => setNewSection(Number(e.target.value))} style={{ marginBottom: "var(--space-2)" }}>
              <option value="">Select class / section *</option>
              {uniqueSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {subjectOptions.length > 0 && (
              <select className="form-input" value={newSubject} onChange={e => setNewSubject(Number(e.target.value))} style={{ marginBottom: "var(--space-3)" }}>
                <option value="">Select subject</option>
                {subjectOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button className="btn btn--primary" style={{ fontSize: "var(--text-sm)" }} onClick={handleCreate} disabled={creating || !newTitle.trim() || !newSection}>
                {creating ? "Creating…" : "Create Session"}
              </button>
              <button className="btn btn--ghost" style={{ fontSize: "var(--text-sm)" }} onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: "var(--radius-lg)" }} />)}
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📹</div>
            <h3 className="empty-state__title">{isTeacher ? "No sessions yet" : "No upcoming classes"}</h3>
            <p className="empty-state__message">
              {isTeacher ? "Create a session above to start a live class." : "Your teacher hasn't scheduled a live class yet."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {sessions.map(s => {
              if (isTeacher) {
                const label = s.status === "scheduled" ? "Go Live" : s.status === "live" ? "Rejoin" : "Ended";
                return (
                  <SessionCard key={s.id} session={s} actionLabel={label}
                    actionStyle={s.status === "ended" ? { opacity: 0.4, cursor: "not-allowed" } : {}}
                    onAction={s.status === "ended" ? () => {} : s.status === "scheduled" ? handleStart : (sess: LiveSession) => handleJoin(sess.id)}
                  />
                );
              }
              const label = s.status === "live" ? "Join Now" : "Scheduled";
              return (
                <SessionCard key={s.id} session={s} actionLabel={label}
                  actionStyle={s.status !== "live" ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                  onAction={s.status === "live" ? (sess: LiveSession) => handleJoin(sess.id) : () => {}}
                />
              );
            })}
          </div>
        )}
      </main>
      {!isTeacher && <BottomNav />}
    </div>
  );
}
