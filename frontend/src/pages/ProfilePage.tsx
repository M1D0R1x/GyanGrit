// pages.ProfilePage
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getMySummary, type MySummary } from "../services/gamification";
import TopBar from "../components/TopBar";
import LogoutButton from "../components/LogoutButton";
import BottomNav from "../components/BottomNav";

function ProfileField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{
      display:        "flex",
      justifyContent: "space-between",
      alignItems:     "center",
      padding:        "var(--space-4) 0",
      borderBottom:   "1px solid var(--border-subtle)",
    }}>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", fontWeight: 500, minWidth: 140 }}>
        {label}
      </span>
      <span style={{
        fontSize:   "var(--text-sm)",
        color:      value ? "var(--text-primary)" : "var(--text-muted)",
        fontWeight: value ? 500 : 400,
        fontStyle:  value ? "normal" : "italic",
      }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="card">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-4) 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="skeleton skeleton-line" style={{ width: 100, height: 14 }} />
          <div className="skeleton skeleton-line" style={{ width: 160, height: 14 }} />
        </div>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const auth     = useAuth();
  const navigate = useNavigate();
  const user     = auth.user;

  const [gamification, setGamification] = useState<MySummary | null>(null);

  // Load gamification only for students
  useEffect(() => {
    if (user?.role !== "STUDENT") return;
    let cancelled = false;

    async function load() {
      try {
        const data = await getMySummary();
        if (!cancelled) setGamification(data);
      } catch { /* non-fatal */ }
    }

    void load();
    return () => { cancelled = true; };
  }, [user?.role]);

  return (
    <div className="page-shell">
      <TopBar title="Profile" />
      <main className="page-content page-content--narrow page-enter has-bottom-nav">

        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        {/* Avatar header */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)", marginBottom: "var(--space-8)" }}>
          <div style={{
            width:          64,
            height:         64,
            borderRadius:   "50%",
            background:     "var(--brand-primary-glow)",
            border:         "2px solid var(--brand-primary)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontFamily:     "var(--font-display)",
            fontSize:       "var(--text-xl)",
            fontWeight:     800,
            color:          "var(--brand-primary)",
            flexShrink:     0,
          }}>
            {user
              ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase() || user.username.slice(0, 2).toUpperCase()
              : "??"}
          </div>
          <div>
            <h1 style={{
              fontFamily:   "var(--font-display)",
              fontSize:     "var(--text-2xl)",
              fontWeight:   800,
              color:        "var(--text-primary)",
              letterSpacing: "-0.03em",
              marginBottom: "var(--space-1)",
            }}>
              {user?.display_name ?? user?.username ?? "—"}
            </h1>
            {user && (
              <span className={`topbar__role-badge topbar__role-badge--${user.role.toLowerCase()}`}>
                {user.role}
              </span>
            )}
          </div>
        </div>

        {/* ── Gamification summary (students only) ─────────────────── */}
        {user?.role === "STUDENT" && gamification && (
          <>
            {/* Points + streak */}
            <div style={{
              display:   "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap:       "var(--space-3)",
              marginBottom: "var(--space-6)",
            }}>
              {[
                { icon: "⭐", value: gamification.total_points, label: "Points" },
                { icon: "🔥", value: gamification.current_streak, label: "Day Streak" },
                { icon: "🏅", value: gamification.badge_count, label: "Badges" },
              ].map(({ icon, value, label }) => (
                <div key={label} className="card" style={{ textAlign: "center", padding: "var(--space-4) var(--space-2)" }}>
                  <div style={{ fontSize: 22, marginBottom: "var(--space-1)" }}>{icon}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--role-student)", lineHeight: 1 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* Badge shelf */}
            {gamification.badges.length > 0 && (
              <div style={{ marginBottom: "var(--space-8)" }}>
                <div className="section-header" style={{ marginBottom: "var(--space-4)" }}>
                  <h3 className="section-header__title">Badges Earned</h3>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
                  {gamification.badges.map((badge) => (
                    <div
                      key={badge.code}
                      style={{
                        display:      "flex",
                        flexDirection: "column",
                        alignItems:   "center",
                        gap:          "var(--space-1)",
                        padding:      "var(--space-3) var(--space-4)",
                        background:   "rgba(245,158,11,0.06)",
                        border:       "1px solid rgba(245,158,11,0.2)",
                        borderRadius: "var(--radius-lg)",
                        minWidth:     80,
                        textAlign:    "center",
                      }}
                    >
                      <div style={{ fontSize: 28 }}>{badge.emoji}</div>
                      <div style={{
                        fontSize:   "var(--text-xs)",
                        fontWeight: 600,
                        color:      "var(--text-primary)",
                        lineHeight: 1.3,
                      }}>
                        {badge.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {auth.loading ? (
          <ProfileSkeleton />
        ) : !user ? (
          <div className="empty-state">
            <div className="empty-state__icon">👤</div>
            <h3 className="empty-state__title">Not signed in</h3>
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: "0 var(--space-6)", marginBottom: "var(--space-6)" }}>
              <ProfileField label="First Name"  value={user.first_name} />
              <ProfileField label="Middle Name" value={user.middle_name || null} />
              <ProfileField label="Last Name"   value={user.last_name} />
              <ProfileField label="Email"       value={user.email || null} />
              <ProfileField label="Mobile 1"    value={user.mobile_primary || null} />
              <ProfileField label="Mobile 2"    value={user.mobile_secondary || null} />
            </div>

            <div className="card" style={{ padding: "0 var(--space-6)" }}>
              <ProfileField label="Username"    value={user.username} />
              <ProfileField label="Public ID"   value={user.public_id} />
              <ProfileField label="Role"        value={user.role} />
              <ProfileField label="Institution" value={user.institution} />
              <ProfileField label="Section"     value={user.section} />
              <ProfileField label="District"    value={user.district} />
            </div>
          </>
        )}

        <div style={{ marginTop: "var(--space-8)" }}>
          <LogoutButton />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}