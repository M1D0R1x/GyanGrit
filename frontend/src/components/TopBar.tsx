// components.TopBar
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import LogoutButton from "./LogoutButton";
import Logo from "./Logo";
import NavMenu from "./NavMenu";
import { NotificationBell, NotificationPanel } from "./NotificationPanel";
import { fetchNotifications } from "../services/notifications";
import type { Role } from "../auth/authTypes";

type Props = {
  title?: string;
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  STUDENT:   "#3b82f6",
  TEACHER:   "#10b981",
  PRINCIPAL: "#f59e0b",
  OFFICIAL:  "#8b5cf6",
  ADMIN:     "#ef4444",
};

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function UserDropdown({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      role="menu"
      style={{
        position:     "absolute",
        top:          "calc(100% + 8px)",
        right:        0,
        minWidth:     200,
        background:   "var(--bg-elevated)",
        border:       "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        boxShadow:    "0 8px 32px rgba(0,0,0,0.4)",
        zIndex:       9999,
        overflow:     "hidden",
      }}
    >
      <UserInfoHeader />

      <div style={{ padding: "4px 0" }}>
        <button
          role="menuitem"
          onClick={() => go("/profile")}
          onMouseEnter={() => setHovered("profile")}
          onMouseLeave={() => setHovered(null)}
          style={{
            display:     "flex",
            alignItems:  "center",
            gap:         10,
            width:       "100%",
            padding:     "8px 16px",
            background:  hovered === "profile" ? "var(--bg-overlay)" : "none",
            border:      "none",
            color:       hovered === "profile" ? "var(--text-primary)" : "var(--text-secondary)",
            fontFamily:  "var(--font-body)",
            fontSize:    "var(--text-sm)",
            fontWeight:  500,
            cursor:      "pointer",
            textAlign:   "left",
            transition:  "all 0.1s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          Profile
        </button>

        <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />

        <div style={{ padding: "4px 8px" }}>
          <LogoutButton onLogout={onClose} />
        </div>
      </div>
    </div>
  );
}

function UserInfoHeader() {
  const auth = useAuth();
  if (!auth.user) return null;
  return (
    <div style={{
      padding:      "12px 16px",
      borderBottom: "1px solid var(--border-subtle)",
      background:   "var(--bg-surface)",
    }}>
      <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
        {auth.user.username}
      </div>
      {auth.user.public_id && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
          {auth.user.public_id}
        </div>
      )}
    </div>
  );
}

export default function TopBar({ title }: Props) {
  const auth     = useAuth();
  const navigate = useNavigate();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [unreadCount, setUnreadCount]   = useState(0);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef    = useRef<HTMLDivElement>(null);

  const refreshUnread = useCallback(() => {
    if (!auth.authenticated) return;
    fetchNotifications()
      .then((data) => { if (data) setUnreadCount(data.unread); })
      .catch(() => { /* silent */ });
  }, [auth.authenticated]);

  useEffect(() => {
    refreshUnread();
    const interval = setInterval(refreshUnread, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshUnread();
    };
    // Listen for real-time chat notification events dispatched by AuthContext
    const onNotifNew = () => refreshUnread();
    window.addEventListener("notif:new", onNotifNew);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notif:new", onNotifNew);
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
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [userMenuOpen, notifOpen]);

  // PWA install prompt — shown once when browser fires beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      const dismissed = sessionStorage.getItem("pwa-banner-dismissed");
      if (!dismissed) setShowInstallBanner(true);
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

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem("pwa-banner-dismissed", "1");
  };

  const handleLogoClick = () => {
    if (!auth.authenticated || !auth.user) {
      navigate("/login");
      return;
    }
    const paths: Record<string, string> = {
      STUDENT:   "/dashboard",
      TEACHER:   "/teacher",
      PRINCIPAL: "/principal",
      OFFICIAL:  "/official",
      ADMIN:     "/admin-panel",
    };
    navigate(paths[auth.user.role] ?? "/");
  };

  const handleViewAll = useCallback(() => {
    setNotifOpen(false);
    navigate("/notifications");
  }, [navigate]);

  return (
    <>
      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: "var(--bg-elevated)",
          borderTop: "2px solid var(--brand-primary)",
          padding: "var(--space-3) var(--space-4)",
          display: "flex", alignItems: "center", gap: "var(--space-3)",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.3)",
          animation: "fadeInUp 0.3s ease",
        }}>
          <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "var(--brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
            📚
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>Install GyanGrit</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Add to home screen for offline access</div>
          </div>
          <button onClick={handleInstall}
            style={{ background: "var(--brand-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", padding: "var(--space-2) var(--space-4)", fontWeight: 700, fontSize: "var(--text-sm)", cursor: "pointer", flexShrink: 0 }}>
            Install
          </button>
          <button onClick={dismissInstallBanner}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer", padding: "var(--space-1)", flexShrink: 0 }}>
            ✕
          </button>
        </div>
      )}
      <header
      style={{
        position:       "sticky",
        top:            0,
        zIndex:         100,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        padding:        "0 24px",
        height:         56,
        background:     "var(--bg-surface)",
        borderBottom:   "1px solid var(--border-subtle)",
        backdropFilter: "blur(8px)",
      }}
      role="banner"
    >
      {/* ── Left: logo + page title ─────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={handleLogoClick}
          aria-label="Go to home"
          style={{
            background:   "none",
            border:       "none",
            padding:      0,
            cursor:       "pointer",
            display:      "flex",
            alignItems:   "center",
            borderRadius: "var(--radius-sm)",
            transition:   "opacity 0.15s",
            flexShrink:   0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.75"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        >
          <Logo size="sm" variant="full" />
        </button>

        {title && (
          <>
            <span style={{ color: "var(--border-strong)", fontSize: 16, userSelect: "none" }}>/</span>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
              {title}
            </span>
          </>
        )}
      </div>

      {/* ── Right: nav menu + notification bell + user pill ─────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        {/*
          ⚠️ NAV MENU — TEMPORARY SUPERVISOR DEMO
          Shows all role-specific routes in a dropdown.
          TODO: redesign as sidebar/drawer post-capstone.
        */}
        {auth.authenticated && auth.user && (
          <NavMenu role={auth.user.role as Role} />
        )}

        {/* Notification bell */}
        {auth.authenticated && (
          <div ref={notifRef} style={{ position: "relative" }}>
            <NotificationBell
              unread={unreadCount}
              active={notifOpen}
              onClick={() => {
                setNotifOpen((v) => !v);
                setUserMenuOpen(false);
              }}
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

        {/* User pill */}
        {auth.loading ? (
          <div style={{
            width:        140,
            height:       34,
            background:   "var(--bg-elevated)",
            borderRadius: "var(--radius-full)",
            animation:    "shimmer 1.5s infinite linear",
          }} />
        ) : auth.authenticated && auth.user ? (
          <div ref={userMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => {
                setUserMenuOpen((v) => !v);
                setNotifOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              aria-label="Open user menu"
              style={{
                display:      "flex",
                alignItems:   "center",
                gap:          8,
                padding:      "4px 12px 4px 6px",
                background:   userMenuOpen ? "var(--bg-elevated)" : "var(--bg-overlay)",
                border:       "1px solid",
                borderColor:  userMenuOpen ? "var(--brand-primary)" : "var(--border-subtle)",
                borderRadius: "var(--radius-full)",
                cursor:       "pointer",
                transition:   "all 0.15s",
                fontFamily:   "inherit",
              }}
            >
              <div style={{
                width:          26,
                height:         26,
                borderRadius:   "50%",
                background:     ROLE_BADGE_COLORS[auth.user.role] ?? "var(--brand-primary)",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                fontSize:       10,
                fontWeight:     700,
                color:          "#fff",
                flexShrink:     0,
              }}>
                {getInitials(auth.user.username)}
              </div>

              <span style={{
                fontSize:     "var(--text-sm)",
                fontWeight:   600,
                color:        "var(--text-primary)",
                maxWidth:     100,
                overflow:     "hidden",
                textOverflow: "ellipsis",
                whiteSpace:   "nowrap",
              }}>
                {auth.user.username}
              </span>

              <span style={{
                fontSize:      10,
                fontWeight:    700,
                padding:       "2px 6px",
                borderRadius:  "var(--radius-full)",
                background:    (ROLE_BADGE_COLORS[auth.user.role] ?? "#3b82f6") + "22",
                color:         ROLE_BADGE_COLORS[auth.user.role] ?? "var(--brand-primary)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}>
                {auth.user.role}
              </span>

              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-muted)" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                style={{
                  transform:  userMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s",
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {userMenuOpen && <UserDropdown onClose={() => setUserMenuOpen(false)} />}
          </div>
        ) : null}
      </div>
    </header>
    </>
  );
}
