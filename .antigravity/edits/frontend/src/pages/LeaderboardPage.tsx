// pages.LeaderboardPage
import { useEffect, useState } from "react";
import {
  getClassLeaderboard,
  getSchoolLeaderboard,
  type LeaderboardEntry,
  type ClassLeaderboard,
  type SchoolLeaderboard,
} from "../services/gamification.ts";
import TopBar from "../components/TopBar.tsx";
import BottomNav from "../components/BottomNav.tsx";

type Tab = "class" | "school";

const PODIUM_COLORS = [
  "var(--warning)",    // 1st — gold
  "var(--text-muted)", // 2nd — silver
  "#cd7f32",           // 3rd — bronze
];

const PODIUM_SIZES = [72, 60, 52]; // avatar size per podium position

function PodiumCard({ entry, position }: { entry: LeaderboardEntry; position: 0 | 1 | 2 }) {
  const color  = PODIUM_COLORS[position];
  const size   = PODIUM_SIZES[position];
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      gap:            "var(--space-2)",
      flex:           position === 0 ? "0 0 38%" : "0 0 28%",
      order:          position === 1 ? -1 : position === 2 ? 1 : 0,
      marginTop:      position === 0 ? 0 : "var(--space-6)",
    }}>
      {/* Medal */}
      <div style={{ fontSize: 24 }}>{medals[position]}</div>

      {/* Avatar */}
      <div style={{
        width:          size,
        height:         size,
        borderRadius:   "50%",
        background:     entry.is_me
          ? "rgba(61,214,140,0.12)"
          : "var(--glass-bg)",
        border:         `3px solid ${entry.is_me ? "var(--role-student)" : color}`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     "var(--font-display)",
        fontWeight:     800,
        fontSize:       size * 0.3,
        color:          entry.is_me ? "var(--role-student)" : color,
        flexShrink:     0,
        boxShadow:      entry.is_me ? `0 0 20px rgba(61,214,140,0.25)` : `0 0 12px ${color}33`,
      }}>
        {entry.display_name.slice(0, 2).toUpperCase()}
      </div>

      {/* Name */}
      <div style={{
        fontSize:      "var(--text-xs)",
        fontWeight:    entry.is_me ? 800 : 600,
        color:         entry.is_me ? "var(--role-student)" : "var(--text-primary)",
        textAlign:     "center",
        maxWidth:      "100%",
        overflow:      "hidden",
        textOverflow:  "ellipsis",
        whiteSpace:    "nowrap",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}>
        {entry.is_me ? "You" : entry.display_name}
      </div>

      {/* Points */}
      <div style={{
        fontFamily:    "var(--font-display)",
        fontWeight:    800,
        fontSize:      "var(--text-sm)",
        color,
        letterSpacing: "-0.02em",
      }}>
        {entry.total_points} pts
      </div>
    </div>
  );
}

function RankRow({ entry }: { entry: LeaderboardEntry }) {
  const isTop3 = entry.rank <= 3;

  return (
    <div className="glass-card animate-fade-up" style={{
      display:     "flex",
      alignItems:  "center",
      gap:         "var(--space-4)",
      padding:     "var(--space-3) var(--space-4)",
      background:  entry.is_me
        ? "rgba(61,214,140,0.05)"
        : "var(--glass-bg)",
      border:      entry.is_me
        ? "1px solid rgba(61,214,140,0.25)"
        : "1px solid var(--glass-border)",
      marginBottom: "var(--space-2)",
    }}>
      {/* Rank number */}
      <div style={{
        width:          32,
        height:         32,
        borderRadius:   "50%",
        background:     isTop3 ? PODIUM_COLORS[entry.rank - 1] + "22" : "rgba(255,255,255,0.05)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     "var(--font-display)",
        fontWeight:     800,
        fontSize:       "var(--text-xs)",
        color:          isTop3 ? PODIUM_COLORS[entry.rank - 1] : "var(--text-muted)",
        flexShrink:     0,
        letterSpacing:  "-0.02em",
      }}>
        {entry.rank}
      </div>

      {/* Avatar */}
      <div style={{
        width:          36,
        height:         36,
        borderRadius:   "50%",
        background:     entry.is_me ? "rgba(61,214,140,0.12)" : "rgba(255,255,255,0.05)",
        border:         `1px solid ${entry.is_me ? "rgba(61,214,140,0.4)" : "var(--glass-border)"}`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     "var(--font-display)",
        fontWeight:     700,
        fontSize:       "var(--text-xs)",
        color:          entry.is_me ? "var(--role-student)" : "var(--text-secondary)",
        flexShrink:     0,
      }}>
        {entry.display_name.slice(0, 2).toUpperCase()}
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:      "var(--text-sm)",
          fontWeight:    entry.is_me ? 700 : 500,
          color:         entry.is_me ? "var(--role-student)" : "var(--text-primary)",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          whiteSpace:    "nowrap",
          letterSpacing: entry.is_me ? "0.02em" : "normal",
        }}>
          {entry.is_me ? "You" : entry.display_name}
        </div>
      </div>

      {/* Points */}
      <div style={{
        fontFamily:    "var(--font-display)",
        fontWeight:    800,
        fontSize:      "var(--text-sm)",
        color:         entry.is_me ? "var(--role-student)" : "var(--text-secondary)",
        flexShrink:    0,
        letterSpacing: "-0.02em",
      }}>
        {entry.total_points} pts
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="glass-card" style={{ display: "flex", gap: "var(--space-4)", padding: "var(--space-3) var(--space-4)", alignItems: "center", marginBottom: "var(--space-2)" }}>
      <div className="skeleton-box" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
      <div className="skeleton-box" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton-box" style={{ height: 14, borderRadius: 4, width: "60%" }} />
      </div>
      <div className="skeleton-box" style={{ width: 60, height: 16, borderRadius: 4 }} />
    </div>
  );
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab]           = useState<Tab>("class");
  const [classData, setClassData]           = useState<ClassLeaderboard | null>(null);
  const [schoolData, setSchoolData]         = useState<SchoolLeaderboard | null>(null);
  const [loadingClass, setLoadingClass]     = useState(true);
  const [loadingSchool, setLoadingSchool]   = useState(false);
  const [errorClass, setErrorClass]         = useState<string | null>(null);
  const [errorSchool, setErrorSchool]       = useState<string | null>(null);
  const [schoolLoaded, setSchoolLoaded]     = useState(false);

  // Load class leaderboard on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getClassLeaderboard();
        if (!cancelled) setClassData(data);
      } catch {
        if (!cancelled) setErrorClass("Failed to load class leaderboard.");
      } finally {
        if (!cancelled) setLoadingClass(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // Load school leaderboard lazily when tab first opened
  useEffect(() => {
    if (activeTab !== "school" || schoolLoaded) return;
    let cancelled = false;
    setLoadingSchool(true);

    async function load() {
      try {
        const data = await getSchoolLeaderboard();
        if (!cancelled) { setSchoolData(data); setSchoolLoaded(true); }
      } catch {
        if (!cancelled) setErrorSchool("Failed to load school leaderboard.");
      } finally {
        if (!cancelled) setLoadingSchool(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [activeTab, schoolLoaded]);

  const activeEntries = activeTab === "class"
    ? classData?.entries ?? []
    : schoolData?.entries ?? [];

  const title = activeTab === "class"
    ? classData ? `Class ${classData.class_name}` : "Class"
    : schoolData?.institution_name ?? "School";

  const podium   = activeEntries.slice(0, 3);
  const restList = activeEntries.slice(3);
  const loading  = activeTab === "class" ? loadingClass : loadingSchool;
  const error    = activeTab === "class" ? errorClass   : errorSchool;

  return (
    <div className="page-shell">
      <TopBar title="Leaderboard" />
      <main className="page-content page-enter has-bottom-nav">

        {/* Hero */}
        <header className="page-hero animate-fade-up" style={{ marginBottom: "var(--space-6)" }}>
          <div className="role-tag role-tag--student" style={{ marginBottom: "var(--space-4)" }}>
            🏆 RANKINGS
          </div>
          <h1 className="text-gradient md-display">
            Score<br/>Nexus.
          </h1>
          <p className="hero-subtitle">
            Real-time academic performance rankings. Compete, rise, dominate.
          </p>
        </header>

        {/* Tab toggle */}
        <div className="studio-tabs animate-fade-up" style={{ marginBottom: "var(--space-6)" }}>
          {(["class", "school"] as Tab[]).map((tab) => (
            <button
              key={tab}
              className={`studio-tab-btn ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "class" ? "🏫 MY CLASS" : "🏛️ MY SCHOOL"}
            </button>
          ))}
        </div>

        {/* Scope label */}
        {!loading && (
          <div className="animate-fade-up" style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
            <div style={{
              fontSize:      "var(--text-xs)",
              fontWeight:    800,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color:         "var(--text-muted)",
            }}>
              {activeTab === "class" ? "Class" : "School"} Rankings
            </div>
            <div style={{
              fontFamily:    "var(--font-display)",
              fontWeight:    800,
              fontSize:      "var(--text-lg)",
              color:         "var(--text-primary)",
              marginTop:     "var(--space-1)",
              letterSpacing: "-0.02em",
            }}>
              {title}
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert--error animate-fade-up">{error}</div>
        )}

        {loading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : activeEntries.length === 0 ? (
          <div className="glass-card empty-well animate-fade-up">
            <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>🏆</span>
            <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>NO RANKINGS DETECTED</p>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Complete lessons and assessments to appear on the leaderboard!</span>
          </div>
        ) : (
          <>
            {/* Podium — top 3 */}
            {podium.length >= 1 && (
              <div className="glass-card animate-fade-up" style={{
                display:        "flex",
                justifyContent: "center",
                alignItems:     "flex-end",
                gap:            "var(--space-4)",
                marginBottom:   "var(--space-8)",
                padding:        "var(--space-8) var(--space-4)",
                background:     "linear-gradient(180deg, rgba(61,214,140,0.04) 0%, transparent 100%)",
              }}>
                {podium.map((entry, idx) => (
                  <PodiumCard
                    key={entry.user_id}
                    entry={entry}
                    position={idx as 0 | 1 | 2}
                  />
                ))}
              </div>
            )}

            {/* Ranks 4+ */}
            {restList.length > 0 && (
              <div>
                {restList.map((entry) => (
                  <RankRow key={entry.user_id} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
