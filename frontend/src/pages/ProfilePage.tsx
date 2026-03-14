import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";
import LogoutButton from "../components/LogoutButton";

function ProfileField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "var(--space-4) 0",
      borderBottom: "1px solid var(--border-subtle)",
    }}>
      <span style={{
        fontSize: "var(--text-sm)",
        color: "var(--text-muted)",
        fontWeight: 500,
        minWidth: 140,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: "var(--text-sm)",
        color: value ? "var(--text-primary)" : "var(--text-muted)",
        fontWeight: value ? 500 : 400,
        fontStyle: value ? "normal" : "italic",
      }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="card">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "var(--space-4) 0",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <div className="skeleton skeleton-line" style={{ width: 100, height: 14 }} />
          <div className="skeleton skeleton-line" style={{ width: 160, height: 14 }} />
        </div>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();

  return (
    <div className="page-shell">
      <TopBar title="Profile" />
      <main className="page-content page-content--narrow page-enter">

        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        {/* Avatar header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-5)",
          marginBottom: "var(--space-8)",
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--brand-primary-glow)",
            border: "2px solid var(--brand-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            fontWeight: 800,
            color: "var(--brand-primary)",
            flexShrink: 0,
          }}>
            {auth.user?.username.slice(0, 2).toUpperCase() ?? "??"}
          </div>
          <div>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-2xl)",
              fontWeight: 800,
              color: "var(--text-primary)",
              letterSpacing: "-0.03em",
              marginBottom: "var(--space-1)",
            }}>
              {auth.user?.username ?? "—"}
            </h1>
            {auth.user && (
              <span className={`topbar__role-badge topbar__role-badge--${auth.user.role.toLowerCase()}`}>
                {auth.user.role}
              </span>
            )}
          </div>
        </div>

        {auth.loading ? (
          <ProfileSkeleton />
        ) : !auth.user ? (
          <div className="empty-state">
            <div className="empty-state__icon">👤</div>
            <h3 className="empty-state__title">Not signed in</h3>
          </div>
        ) : (
          <div className="card" style={{ padding: "0 var(--space-6)" }}>
            <ProfileField label="Username"   value={auth.user.username} />
            <ProfileField label="Public ID"  value={auth.user.public_id} />
            <ProfileField label="Role"       value={auth.user.role} />
            <ProfileField label="Institution" value={auth.user.institution} />
            <ProfileField label="Section"    value={auth.user.section} />
            <ProfileField
              label="District"
              value={auth.user.district}
            />
          </div>
        )}

        <div style={{ marginTop: "var(--space-8)" }}>
          <LogoutButton />
        </div>
      </main>
    </div>
  );
}