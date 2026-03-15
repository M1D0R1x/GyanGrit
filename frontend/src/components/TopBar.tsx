import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import LogoutButton from "./LogoutButton";
import Logo from "./Logo";
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

function UserDropdown({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const auth = useAuth();

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      role="menu"
      aria-label="User menu"
      style={{
        position: "absolute",
        top: "calc(100% + var(--space-2))",
        right: 0,
        minWidth: 200,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-lg)",
        zIndex: "var(--z-overlay)",
        overflow: "hidden",
        animation: "fadeInUp 0.15s ease both",
      }}
    >
      {/* User info header */}
      <div style={{
        padding: "var(--space-3) var(--space-4)",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-surface)",
      }}>
        <div style={{
          fontWeight: 600,
          fontSize: "var(--text-sm)",
          color: "var(--text-primary)",
        }}>
          {auth.user?.username}
        </div>
        <div style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          marginTop: 2,
        }}>
          {auth.user?.public_id}
        </div>
      </div>

      {/* Menu items */}
      <div style={{ padding: "var(--space-1) 0" }}>
        <button
          role="menuitem"
          className="dropdown-item"
          onClick={() => go("/profile")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          Profile
        </button>

        <div style={{
          height: 1,
          background: "var(--border-subtle)",
          margin: "var(--space-1) 0",
        }} />

        <div style={{ padding: "var(--space-1) var(--space-4)" }}>
          <LogoutButton onLogout={onClose} />
        </div>
      </div>
    </div>
  );
}

export default function TopBar({ title }: Props) {
  const auth     = useAuth();
  const [open, setOpen] = useState(false);
  const dropdownRef     = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (auth.loading) {
    return (
      <header className="topbar" aria-busy="true">
        <Logo size="sm" variant="full" />
        <div className="topbar__right">
          <div className="skeleton topbar__skeleton-user" />
        </div>
      </header>
    );
  }

  return (
    <header className="topbar" role="banner">
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <Logo size="sm" variant="full" />
        {title && (
          <>
            <span style={{
              color: "var(--border-strong)",
              fontSize: "var(--text-base)",
              userSelect: "none",
            }}>
              /
            </span>
            <span className="topbar__title">{title}</span>
          </>
        )}
      </div>

      <div className="topbar__right">
        {auth.authenticated && auth.user ? (
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={open}
              aria-label="Open user menu"
              className="topbar__user"
              style={{ cursor: "pointer", background: "none", border: "none", padding: 0 }}
            >
              <div
                className="topbar__user"
                style={{
                  border: open ? "1px solid var(--brand-primary)" : undefined,
                  transition: "border-color var(--transition-fast)",
                }}
              >
                <div className="topbar__avatar" aria-hidden="true">
                  {getInitials(auth.user.username)}
                </div>
                <span className="topbar__username">{auth.user.username}</span>
                <span className={roleBadgeClass(auth.user.role)}>
                  {auth.user.role}
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{
                    transform: open ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform var(--transition-fast)",
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>

            {open && <UserDropdown onClose={() => setOpen(false)} />}
          </div>
        ) : (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
            Not signed in
          </span>
        )}
      </div>
    </header>
  );
}