// components/TopBar.tsx — V4
// Clean topbar: no sidebar state, receives onMenuClick from AppLayout
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiPost } from "../services/api";
import Logo from "./Logo";
import { NotificationBell, NotificationPanel } from "./NotificationPanel";
import { fetchNotifications } from "../services/notifications";
import { useTheme } from "./ThemeProvider";

type Props = {
  title?: string;
  onMenuClick?: () => void;
};

const ROLE_COLORS: Record<string, string> = {
  STUDENT:   "#0EA5E9",
  TEACHER:   "#10B981",
  PRINCIPAL: "#F59E0B",
  OFFICIAL:  "#8B5CF6",
  ADMIN:     "#F43F5E",
};

function LogoutDropdownItem({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const auth     = useAuth();
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try { await apiPost("/accounts/logout/", {}); } catch { /* proceed */ }
    finally {
      setLoading(false);
      onLogout();
      await auth.refresh();
      navigate("/login", { replace: true });
    }
  };

  return (
    <button
      onClick={handle}
      disabled={loading}
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        padding: "var(--space-3)", background: "transparent", border: "none",
        borderRadius: "var(--radius-md)", color: "var(--error)",
        fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer",
        width: "100%", fontFamily: "inherit",
        transition: `background var(--duration-press) var(--ease-out-strong)`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--error-bg)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}

export default function TopBar({ title, onMenuClick }: Props) {
  const auth     = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [userMenuOpen,      setUserMenuOpen]      = useState(false);
  const [notifOpen,         setNotifOpen]         = useState(false);
  const [unreadCount,       setUnreadCount]       = useState(0);
  const [installPrompt,     setInstallPrompt]     = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const lastFetchRef = useRef<string | undefined>(undefined);

  const refreshUnread = useCallback(() => {
    if (!auth.authenticated) return;
    fetchNotifications({ since: lastFetchRef.current })
      .then((data) => {
        if (!data) return;
        setUnreadCount(data.unread);
        if (data.notifications.length > 0) {
          lastFetchRef.current = data.notifications[0].created_at;
        } else if (!lastFetchRef.current) {
          lastFetchRef.current = new Date().toISOString();
        }
      })
      .catch(() => {});
  }, [auth.authenticated]);

  useEffect(() => {
    refreshUnread();
    const interval  = setInterval(refreshUnread, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") refreshUnread(); };
    const onNew     = () => refreshUnread();
    window.addEventListener("notif:new", onNew);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notif:new", onNew);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshUnread]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!userMenuOpen && !notifOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setUserMenuOpen(false); setNotifOpen(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [userMenuOpen, notifOpen]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (!sessionStorage.getItem("pwa-banner-dismissed")) setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (installPrompt as any).prompt();
    setShowInstallBanner(false);
    setInstallPrompt(null);
  };

  const handleLogoClick = () => {
    if (!auth.authenticated || !auth.user) { navigate("/login"); return; }
    const paths: Record<string, string> = {
      STUDENT: "/dashboard", TEACHER: "/teacher", PRINCIPAL: "/principal",
      OFFICIAL: "/official", ADMIN: "/admin-panel",
    };
    navigate(paths[auth.user.role] ?? "/");
  };

  const handleViewAll = useCallback(() => {
    setNotifOpen(false);
    navigate("/notifications");
  }, [navigate]);

  const roleColor = auth.user ? (ROLE_COLORS[auth.user.role] ?? "#F59E0B") : "#F59E0B";

  // Same Nefee glass recipe as topbar: glass-fill gradient + glass-stroke border + blur(12px)
  const glassStyle: React.CSSProperties = {
    background:           "var(--glass-fill)",
    border:               "1px solid var(--glass-stroke)",
    backdropFilter:       "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow:            "var(--shadow-xl)",
  };

  return (
    <>
      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: "var(--bg-surface)", borderTop: "1px solid rgba(245,158,11,0.4)",
          padding: "var(--space-3) var(--space-4)", display: "flex",
          alignItems: "center", gap: "var(--space-3)", boxShadow: "var(--shadow-lg)",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "var(--radius-md)",
            background: "var(--saffron)", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 18, flexShrink: 0,
          }}>📚</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--ink-primary)" }}>Install GyanGrit</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Add to home screen for offline access</div>
          </div>
          <button onClick={handleInstall} className="btn btn--primary btn--sm" style={{ flexShrink: 0 }}>Install</button>
          <button
            onClick={() => { setShowInstallBanner(false); sessionStorage.setItem("pwa-banner-dismissed", "1"); }}
            style={{ background: "none", border: "none", color: "var(--ink-muted)", fontSize: 20, cursor: "pointer", padding: "var(--space-1)", flexShrink: 0 }}
          >✕</button>
        </div>
      )}

      <header role="banner" className="topbar">
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", maxWidth: 1100, margin: "0 auto",
        }}>
          {/* Left */}
          <div className="topbar__left">
            <button
              className="topbar__menu-btn"
              onClick={onMenuClick}
              aria-label="Open navigation"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6"  x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <button onClick={handleLogoClick} aria-label="Home"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", borderRadius: "var(--radius-sm)" }}>
              <Logo size="sm" variant="full" />
            </button>

            {title && (
              <>
                <div className="topbar__divider" />
                <span className="topbar__title">{title}</span>
              </>
            )}
          </div>

          {/* Right */}
          <div className="topbar__right">
            {auth.authenticated && (
              <div style={{ position: "relative" }}>
                {/* Notification bell */}
                <NotificationBell
                  unread={unreadCount}
                  active={notifOpen}
                  onClick={() => { setNotifOpen((v) => !v); setUserMenuOpen(false); }}
                />
                {notifOpen && (
                  <NotificationPanel
                    onClose={() => setNotifOpen(false)}
                    onUnreadChange={setUnreadCount}
                    onViewAll={handleViewAll}
                  />
                )}
              </div>
            )}

            {auth.loading ? (
              <div className="skeleton" style={{ width: 90, height: 32, borderRadius: "var(--radius-full)" }} />
            ) : auth.authenticated && auth.user ? (
              <div ref={userMenuRef} style={{ position: "relative" }}>
                <button
                  className="topbar__user"
                  onClick={() => { setUserMenuOpen((v) => !v); setNotifOpen(false); }}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <div className="topbar__avatar" style={{ background: roleColor }}>
                    {auth.user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="topbar__username hide-mobile">{auth.user.username}</span>
                  <span className="topbar__role-badge hide-mobile"
                    style={{ background: roleColor + "18", color: roleColor }}>
                    {auth.user.role}
                  </span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="var(--ink-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: userMenuOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 150ms", flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* User dropdown — same glass as topbar */}
                {userMenuOpen && (
                  <div
                    role="menu"
                    style={{
                      position:             "absolute",
                      top:                  "calc(100% + 8px)",
                      right:                0,
                      minWidth:             210,
                      borderRadius:         "var(--radius-xl)",
                      overflow:             "hidden",
                      zIndex:               999,
                      animation:            "scaleIn 0.15s ease both",
                      transformOrigin:      "top right",
                      ...glassStyle,
                    }}
                  >
                    {/* Header */}
                    <div style={{ padding: "var(--space-4) var(--space-4) var(--space-3)", borderBottom: "1px solid var(--glass-stroke)" }}>
                      <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--ink-primary)" }}>
                        {auth.user.username}
                      </div>
                      {auth.user.public_id && (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>
                          {auth.user.public_id}
                        </div>
                      )}
                    </div>

                    <div style={{ padding: "var(--space-2)" }}>
                      {[
                        { label: "Profile",       path: "/profile",       d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
                        { label: "Notifications", path: "/notifications", d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" },
                      ].map((item) => (
                        <button
                          key={item.label}
                          className="dropdown__item"
                          role="menuitem"
                          onClick={() => { setUserMenuOpen(false); navigate(item.path); }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d={item.d} />
                          </svg>
                          {item.label}
                          {item.label === "Notifications" && unreadCount > 0 && (
                            <span style={{
                              marginLeft: "auto", background: "var(--error)", color: "#fff",
                              fontSize: 9, fontWeight: 800, padding: "1px 5px",
                              borderRadius: "var(--radius-full)", fontFamily: "var(--font-display)",
                            }}>
                              {unreadCount}
                            </span>
                          )}
                        </button>
                      ))}

                      <button className="dropdown__item" role="menuitem" onClick={toggleTheme}>
                        {theme === "light" ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                          </svg>
                        )}
                        {theme === "light" ? "Dark Mode" : "Light Mode"}
                      </button>

                      <div className="dropdown__divider" />
                      <LogoutDropdownItem onLogout={() => setUserMenuOpen(false)} />
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>
    </>
  );
}
