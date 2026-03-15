import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../auth/authTypes";

type Props = {
  title?: string;
};

function roleBadgeClass(role: Role): string {
  return `topbar__role-badge topbar__role-badge--${role.toLowerCase()}`;
}

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

// Roles that have a /manage-users page
const USER_MANAGEMENT_ROLES: Role[] = ["TEACHER", "PRINCIPAL", "OFFICIAL", "ADMIN"];

function TopBarSkeleton() {
  return (
    <header className="topbar" aria-busy="true">
      <div className="topbar__brand">Gyan<span>Grit</span></div>
      <div className="topbar__right">
        <div className="skeleton topbar__skeleton-user" />
      </div>
    </header>
  );
}

export default function TopBar({ title }: Props) {
  const auth      = useAuth();
  const navigate  = useNavigate();
  const [open, setOpen] = useState(false);
  const dropRef   = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (auth.loading) return <TopBarSkeleton />;

  const showManageUsers = auth.user && USER_MANAGEMENT_ROLES.includes(auth.user.role);

  const handleLogout = async () => {
    const { apiPost } = await import("../services/api");
    try { await apiPost("/accounts/logout/", {}); } catch { /* ignore */ }
    navigate("/login", { replace: true });
  };

  return (
    <header className="topbar" role="banner">
      <div className="topbar__brand">
        Gyan<span>Grit</span>
        {title && (
          <>
            <span style={{ color: "var(--border-strong)", margin: "0 10px" }}>/</span>
            <span className="topbar__title">{title}</span>
          </>
        )}
      </div>

      <div className="topbar__right">
        {auth.authenticated && auth.user ? (
          <div ref={dropRef} style={{ position: "relative" }}>
            <button
              className="topbar__user"
              onClick={() => setOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={open}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <div className="topbar__avatar" aria-hidden="true">
                {getInitials(auth.user.username)}
              </div>
              <span className="topbar__username">{auth.user.username}</span>
              <span className={roleBadgeClass(auth.user.role)}>
                {auth.user.role}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                strokeLinejoin="round" style={{ marginLeft: 4, opacity: 0.5 }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {open && (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  minWidth: 200,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-lg)",
                  zIndex: "var(--z-overlay)",
                  padding: "var(--space-2)",
                  animation: "fadeInUp 0.15s ease both",
                }}
              >
                <button
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => { setOpen(false); navigate("/profile"); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Profile
                </button>

                {showManageUsers && (
                  <button
                    className="dropdown-item"
                    role="menuitem"
                    onClick={() => { setOpen(false); navigate("/manage-users"); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Manage {auth.user.role === "TEACHER" ? "Students" :
                             auth.user.role === "PRINCIPAL" ? "Teachers" :
                             auth.user.role === "OFFICIAL" ? "Principals" : "Users"}
                  </button>
                )}

                <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: "var(--space-2) 0" }} />

                <button
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => { setOpen(false); handleLogout(); }}
                  style={{ color: "var(--error)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Not signed in</span>
        )}
      </div>
    </header>
  );
}