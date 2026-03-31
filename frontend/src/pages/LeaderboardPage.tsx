// pages.LeaderboardPage
import { useEffect, useState } from "react";
import {
  getClassLeaderboard,
  getSchoolLeaderboard,
  type LeaderboardEntry,
  type ClassLeaderboard,
  type SchoolLeaderboard,
} from "../services/gamification.ts";

type Tab = "class" | "school";

const PODIUM_COLORS = [
  "var(--warning)",    // 1st — gold
  "var(--ink-muted)", // 2nd — silver
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
          ? "var(--saffron-glow)"
          : "var(--bg-elevated)",
        border:         `3px solid ${entry.is_me ? "var(--saffron)" : color}`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     "var(--font-display)",
        fontWeight:     800,
        fontSize:       size * 0.3,
        color:          entry.is_me ? "var(--saffron)" : color,
        flexShrink:     0,
        boxShadow:      entry.is_me ? `0 0 0 3px var(--saffron)33` : "none",
      }}>
        {entry.display_name.slice(0, 2).toUpperCase()}
      </div>

      {/* Name */}
      <div style={{
        fontSize:      "var(--text-xs)",
        fontWeight:    entry.is_me ? 800 : 600,
        color:         entry.is_me ? "var(--saffron)" : "var(--ink-primary)",
        textAlign:     "center",
        maxWidth:      "100%",
        overflow:      "hidden",
        textOverflow:  "ellipsis",
        whiteSpace:    "nowrap",
      }}>
        {entry.is_me ? "You" : entry.display_name}
      </div>

      {/* Points */}
      <div style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize:   "var(--text-sm)",
        color,
      }}>
        {entry.total_points} pts
      </div>
    </div>
  );
}

function RankRow({ entry }: { entry: LeaderboardEntry }) {
  const isTop3 = entry.rank <= 3;

  return (
    <div style={{
      display:     "flex",
      alignItems:  "center",
      gap:         "var(--space-4)",
      padding:     "var(--space-3) var(--space-4)",
      borderRadius: "var(--radius-md)",
      background:  entry.is_me
        ? "rgba(59,130,246,0.06)"
        : "var(--bg-surface)",
      border:      entry.is_me
        ? "1px solid rgba(59,130,246,0.25)"
        : "1px solid var(--border-light)",
      transition:  "background var(--transition-fast)",
    }}>
      {/* Rank number */}
      <div style={{
        width:          32,
        height:         32,
        borderRadius:   "50%",
        background:     isTop3 ? PODIUM_COLORS[entry.rank - 1] + "22" : "var(--bg-elevated)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     "var(--font-display)",
        fontWeight:     800,
        fontSize:       "var(--text-xs)",
        color:          isTop3 ? PODIUM_COLORS[entry.rank - 1] : "var(--ink-muted)",
        flexShrink:     0,
      }}>
        {entry.rank}
      </div>

      {/* Avatar */}
      <div style={{
        width:          36,
        height:         36,
        borderRadius:   "50%",
        background:     entry.is_me ? "var(--saffron-glow)" : "var(--bg-elevated)",
        border:         `1px solid ${entry.is_me ? "var(--saffron)" : "var(--border-light)"}`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     "var(--font-display)",
        fontWeight:     700,
        fontSize:       "var(--text-xs)",
        color:          entry.is_me ? "var(--saffron)" : "var(--ink-secondary)",
        flexShrink:     0,
      }}>
        {entry.display_name.slice(0, 2).toUpperCase()}
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:     "var(--text-sm)",
          fontWeight:   entry.is_me ? 700 : 500,
          color:        entry.is_me ? "var(--saffron)" : "var(--ink-primary)",
          overflow:     "hidden",
          textOverflow: "ellipsis",
          whiteSpace:   "nowrap",
        }}>
          {entry.is_me ? "You" : entry.display_name}
        </div>
      </div>

      {/* Points */}
      <div style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize:   "var(--text-sm)",
        color:      entry.is_me ? "var(--saffron)" : "var(--ink-secondary)",
        flexShrink: 0,
      }}>
        {entry.total_points} pts
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: "flex", gap: "var(--space-4)", padding: "var(--space-3) var(--space-4)", alignItems: "center" }}>
      <div className="skeleton" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
      <div className="skeleton" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-line skeleton-line--medium" />
      </div>
      <div className="skeleton" style={{ width: 60, height: 16, borderRadius: 4 }} />
    </div>
  );
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab]             = useState<Tab>("class");
  const [classData, setClassData]             = useState<ClassLeaderboard | null>(null);
  const [schoolData, setSchoolData]           = useState<SchoolLeaderboard | null>(null);
  const [loadingClass, setLoadingClass]       = useState(true);
  const [loadingSchool, setLoadingSchool]     = useState(false);
  const [errorClass, setErrorClass]           = useState<string | null>(null);
  const [errorSchool, setErrorSchool]         = useState<string | null>(null);
  const [schoolLoaded, setSchoolLoaded]       = useState(false);

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
    <>

        {/* Tab toggle */}
        <div style={{
          display:        "flex",
          marginBottom:   "var(--space-6)",
          border:         "1px solid var(--border-medium)",
          borderRadius:   "var(--radius-sm)",
          overflow:       "hidden",
        }}>
          {(["class", "school"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex:        1,
                padding:     "var(--space-3)",
                background:  activeTab === tab ? "var(--role-student)" : "var(--bg-elevated)",
                border:      "none",
                color:       activeTab === tab ? "#fff" : "var(--ink-muted)",
                fontSize:    "var(--text-sm)",
                fontWeight:  activeTab === tab ? 700 : 400,
                cursor:      "pointer",
                transition:  "all var(--transition-fast)",
                fontFamily:  "var(--font-body)",
              }}
            >
              {tab === "class" ? "🏫 My Class" : "🏛️ My School"}
            </button>
          ))}
        </div>

        {/* Scope label */}
        {!loading && (
          <div style={{
            textAlign:    "center",
            marginBottom: "var(--space-6)",
          }}>
            <div style={{
              fontSize:    "var(--text-xs)",
              fontWeight:  600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color:       "var(--ink-muted)",
            }}>
              {activeTab === "class" ? "Class" : "School"} Rankings
            </div>
            <div style={{
              fontFamily:  "var(--font-display)",
              fontWeight:  800,
              fontSize:    "var(--text-lg)",
              color:       "var(--ink-primary)",
              marginTop:   "var(--space-1)",
            }}>
              {title}
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert--error">{error}</div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : activeEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏆</div>
            <h3 className="empty-state__title">No rankings yet</h3>
            <p className="empty-state__message">
              Complete lessons and assessments to appear on the leaderboard!
            </p>
          </div>
        ) : (
          <>
            {/* Podium — top 3 */}
            {podium.length >= 1 && (
              <div style={{
                display:        "flex",
                justifyContent: "center",
                alignItems:     "flex-end",
                gap:            "var(--space-4)",
                marginBottom:   "var(--space-8)",
                padding:        "var(--space-6) var(--space-4)",
                background:     "linear-gradient(180deg, rgba(59,130,246,0.04) 0%, transparent 100%)",
                borderRadius:   "var(--radius-lg)",
                border:         "1px solid var(--border-light)",
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
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {restList.map((entry) => (
                  <RankRow key={entry.user_id} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}
    </>
  );
}